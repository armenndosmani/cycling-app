package com.cyclingapp.backend.auth;

import java.nio.charset.StandardCharsets;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Sign-in settings. The app refuses to start without a signing secret of at least 32
 * bytes; only the dev profile and the tests provide a fake one.
 *
 * @param jwtSecret HMAC secret for access tokens (HS256)
 */
@ConfigurationProperties("app.auth")
public record AuthProperties(String jwtSecret) {

	static final int MIN_SECRET_BYTES = 32;

	public AuthProperties {
		if (jwtSecret == null || jwtSecret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
			throw new IllegalStateException(
					"app.auth.jwt-secret must be set and at least " + MIN_SECRET_BYTES + " bytes long");
		}
	}

	SecretKey signingKey() {
		return new SecretKeySpec(jwtSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
	}

	@Override
	public String toString() {
		return "AuthProperties[jwtSecret=***]";
	}

}
