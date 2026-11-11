package com.cyclingapp.backend;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser
class ErrorHandlingTests {

	@Autowired
	private MockMvc mvc;

	@Test
	void unknownPathIsProblemDetails404() throws Exception {
		mvc.perform(get("/api/does-not-exist"))
			.andExpect(status().isNotFound())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.status").value(404))
			.andExpect(jsonPath("$.detail").value("The requested resource was not found."));
	}

	@Test
	void validationErrorsListTheInvalidFieldsWithoutTheirValues() throws Exception {
		mvc.perform(post("/test/rides").contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"\",\"code\":\"private-value\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.title").value("Invalid request"))
			.andExpect(jsonPath("$.errors[*].field", containsInAnyOrder("name", "code")))
			.andExpect(content().string(not(containsString("private-value"))));
	}

	@Test
	void malformedJsonIsProblemDetails400() throws Exception {
		mvc.perform(post("/test/rides").contentType(MediaType.APPLICATION_JSON).content("{not json"))
			.andExpect(status().isBadRequest())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.status").value(400));
	}

	@Test
	void wrongMethodIsProblemDetails405() throws Exception {
		mvc.perform(delete("/test/rides"))
			.andExpect(status().isMethodNotAllowed())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
	}

	@Test
	void unexpectedErrorsAreGeneric500WithoutInternals() throws Exception {
		mvc.perform(get("/test/boom"))
			.andExpect(status().isInternalServerError())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.detail").value("Something went wrong. Please try again later."))
			.andExpect(content().string(not(containsString("hunter2"))))
			.andExpect(content().string(not(containsString("IllegalStateException"))));
	}

}
