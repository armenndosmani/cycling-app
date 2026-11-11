package com.cyclingapp.backend.ride;

import java.time.Instant;
import java.time.ZoneOffset;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Retention of rides (docs/specs/ride-event-creation.md): 12 months after its start time
 * a ride is deleted together with its participants and route copy. Deleting is the
 * simplest complete anonymisation; nothing in the app needs old rides, and statistics can
 * be counted before deleting if they are ever needed. Drafts without a start time are
 * deleted 12 months after their last change. Runs every 6 hours.
 */
@Component
public class RideRetention {

	static final int RETENTION_MONTHS = 12;

	private final RideRepository rides;

	RideRetention(RideRepository rides) {
		this.rides = rides;
	}

	@Scheduled(initialDelayString = "PT5M", fixedDelayString = "PT6H")
	@Transactional
	public void deleteExpired() {
		rides.deleteOlderThan(Instant.now().atOffset(ZoneOffset.UTC).minusMonths(RETENTION_MONTHS).toInstant());
	}

}
