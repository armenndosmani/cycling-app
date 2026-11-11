package com.cyclingapp.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class SecurityTests {

	@Autowired
	private MockMvc mvc;

	@Autowired
	private ApplicationContext context;

	@Test
	void unknownEndpointsAreClosedWithProblemDetails() throws Exception {
		mvc.perform(get("/api/rides"))
			.andExpect(status().isUnauthorized())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.status").value(401))
			.andExpect(jsonPath("$.title").value("Unauthorized"))
			.andExpect(jsonPath("$.detail").value("Authentication is required."));
	}

	@Test
	void postsWithoutLoginAreClosedToo() throws Exception {
		mvc.perform(post("/api/rides").contentType(MediaType.APPLICATION_JSON).content("{}"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void noSessionCookieOrBasicAuthChallenge() throws Exception {
		mvc.perform(get("/api/rides"))
			.andExpect(cookie().doesNotExist("JSESSIONID"))
			.andExpect(header().doesNotExist("WWW-Authenticate"));
		mvc.perform(get("/actuator/health")).andExpect(cookie().doesNotExist("JSESSIONID"));
	}

	@Test
	void securityHeadersAreSet() throws Exception {
		mvc.perform(get("/actuator/health"))
			.andExpect(header().string("X-Content-Type-Options", "nosniff"))
			.andExpect(header().string("X-Frame-Options", "DENY"))
			.andExpect(header().string("Referrer-Policy", "no-referrer"))
			.andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")));
	}

	@Test
	void noDefaultUserIsGenerated() {
		assertThat(context.getBeanNamesForType(UserDetailsService.class)).isEmpty();
	}

}
