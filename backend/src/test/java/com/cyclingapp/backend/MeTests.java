package com.cyclingapp.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;

import com.cyclingapp.backend.AuthTestClient.Tokens;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class MeTests {

	@Autowired
	private MockMvc mvc;

	@Autowired
	private CapturingMailSender mail;

	@Autowired
	private JdbcTemplate jdbc;

	private AuthTestClient client;

	@BeforeEach
	void setUp() {
		client = new AuthTestClient(mvc, mail);
	}

	@Test
	void riderSeesOnlyTheirOwnAccount() throws Exception {
		String email = AuthTestClient.newEmail();
		String otherEmail = AuthTestClient.newEmail();
		Tokens tokens = client.signUp(email);
		client.signUp(otherEmail);

		String userId = jdbc.queryForObject("select id::text from users where email = ?", String.class, email);
		client.getMe(tokens.accessToken())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(userId))
			.andExpect(jsonPath("$.email").value(email))
			.andExpect(jsonPath("$.displayName").isEmpty())
			.andExpect(jsonPath("$.bicycleTypes").isEmpty())
			.andExpect(jsonPath("$.adultConfirmed").value(false))
			.andExpect(content().string(not(containsString(otherEmail))));
	}

	@Test
	void riderUpdatesDisplayNameAndBicycleTypes() throws Exception {
		Tokens tokens = client.signUp(AuthTestClient.newEmail());

		patchMe(tokens, "{\"displayName\":\"  Fake Rider  \",\"bicycleTypes\":[\"GRAVEL\",\"ROAD\",\"GRAVEL\"]}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.displayName").value("Fake Rider"))
			.andExpect(jsonPath("$.bicycleTypes[0]").value("GRAVEL"))
			.andExpect(jsonPath("$.bicycleTypes[1]").value("ROAD"))
			.andExpect(jsonPath("$.bicycleTypes.length()").value(2));

		// Fields that are left out stay as they are
		patchMe(tokens, "{\"bicycleTypes\":[\"MTB\"]}").andExpect(status().isOk())
			.andExpect(jsonPath("$.displayName").value("Fake Rider"))
			.andExpect(jsonPath("$.bicycleTypes[0]").value("MTB"));
		patchMe(tokens, "{\"displayName\":\"Al\"}").andExpect(status().isOk())
			.andExpect(jsonPath("$.bicycleTypes[0]").value("MTB"));

		client.getMe(tokens.accessToken())
			.andExpect(jsonPath("$.displayName").value("Al"))
			.andExpect(jsonPath("$.bicycleTypes[0]").value("MTB"));

		patchMe(tokens, "{\"bicycleTypes\":[]}").andExpect(status().isOk())
			.andExpect(jsonPath("$.bicycleTypes").isEmpty());
	}

	@Test
	void displayNameMustBe2To40CharactersAfterTrimming() throws Exception {
		Tokens tokens = client.signUp(AuthTestClient.newEmail());

		for (String name : new String[] { "A", "   ", " B ", "x".repeat(41) }) {
			patchMe(tokens, "{\"displayName\":\"%s\"}".formatted(name)).andExpect(status().isBadRequest())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.title").value("Invalid request"))
				.andExpect(jsonPath("$.errors[0].field").value("displayName"));
		}
		patchMe(tokens, "{\"displayName\":\"%s\"}".formatted("x".repeat(40))).andExpect(status().isOk());
	}

	@Test
	void unknownBicycleTypeIsRejected() throws Exception {
		Tokens tokens = client.signUp(AuthTestClient.newEmail());
		patchMe(tokens, "{\"bicycleTypes\":[\"BMX\"]}").andExpect(status().isBadRequest())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
	}

	@Test
	void adultConfirmationIsStoredOnce() throws Exception {
		String email = AuthTestClient.newEmail();
		Tokens tokens = client.signUp(email);

		mvc.perform(client.withToken(post("/api/me/adult-confirmation"), tokens.accessToken()))
			.andExpect(status().isNoContent());
		Timestamp first = adultConfirmedAt(email);
		assertThat(first).isNotNull();

		mvc.perform(client.withToken(post("/api/me/adult-confirmation"), tokens.accessToken()))
			.andExpect(status().isNoContent());
		assertThat(adultConfirmedAt(email)).isEqualTo(first);
		client.getMe(tokens.accessToken()).andExpect(jsonPath("$.adultConfirmed").value(true));
	}

	@Test
	void accountEndpointsNeedAnAccessToken() throws Exception {
		mvc.perform(patch("/api/me").contentType(MediaType.APPLICATION_JSON).content("{}"))
			.andExpect(status().isUnauthorized());
		mvc.perform(post("/api/me/adult-confirmation")).andExpect(status().isUnauthorized());
		mvc.perform(post("/api/me/deletion-code")).andExpect(status().isUnauthorized());
		mvc.perform(post("/api/me/delete").contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"123456\"}"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void riderDeletesTheAccountWithAFreshEmailCode() throws Exception {
		String email = AuthTestClient.newEmail();
		Tokens tokens = client.signUp(email);
		// A fresh, unused sign-in code must not work for deleting
		client.requestCode(email).andExpect(status().isAccepted());
		String signInCode = client.codeSentTo(email);

		mvc.perform(client.withToken(post("/api/me/deletion-code"), tokens.accessToken()))
			.andExpect(status().isAccepted())
			.andExpect(content().string(""));
		assertThat(mail.lastMessageTo(email).getSubject()).isEqualTo("Your account deletion code");
		String code = client.codeSentTo(email);

		// A sign-in code or a wrong code does not delete anything
		String wrong = code.equals("000000") ? "111111" : "000000";
		for (String invalid : new String[] { wrong, signInCode.equals(code) ? wrong : signInCode }) {
			deleteMe(tokens, invalid).andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.type").value("urn:cycling:problem:invalid-code"));
		}
		assertThat(countRows("users", email)).isOne();

		deleteMe(tokens, code).andExpect(status().isNoContent());

		assertThat(countRows("users", email)).isZero();
		assertThat(countRows("email_codes", email)).isZero();
		assertThat(jdbc.queryForObject(
				"select count(*) from sessions s where not exists " + "(select 1 from users u where u.id = s.user_id)",
				Integer.class))
			.isZero();
		client.getMe(tokens.accessToken()).andExpect(status().isUnauthorized());
		client.refresh(tokens.refreshToken()).andExpect(status().isUnauthorized());

		// The address can be used for a new account, which starts from scratch
		client.requestCode(email).andExpect(status().isAccepted());
		client.verifyWithConfirmations(email, client.codeSentTo(email), true, "draft-1")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.newAccount").value(true));
	}

	@Test
	void deletionCodeExpiresAfterFiveWrongAttempts() throws Exception {
		String email = AuthTestClient.newEmail();
		Tokens tokens = client.signUp(email);
		mvc.perform(client.withToken(post("/api/me/deletion-code"), tokens.accessToken()))
			.andExpect(status().isAccepted());
		String code = client.codeSentTo(email);
		String wrong = code.equals("000000") ? "111111" : "000000";

		for (int i = 0; i < 5; i++) {
			deleteMe(tokens, wrong).andExpect(status().isBadRequest());
		}
		deleteMe(tokens, code).andExpect(status().isBadRequest());
		assertThat(countRows("users", email)).isOne();
	}

	private ResultActions patchMe(Tokens tokens, String json) throws Exception {
		return mvc.perform(client.withToken(patch("/api/me"), tokens.accessToken())
			.contentType(MediaType.APPLICATION_JSON)
			.content(json));
	}

	private ResultActions deleteMe(Tokens tokens, String code) throws Exception {
		return mvc.perform(client.withToken(post("/api/me/delete"), tokens.accessToken())
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"code\":\"%s\"}".formatted(code)));
	}

	private Timestamp adultConfirmedAt(String email) {
		return jdbc.queryForObject("select adult_confirmed_at from users where email = ?", Timestamp.class, email);
	}

	private int countRows(String table, String email) {
		// Table names are fixed in this class, never user input
		return jdbc.queryForObject("select count(*) from " + table + " where email = ?", Integer.class, email);
	}

}
