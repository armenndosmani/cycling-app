package com.cyclingapp.backend.auth;

import org.springframework.http.HttpStatus;
import org.springframework.web.ErrorResponseException;

/** A wrong, expired or used email code. One message for all cases. */
public class InvalidCodeException extends ErrorResponseException {

	public InvalidCodeException() {
		super(HttpStatus.BAD_REQUEST, AuthProblems.of(HttpStatus.BAD_REQUEST, AuthProblems.INVALID_CODE, "Invalid code",
				"The code is wrong or no longer valid. Check it or request a new code."), null);
	}

}
