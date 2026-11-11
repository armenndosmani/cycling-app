package com.cyclingapp.backend.auth;

import java.time.Instant;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deletes data that is no longer needed: expired email codes, ended sessions and refresh
 * tokens older than their validity. Runs every hour.
 */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
class AuthCleanup {

	private final EmailCodeRepository codes;

	private final SessionRepository sessions;

	private final RefreshTokenRepository refreshTokens;

	AuthCleanup(EmailCodeRepository codes, SessionRepository sessions, RefreshTokenRepository refreshTokens) {
		this.codes = codes;
		this.sessions = sessions;
		this.refreshTokens = refreshTokens;
	}

	@Scheduled(initialDelayString = "PT1M", fixedDelayString = "PT1H")
	@Transactional
	public void deleteExpired() {
		Instant now = Instant.now();
		Instant cutoff = now.minus(SessionService.REFRESH_TOKEN_VALIDITY);
		codes.deleteExpired(now);
		refreshTokens.deleteCreatedBefore(cutoff);
		sessions.deleteEnded(cutoff);
	}

}
