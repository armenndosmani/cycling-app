package com.cyclingapp.backend.web;

import java.io.IOException;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

/**
 * Writes RFC 9457 Problem Details from places outside Spring MVC (security filters),
 * matching the format of {@link ApiExceptionHandler}.
 */
public final class ProblemResponses {

	private ProblemResponses() {
	}

	/**
	 * {@code detail} must be a fixed message, never user input: it is written without
	 * JSON escaping.
	 */
	public static void write(HttpServletResponse response, HttpStatus status, String detail) throws IOException {
		response.setStatus(status.value());
		response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
		response.getWriter()
			.write("""
					{"type":"about:blank","title":"%s","status":%d,"detail":"%s"}""".formatted(status.getReasonPhrase(),
					status.value(), detail));
	}

}
