package com.cyclingapp.backend.auth;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** A sign-in session on one phone. No IP address or device data is stored. */
@Entity
@Table(name = "sessions")
public class SessionEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "user_id", nullable = false)
	private UUID userId;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "last_used_at", nullable = false)
	private Instant lastUsedAt;

	@Column(name = "revoked_at")
	private Instant revokedAt;

	protected SessionEntity() {
	}

	SessionEntity(UUID userId, Instant now) {
		this.userId = userId;
		this.createdAt = now;
		this.lastUsedAt = now;
	}

	UUID getId() {
		return id;
	}

	UUID getUserId() {
		return userId;
	}

	boolean isActive(Instant now) {
		return revokedAt == null && lastUsedAt.plus(SessionService.REFRESH_TOKEN_VALIDITY).isAfter(now);
	}

	void markUsed(Instant now) {
		lastUsedAt = now;
	}

	void revoke(Instant now) {
		if (revokedAt == null) {
			revokedAt = now;
		}
	}

}
