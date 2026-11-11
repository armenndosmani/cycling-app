package com.cyclingapp.backend.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/**
 * The code is correct but no account exists yet: the rider must confirm being 16 or older
 * and accept the current terms. The code stays valid so the app can resubmit.
 */
public class RegistrationRequiredException extends ErrorResponseException {

	public RegistrationRequiredException(String termsVersion) {
		super(HttpStatus.FORBIDDEN, problem(termsVersion), null);
	}

	private static ProblemDetail problem(String termsVersion) {
		ProblemDetail problem = AuthProblems.of(HttpStatus.FORBIDDEN, AuthProblems.REGISTRATION_REQUIRED,
				"Registration required",
				"Confirm that you are 16 or older and accept the terms of use and privacy notice to create an account.");
		problem.setProperty("termsVersion", termsVersion);
		return problem;
	}

}
