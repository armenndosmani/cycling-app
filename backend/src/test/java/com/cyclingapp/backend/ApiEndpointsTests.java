package com.cyclingapp.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class ApiEndpointsTests {

	@Autowired
	private MockMvc mvc;

	@Test
	void healthIsUpWithoutDetails() throws Exception {
		mvc.perform(get("/actuator/health"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("UP"))
			.andExpect(jsonPath("$.components").doesNotExist());
	}

	@Test
	void otherActuatorEndpointsAreNotExposed() throws Exception {
		mvc.perform(get("/actuator/env")).andExpect(status().isNotFound());
		mvc.perform(get("/actuator/beans")).andExpect(status().isNotFound());
	}

	@Test
	void apiDocsAreDisabledByDefault() throws Exception {
		mvc.perform(get("/v3/api-docs")).andExpect(status().isNotFound());
		mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isNotFound());
	}

}
