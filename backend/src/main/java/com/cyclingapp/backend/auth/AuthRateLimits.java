package com.cyclingapp.backend.auth;

import java.time.Duration;
import java.util.List;

import org.springframework.stereotype.Component;

/** The rate limits of the sign-in endpoints (docs/specs/accounts.md). */
@Component
public class AuthRateLimits {

	static final int CODES_PER_EMAIL = 3;

	static final Duration CODES_PER_EMAIL_PERIOD = Duration.ofMinutes(15);

	static final int CODES_PER_IP = 20;

	static final Duration CODES_PER_IP_PERIOD = Duration.ofHours(1);

	static final int VERIFICATIONS_PER_IP = 30;

	static final Duration VERIFICATIONS_PER_IP_PERIOD = Duration.ofMinutes(15);

	private final RateLimiter limiter;

	AuthRateLimits(RateLimiter limiter) {
		this.limiter = limiter;
	}

	/**
	 * Requesting an email code.
	 * @throws RateLimitedException if the address or the IP address is over its limit
	 */
	public void checkCodeRequest(CodePurpose purpose, String email, String ip) {
		check(List.of(new RateLimiter.Limit("code:" + purpose + ":" + email, CODES_PER_EMAIL, CODES_PER_EMAIL_PERIOD),
				new RateLimiter.Limit("code-ip:" + ip, CODES_PER_IP, CODES_PER_IP_PERIOD)));
	}

	/**
	 * Verifying an email code. Each code also allows only 5 wrong attempts.
	 * @throws RateLimitedException if the IP address is over its limit
	 */
	public void checkVerification(String ip) {
		check(List.of(new RateLimiter.Limit("verify-ip:" + ip, VERIFICATIONS_PER_IP, VERIFICATIONS_PER_IP_PERIOD)));
	}

	private void check(List<RateLimiter.Limit> limits) {
		limiter.tryAcquire(limits).ifPresent(retryAfter -> {
			throw new RateLimitedException(retryAfter);
		});
	}

}
