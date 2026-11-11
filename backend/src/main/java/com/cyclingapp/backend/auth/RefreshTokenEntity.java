package com.cyclingapp.backend.auth;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.springframework.data.domain.Persistable;

/**
 * A refresh token of a session, stored only as a SHA-256 hash. Used tokens are kept so
 * that reusing one revokes the session.
 */
@Entity
@Table(name = "refresh_tokens")
public class RefreshTokenEntity implements Persistable<String> {

	@Id
	@Column(name = "token_hash")
	private String tokenHash;

	@Column(name = "session_id", nullable = false)
	private UUID sessionId;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "used_at")
	private Instant usedAt;

	private transient boolean isNew;

	protected RefreshTokenEntity() {
	}

	RefreshTokenEntity(String tokenHash, UUID sessionId, Instant now) {
		this.tokenHash = tokenHash;
		this.sessionId = sessionId;
		this.createdAt = now;
		this.isNew = true;
	}

	@Override
	public String getId() {
		return tokenHash;
	}

	@Override
	public boolean isNew() {
		return isNew;
	}

	UUID getSessionId() {
		return sessionId;
	}

	boolean isUsed() {
		return usedAt != null;
	}

	boolean isExpired(Instant now) {
		return !createdAt.plus(SessionService.REFRESH_TOKEN_VALIDITY).isAfter(now);
	}

	void markUsed(Instant now) {
		usedAt = now;
	}

}
