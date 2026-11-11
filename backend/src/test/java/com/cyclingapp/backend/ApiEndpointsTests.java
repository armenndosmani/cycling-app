package com.cyclingapp.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class ApiEndpointsTests {

	@Autowired
	private MockMvc mvc;

	@Test
	void healthIsPublicAndUpWithoutDetails() throws Exception {
		mvc.perform(get("/actuator/health"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("UP"))
			.andExpect(jsonPath("$.components").doesNotExist());
	}

	@Test
	void otherActuatorEndpointsAreClosed() throws Exception {
		mvc.perform(get("/actuator/env")).andExpect(status().isUnauthorized());
		mvc.perform(get("/actuator/beans")).andExpect(status().isUnauthorized());
	}

	@Test
	@WithMockUser
	void otherActuatorEndpointsAreNotExposedEvenWhenAuthenticated() throws Exception {
		mvc.perform(get("/actuator/env")).andExpect(status().isNotFound());
		mvc.perform(get("/actuator/beans")).andExpect(status().isNotFound());
	}

	@Test
	void apiDocsAreClosedByDefault() throws Exception {
		mvc.perform(get("/v3/api-docs")).andExpect(status().isUnauthorized());
		mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isUnauthorized());
	}

	@Test
	@WithMockUser
	void apiDocsAreDisabledByDefaultEvenWhenAuthenticated() throws Exception {
		mvc.perform(get("/v3/api-docs")).andExpect(status().isNotFound());
		mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isNotFound());
	}

}
