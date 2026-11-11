package com.cyclingapp.backend.auth;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sessions and their tokens. The access token is a signed JWT (HS256, 15 minutes) whose
 * {@code sid} claim names the session; every request checks that the session is still
 * active, so signing out takes effect immediately. The refresh token is a random 256-bit
 * value, stored only as a SHA-256 hash, valid 60 days and usable once: each refresh
 * returns a new pair, and reusing an old refresh token revokes the whole session.
 */
@Service
public class SessionService {

	public static final Duration ACCESS_TOKEN_VALIDITY = Duration.ofMinutes(15);

	public static final Duration REFRESH_TOKEN_VALIDITY = Duration.ofDays(60);

	static final String ISSUER = "cycling-app";

	static final String SESSION_CLAIM = "sid";

	private final SecureRandom random = new SecureRandom();

	private final SessionRepository sessions;

	private final RefreshTokenRepository refreshTokens;

	private final JwtEncoder jwtEncoder;

	SessionService(SessionRepository sessions, RefreshTokenRepository refreshTokens, JwtEncoder jwtEncoder) {
		this.sessions = sessions;
		this.refreshTokens = refreshTokens;
		this.jwtEncoder = jwtEncoder;
	}

	/** Starts a new session for a rider who has just signed in. */
	@Transactional
	public TokenPair start(UUID userId) {
		Instant now = Instant.now();
		SessionEntity session = sessions.save(new SessionEntity(userId, now));
		return issueTokens(session, now);
	}

	/**
	 * Exchanges a refresh token for a new pair.
	 * @return empty if the token is unknown, expired, already used or its session ended
	 */
	@Transactional
	public Optional<TokenPair> refresh(String refreshToken) {
		Instant now = Instant.now();
		RefreshTokenEntity token = refreshTokens.findForUpdate(Hashing.sha256Hex(refreshToken)).orElse(null);
		if (token == null) {
			return Optional.empty();
		}
		SessionEntity session = sessions.findById(token.getSessionId()).orElse(null);
		if (session == null) {
			return Optional.empty();
		}
		if (token.isUsed()) {
			// Reuse of a rotated token: it may have been stolen, so end the whole session
			session.revoke(now);
			return Optional.empty();
		}
		if (token.isExpired(now) || !session.isActive(now)) {
			return Optional.empty();
		}
		token.markUsed(now);
		session.markUsed(now);
		return Optional.of(issueTokens(session, now));
	}

	/** Ends a session: its access and refresh tokens stop working immediately. */
	@Transactional
	public void revoke(UUID sessionId) {
		sessions.findById(sessionId).ifPresent(session -> session.revoke(Instant.now()));
	}

	public boolean isActive(UUID sessionId, UUID userId) {
		return sessions.existsByIdAndUserIdAndRevokedAtIsNullAndLastUsedAtAfter(sessionId, userId,
				Instant.now().minus(REFRESH_TOKEN_VALIDITY));
	}

	private TokenPair issueTokens(SessionEntity session, Instant now) {
		byte[] bytes = new byte[32];
		random.nextBytes(bytes);
		String refreshToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		refreshTokens.save(new RefreshTokenEntity(Hashing.sha256Hex(refreshToken), session.getId(), now));

		JwtClaimsSet claims = JwtClaimsSet.builder()
			.issuer(ISSUER)
			.subject(session.getUserId().toString())
			.issuedAt(now)
			.expiresAt(now.plus(ACCESS_TOKEN_VALIDITY))
			.claim(SESSION_CLAIM, session.getId().toString())
			.build();
		JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
		String accessToken = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
		return new TokenPair(accessToken, refreshToken, ACCESS_TOKEN_VALIDITY.toSeconds());
	}

	/** A new access token and refresh token. */
	public record TokenPair(String accessToken, String refreshToken, long accessTokenExpiresIn) {

		@Override
		public String toString() {
			return "TokenPair[***]";
		}

	}

}
