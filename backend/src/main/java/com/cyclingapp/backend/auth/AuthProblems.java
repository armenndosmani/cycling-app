package com.cyclingapp.backend.auth;

import java.net.URI;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

/** Problem Details of the sign-in and account endpoints. Messages are fixed text. */
final class AuthProblems {

	static final URI INVALID_CODE = URI.create("urn:cycling:problem:invalid-code");

	static final URI REGISTRATION_REQUIRED = URI.create("urn:cycling:problem:registration-required");

	static final URI RATE_LIMITED = URI.create("urn:cycling:problem:rate-limited");

	private AuthProblems() {
	}

	static ProblemDetail of(HttpStatus status, URI type, String title, String detail) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
		if (type != null) {
			problem.setType(type);
		}
		problem.setTitle(title);
		return problem;
	}

}
