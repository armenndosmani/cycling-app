package com.cyclingapp.backend.auth;

import java.time.Duration;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.ErrorResponseException;

/** Too many requests: 429 with a {@code Retry-After} header in seconds. */
public class RateLimitedException extends ErrorResponseException {

	public RateLimitedException(Duration retryAfter) {
		super(HttpStatus.TOO_MANY_REQUESTS, AuthProblems.of(HttpStatus.TOO_MANY_REQUESTS, AuthProblems.RATE_LIMITED,
				"Too many requests", "Too many requests. Please try again later."), null);
		long seconds = Math.max(1, (retryAfter.toMillis() + 999) / 1000);
		getHeaders().set(HttpHeaders.RETRY_AFTER, Long.toString(seconds));
	}

}
