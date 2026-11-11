package com.cyclingapp.backend.auth;

import java.util.UUID;

import javax.crypto.SecretKey;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

/** Signs and validates access tokens (HS256 with {@code app.auth.jwt-secret}). */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(AuthProperties.class)
class JwtConfig {

	@Bean
	JwtEncoder jwtEncoder(AuthProperties properties) {
		return NimbusJwtEncoder.withSecretKey(properties.signingKey()).algorithm(MacAlgorithm.HS256).build();
	}

	@Bean
	JwtDecoder jwtDecoder(AuthProperties properties, SessionService sessions) {
		SecretKey key = properties.signingKey();
		NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
		decoder.setJwtValidator(JwtValidators.createDefaultWithValidators(new JwtIssuerValidator(SessionService.ISSUER),
				activeSession(sessions)));
		return decoder;
	}

	/** Rejects access tokens of sessions that were signed out, revoked or deleted. */
	private static OAuth2TokenValidator<Jwt> activeSession(SessionService sessions) {
		OAuth2Error invalid = new OAuth2Error(OAuth2ErrorCodes.INVALID_TOKEN, "The session has ended.", null);
		return jwt -> {
			try {
				UUID userId = UUID.fromString(jwt.getSubject());
				UUID sessionId = UUID.fromString(jwt.getClaimAsString(SessionService.SESSION_CLAIM));
				return sessions.isActive(sessionId, userId) ? OAuth2TokenValidatorResult.success()
						: OAuth2TokenValidatorResult.failure(invalid);
			}
			catch (IllegalArgumentException | NullPointerException ex) {
				return OAuth2TokenValidatorResult.failure(invalid);
			}
		};
	}

}
