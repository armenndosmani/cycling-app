package com.cyclingapp.backend.auth;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** A one-time email code, stored only as a keyed hash. Created by an upsert query. */
@Entity
@Table(name = "email_codes")
public class EmailCodeEntity {

	@Id
	private UUID id;

	@Column(nullable = false)
	private String email;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private CodePurpose purpose;

	@Column(name = "code_hash", nullable = false)
	private String codeHash;

	@Column(name = "expires_at", nullable = false)
	private Instant expiresAt;

	@Column(nullable = false)
	private int attempts;

	@Column(nullable = false)
	private boolean consumed;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected EmailCodeEntity() {
	}

	String getCodeHash() {
		return codeHash;
	}

	boolean isUsable(Instant now, int maxAttempts) {
		return !consumed && attempts < maxAttempts && now.isBefore(expiresAt);
	}

	void recordWrongAttempt(int maxAttempts) {
		attempts++;
		if (attempts >= maxAttempts) {
			consumed = true;
		}
	}

	void consume() {
		consumed = true;
	}

}
