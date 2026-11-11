package com.cyclingapp.backend.auth;

import java.util.UUID;

import org.springframework.security.oauth2.jwt.Jwt;

/** Reads the signed-in rider and session from a validated access token. */
public final class CurrentUser {

	private CurrentUser() {
	}

	public static UUID userId(Jwt jwt) {
		return UUID.fromString(jwt.getSubject());
	}

	public static UUID sessionId(Jwt jwt) {
		return UUID.fromString(jwt.getClaimAsString(SessionService.SESSION_CLAIM));
	}

}
