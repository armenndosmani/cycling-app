package com.cyclingapp.backend.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Sliding-window rate limits, kept in memory only. This works for a single backend
 * instance; with several instances the limits apply per instance and would need a shared
 * store. Keys (email addresses, IP addresses) are forgotten as soon as their window has
 * passed, at most one hour later, and are never written anywhere.
 */
@Component
public class RateLimiter {

	private final Map<String, Window> windows = new HashMap<>();

	/**
	 * Records one request against all limits, or none if any limit is reached.
	 * @return empty if allowed, otherwise how long to wait before trying again
	 */
	public synchronized Optional<Duration> tryAcquire(List<Limit> limits) {
		Instant now = Instant.now();
		Duration retryAfter = Duration.ZERO;
		for (Limit limit : limits) {
			Window window = windows.computeIfAbsent(limit.key(), key -> new Window(limit.period()));
			window.prune(now);
			if (window.hits.size() >= limit.max()) {
				Duration wait = Duration.between(now, window.hits.peekFirst().plus(window.period));
				retryAfter = (wait.compareTo(retryAfter) > 0) ? wait : retryAfter;
			}
		}
		if (!retryAfter.isZero()) {
			return Optional.of(retryAfter);
		}
		for (Limit limit : limits) {
			windows.get(limit.key()).hits.addLast(now);
		}
		return Optional.empty();
	}

	/** Forgets keys whose window has passed. */
	@Scheduled(fixedDelayString = "PT5M")
	public synchronized void prune() {
		Instant now = Instant.now();
		Iterator<Window> iterator = windows.values().iterator();
		while (iterator.hasNext()) {
			Window window = iterator.next();
			window.prune(now);
			if (window.hits.isEmpty()) {
				iterator.remove();
			}
		}
	}

	/** At most {@code max} requests per {@code period} for one key. */
	public record Limit(String key, int max, Duration period) {
	}

	private static final class Window {

		private final Duration period;

		private final Deque<Instant> hits = new ArrayDeque<>();

		Window(Duration period) {
			this.period = period;
		}

		void prune(Instant now) {
			Instant start = now.minus(period);
			while (!hits.isEmpty() && !hits.peekFirst().isAfter(start)) {
				hits.removeFirst();
			}
		}

	}

}
