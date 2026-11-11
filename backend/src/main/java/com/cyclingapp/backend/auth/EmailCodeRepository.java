package com.cyclingapp.backend.auth;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface EmailCodeRepository extends JpaRepository<EmailCodeEntity, UUID> {

	/** Stores a new code for the address and purpose, replacing any previous one. */
	@Modifying
	@Query(value = """
			insert into email_codes (id, email, purpose, code_hash, expires_at, attempts, consumed, created_at)
			values (:id, :email, :purpose, :codeHash, :expiresAt, 0, false, :createdAt)
			on conflict (email, purpose) do update set code_hash = excluded.code_hash,
				expires_at = excluded.expires_at, attempts = 0, consumed = false, created_at = excluded.created_at
			""", nativeQuery = true)
	void upsert(@Param("id") UUID id, @Param("email") String email, @Param("purpose") String purpose,
			@Param("codeHash") String codeHash, @Param("expiresAt") Instant expiresAt,
			@Param("createdAt") Instant createdAt);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	Optional<EmailCodeEntity> findByEmailAndPurpose(String email, CodePurpose purpose);

	@Modifying
	@Query("delete from EmailCodeEntity c where c.email = :email")
	void deleteAllByEmail(@Param("email") String email);

	@Modifying
	@Query("delete from EmailCodeEntity c where c.expiresAt < :now")
	int deleteExpired(@Param("now") Instant now);

}
