package com.cyclingapp.backend.auth;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import javax.crypto.SecretKey;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Six-digit one-time codes sent by email: valid for 10 minutes, single use, at most 5
 * wrong attempts. Only a keyed hash (HMAC-SHA256 with a server-side key) is stored.
 */
@Service
public class EmailCodeService {

	public static final Duration VALIDITY = Duration.ofMinutes(10);

	static final int MAX_ATTEMPTS = 5;

	private final SecureRandom random = new SecureRandom();

	private final EmailCodeRepository codes;

	private final SecretKey hashKey;

	EmailCodeService(EmailCodeRepository codes, AuthProperties properties) {
		this.codes = codes;
		this.hashKey = Hashing.deriveKey(properties.signingKey(), "email-code");
	}

	/**
	 * Creates a new code for the address, replacing any previous one.
	 * @return the plain code, to be sent by email and never stored or logged
	 */
	@Transactional
	public String create(String email, CodePurpose purpose) {
		String code = "%06d".formatted(random.nextInt(1_000_000));
		Instant now = Instant.now();
		codes.upsert(UUID.randomUUID(), email, purpose.name(), hash(email, purpose, code), now.plus(VALIDITY), now);
		return code;
	}

	/**
	 * Checks a code inside the calling transaction. A wrong code counts as an attempt. A
	 * correct code is returned locked but not consumed yet: the caller consumes it.
	 */
	@Transactional(propagation = Propagation.MANDATORY)
	public Optional<EmailCodeEntity> findValid(String email, CodePurpose purpose, String code) {
		EmailCodeEntity entity = codes.findByEmailAndPurpose(email, purpose).orElse(null);
		if (entity == null || !entity.isUsable(Instant.now(), MAX_ATTEMPTS)) {
			return Optional.empty();
		}
		if (!Hashing.matches(entity.getCodeHash(), hash(email, purpose, code))) {
			entity.recordWrongAttempt(MAX_ATTEMPTS);
			return Optional.empty();
		}
		return Optional.of(entity);
	}

	@Transactional(propagation = Propagation.MANDATORY)
	public void consume(EmailCodeEntity code) {
		code.consume();
	}

	@Transactional(propagation = Propagation.MANDATORY)
	public void deleteAll(String email) {
		codes.deleteAllByEmail(email);
	}

	private String hash(String email, CodePurpose purpose, String code) {
		return Hashing.hmacSha256Hex(hashKey, purpose.name() + "\n" + email + "\n" + code);
	}

}
