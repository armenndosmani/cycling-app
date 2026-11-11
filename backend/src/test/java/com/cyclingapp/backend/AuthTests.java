package com.cyclingapp.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;

import javax.crypto.spec.SecretKeySpec;

import com.cyclingapp.backend.AuthTestClient.Tokens;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.web.servlet.MockMvc;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class AuthTests {

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
	void signUpNeedsAge16AndTermsThenCreatesTheAccount() throws Exception {
		String email = AuthTestClient.newEmail();
		client.requestCode(email).andExpect(status().isAccepted()).andExpect(content().string(""));

		SimpleMailMessage message = mail.lastMessageTo(email);
		assertThat(message.getSubject()).isEqualTo("Your sign-in code");
		assertThat(message.getFrom()).isEqualTo("no-reply@localhost.test");
		String code = client.codeSentTo(email);
		assertThat(message.getText()).contains(code).contains("10 minutes").doesNotContain(email);

		// Correct code, no account yet: the confirmations are required
		client.verify(email, code)
			.andExpect(status().isForbidden())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:registration-required"))
			.andExpect(jsonPath("$.termsVersion").value("draft-1"))
			.andExpect(content().string(not(containsString(code))));
		client.verifyWithConfirmations(email, code, false, "draft-1")
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:registration-required"));
		client.verifyWithConfirmations(email, code, true, "draft-0")
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:registration-required"));
		assertThat(countUsers(email)).isZero();

		// The code was neither consumed nor counted as a wrong attempt
		String body = client.verifyWithConfirmations(email, code, true, "draft-1")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.accessToken").isString())
			.andExpect(jsonPath("$.refreshToken").isString())
			.andExpect(jsonPath("$.accessTokenExpiresIn").value(900))
			.andExpect(jsonPath("$.newAccount").value(true))
			.andExpect(content().string(not(containsString(code))))
			.andReturn()
			.getResponse()
			.getContentAsString();

		client.getMe(Tokens.from(body).accessToken())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.email").value(email))
			.andExpect(jsonPath("$.displayName").isEmpty())
			.andExpect(jsonPath("$.adultConfirmed").value(false));

		var row = jdbc.queryForMap(
				"select terms_version, terms_accepted_at, age16_confirmed_at, adult_confirmed_at from users where email = ?",
				email);
		assertThat(row.get("terms_version")).isEqualTo("draft-1");
		assertThat(row.get("terms_accepted_at")).isNotNull();
		assertThat(row.get("age16_confirmed_at")).isNotNull();
		assertThat(row.get("adult_confirmed_at")).isNull();
	}

	@Test
	void existingRiderSignsInWithoutConfirmations() throws Exception {
		String email = AuthTestClient.newEmail();
		client.signUp(email);

		client.requestCode(email).andExpect(status().isAccepted());
		client.verify(email, client.codeSentTo(email))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.newAccount").value(false));
		assertThat(countUsers(email)).isOne();
	}

	@Test
	void emailIsNormalised() throws Exception {
		String email = AuthTestClient.newEmail();
		client.requestCode("  " + email.toUpperCase() + " ").andExpect(status().isAccepted());
		client.verifyWithConfirmations(" " + email.toUpperCase(), client.codeSentTo(email), true, "draft-1")
			.andExpect(status().isOk());
		assertThat(countUsers(email)).isOne();
	}

	@Test
	void codeRequestLooksTheSameForKnownAndUnknownAddresses() throws Exception {
		String known = AuthTestClient.newEmail();
		client.signUp(known);
		String unknown = AuthTestClient.newEmail();

		var knownResponse = client.requestCode(known).andExpect(status().isAccepted()).andReturn().getResponse();
		var unknownResponse = client.requestCode(unknown).andExpect(status().isAccepted()).andReturn().getResponse();
		assertThat(knownResponse.getContentAsString()).isEqualTo(unknownResponse.getContentAsString()).isEmpty();
		assertThat(knownResponse.getHeaderNames()).isEqualTo(unknownResponse.getHeaderNames());
	}

	@Test
	void invalidEmailIsAValidationError() throws Exception {
		client.requestCode("not-an-email")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("email"))
			.andExpect(content().string(not(containsString("not-an-email"))));
		client.requestCode("a".repeat(250) + "@example.test").andExpect(status().isBadRequest());
	}

	@Test
	void codesAreStoredOnlyAsHash() throws Exception {
		String email = AuthTestClient.newEmail();
		client.requestCode(email).andExpect(status().isAccepted());
		String hash = jdbc.queryForObject("select code_hash from email_codes where email = ?", String.class, email);
		assertThat(hash).hasSize(64).doesNotContain(client.codeSentTo(email));
	}

	@Test
	void fiveWrongAttemptsInvalidateTheCode() throws Exception {
		String email = AuthTestClient.newEmail();
		client.requestCode(email).andExpect(status().isAccepted());
		String code = client.codeSentTo(email);
		String wrong = code.equals("000000") ? "111111" : "000000";

		for (int i = 0; i < 5; i++) {
			client.verifyWithConfirmations(email, wrong, true, "draft-1")
				.andExpect(status().isBadRequest())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.type").value("urn:cycling:problem:invalid-code"));
		}
		client.verifyWithConfirmations(email, code, true, "draft-1")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:invalid-code"));
	}

	@Test
	void expiredCodeIsInvalid() throws Exception {
		String email = AuthTestClient.newEmail();
		client.requestCode(email).andExpect(status().isAccepted());
		jdbc.update("update email_codes set expires_at = now() - interval '1 second' where email = ?", email);

		client.verifyWithConfirmations(email, client.codeSentTo(email), true, "draft-1")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:invalid-code"));
	}

	@Test
	void codeCanBeUsedOnlyOnce() throws Exception {
		String email = AuthTestClient.newEmail();
		client.signUp(email);
		String code = client.codeSentTo(email);

		client.verify(email, code)
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:invalid-code"));
	}

	@Test
	void newCodeInvalidatesThePreviousOne() throws Exception {
		String email = AuthTestClient.newEmail();
		client.requestCode(email).andExpect(status().isAccepted());
		String first = client.codeSentTo(email);
		client.requestCode(email).andExpect(status().isAccepted());
		String second = client.codeSentTo(email);

		if (!first.equals(second)) {
			client.verifyWithConfirmations(email, first, true, "draft-1").andExpect(status().isBadRequest());
		}
		client.verifyWithConfirmations(email, second, true, "draft-1").andExpect(status().isOk());
	}

	@Test
	void codeRequestsPerAddressAreRateLimited() throws Exception {
		String email = AuthTestClient.newEmail();
		for (int i = 0; i < 3; i++) {
			client.requestCode(email).andExpect(status().isAccepted());
		}
		String retryAfter = client.requestCode(email)
			.andExpect(status().isTooManyRequests())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.status").value(429))
			.andReturn()
			.getResponse()
			.getHeader(HttpHeaders.RETRY_AFTER);
		assertThat(Long.parseLong(retryAfter)).isBetween(1L, 15 * 60L);
		assertThat(mail.messagesTo(email)).hasSize(3);
	}

	@Test
	void codeRequestsPerIpAreRateLimited() throws Exception {
		for (int i = 0; i < 20; i++) {
			client.requestCode(AuthTestClient.newEmail()).andExpect(status().isAccepted());
		}
		client.requestCode(AuthTestClient.newEmail())
			.andExpect(status().isTooManyRequests())
			.andExpect(header().exists(HttpHeaders.RETRY_AFTER));
	}

	@Test
	void verificationsPerIpAreRateLimited() throws Exception {
		for (int i = 0; i < 30; i++) {
			client.verify(AuthTestClient.newEmail(), "123456").andExpect(status().isBadRequest());
		}
		client.verify(AuthTestClient.newEmail(), "123456")
			.andExpect(status().isTooManyRequests())
			.andExpect(header().exists(HttpHeaders.RETRY_AFTER));
	}

	@Test
	void refreshRotatesTheTokens() throws Exception {
		Tokens first = client.signUp(AuthTestClient.newEmail());

		String body = client.refresh(first.refreshToken())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.accessTokenExpiresIn").value(900))
			.andExpect(jsonPath("$.newAccount").value(false))
			.andReturn()
			.getResponse()
			.getContentAsString();
		Tokens second = Tokens.from(body);
		assertThat(second.refreshToken()).isNotEqualTo(first.refreshToken());

		client.getMe(second.accessToken()).andExpect(status().isOk());
		client.refresh(second.refreshToken()).andExpect(status().isOk());
	}

	@Test
	void reusingARefreshTokenRevokesTheSession() throws Exception {
		Tokens first = client.signUp(AuthTestClient.newEmail());
		Tokens second = Tokens.from(client.refresh(first.refreshToken())
			.andExpect(status().isOk())
			.andReturn()
			.getResponse()
			.getContentAsString());

		client.refresh(first.refreshToken())
			.andExpect(status().isUnauthorized())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

		client.refresh(second.refreshToken()).andExpect(status().isUnauthorized());
		client.getMe(second.accessToken()).andExpect(status().isUnauthorized());
		client.getMe(first.accessToken()).andExpect(status().isUnauthorized());
	}

	@Test
	void unknownRefreshTokenIsRejected() throws Exception {
		client.refresh("not-a-real-token")
			.andExpect(status().isUnauthorized())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.status").value(401));
	}

	@Test
	void signOutEndsTheSessionImmediately() throws Exception {
		String email = AuthTestClient.newEmail();
		Tokens tokens = client.signUp(email);
		Tokens otherPhone = client.signIn(email);

		mvc.perform(client.withToken(post("/api/auth/sign-out"), tokens.accessToken()))
			.andExpect(status().isNoContent());

		client.getMe(tokens.accessToken())
			.andExpect(status().isUnauthorized())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
		client.refresh(tokens.refreshToken()).andExpect(status().isUnauthorized());
		// Other sessions of the same rider stay signed in
		client.getMe(otherPhone.accessToken()).andExpect(status().isOk());
	}

	@Test
	void signOutNeedsAnAccessToken() throws Exception {
		mvc.perform(client.fromIp(post("/api/auth/sign-out"))).andExpect(status().isUnauthorized());
	}

	@Test
	void meNeedsAValidAccessToken() throws Exception {
		mvc.perform(get("/api/me"))
			.andExpect(status().isUnauthorized())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.detail").value("Authentication is required."));
		client.getMe("not-a-jwt")
			.andExpect(status().isUnauthorized())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
	}

	@Test
	void tokensSignedWithAnotherKeyOrExpiredAreRejected() throws Exception {
		String email = AuthTestClient.newEmail();
		client.signUp(email);
		UUID userId = jdbc.queryForObject("select id from users where email = ?", UUID.class, email);
		UUID sessionId = jdbc.queryForObject("select id from sessions where user_id = ?", UUID.class, userId);

		String foreignKey = token("someone-elses-key-0123456789abcdef0123456789", userId, sessionId,
				Instant.now().plusSeconds(600));
		client.getMe(foreignKey).andExpect(status().isUnauthorized());

		String expired = token("test-only-not-a-secret-0123456789abcdef0123456789", userId, sessionId,
				Instant.now().minusSeconds(600));
		client.getMe(expired).andExpect(status().isUnauthorized());

		String valid = token("test-only-not-a-secret-0123456789abcdef0123456789", userId, sessionId,
				Instant.now().plusSeconds(600));
		client.getMe(valid).andExpect(status().isOk());
	}

	@Test
	void publicSignInEndpointsIgnoreABrokenAccessToken() throws Exception {
		String email = AuthTestClient.newEmail();
		mvc.perform(client.withToken(post("/api/auth/email/code"), "expired-or-broken")
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"email\":\"%s\"}".formatted(email))).andExpect(status().isAccepted());
	}

	private String token(String secret, UUID userId, UUID sessionId, Instant expiresAt) {
		var key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
		var encoder = NimbusJwtEncoder.withSecretKey(key).algorithm(MacAlgorithm.HS256).build();
		JwtClaimsSet claims = JwtClaimsSet.builder()
			.issuer("cycling-app")
			.subject(userId.toString())
			.issuedAt(expiresAt.minusSeconds(900))
			.expiresAt(expiresAt)
			.claim("sid", sessionId.toString())
			.build();
		return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
			.getTokenValue();
	}

	private int countUsers(String email) {
		return jdbc.queryForObject("select count(*) from users where email = ?", Integer.class, email);
	}

}
