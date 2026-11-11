package com.cyclingapp.backend.auth;

import org.springframework.http.HttpStatus;
import org.springframework.web.ErrorResponseException;

/** An unknown, expired or reused refresh token, or a session that has ended. */
public class InvalidRefreshTokenException extends ErrorResponseException {

	public InvalidRefreshTokenException() {
		super(HttpStatus.UNAUTHORIZED, AuthProblems.of(HttpStatus.UNAUTHORIZED, null, "Unauthorized",
				"The session has ended. Please sign in again."), null);
	}

}
