package com.cyclingapp.backend.auth;

import java.time.Instant;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface SessionRepository extends JpaRepository<SessionEntity, UUID> {

	boolean existsByIdAndUserIdAndRevokedAtIsNullAndLastUsedAtAfter(UUID id, UUID userId, Instant cutoff);

	@Modifying
	@Query("delete from SessionEntity s where s.revokedAt is not null or s.lastUsedAt < :cutoff")
	int deleteEnded(@Param("cutoff") Instant cutoff);

}
