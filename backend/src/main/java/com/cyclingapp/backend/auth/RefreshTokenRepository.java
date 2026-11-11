package com.cyclingapp.backend.auth;

import java.time.Instant;
import java.util.Optional;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface RefreshTokenRepository extends JpaRepository<RefreshTokenEntity, String> {

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select t from RefreshTokenEntity t where t.tokenHash = :tokenHash")
	Optional<RefreshTokenEntity> findForUpdate(@Param("tokenHash") String tokenHash);

	@Modifying
	@Query("delete from RefreshTokenEntity t where t.createdAt < :cutoff")
	int deleteCreatedBefore(@Param("cutoff") Instant cutoff);

}
