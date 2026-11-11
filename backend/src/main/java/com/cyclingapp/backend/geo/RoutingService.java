package com.cyclingapp.backend.geo;

import java.util.List;
import java.util.Map;
import java.util.Set;

import com.cyclingapp.backend.geo.GeoExceptions.RouteNotFoundException;
import com.cyclingapp.backend.geo.GeoExceptions.RoutingUnavailableException;
import com.cyclingapp.backend.geo.RouteCalculation.SurfaceInterval;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Calculates cycling routes with the self-hosted GraphHopper server. Never logs
 * coordinates or GraphHopper's error messages (they contain coordinates).
 */
@Service
public class RoutingService {

	/** Start, up to 25 waypoints and destination (docs/specs/route-planner.md). */
	public static final int MIN_POINTS = 2;

	public static final int MAX_POINTS = 27;

	private static final Logger log = LoggerFactory.getLogger(RoutingService.class);

	/** GraphHopper errors that mean "no route between these points". */
	private static final Set<String> NOT_FOUND_ERRORS = Set.of(
			"com.graphhopper.util.exceptions.ConnectionNotFoundException",
			"com.graphhopper.util.exceptions.PointNotFoundException",
			"com.graphhopper.util.exceptions.PointOutOfBoundsException",
			"com.graphhopper.util.exceptions.PointDistanceExceededException",
			"com.graphhopper.util.exceptions.MaximumNodesExceededException");

	private final RestClient graphhopper;

	RoutingService(@Qualifier("graphhopperClient") RestClient graphhopper) {
		this.graphhopper = graphhopper;
	}

	/**
	 * @throws RouteNotFoundException if no route exists for this discipline
	 * @throws RoutingUnavailableException if GraphHopper is unreachable, too slow or
	 * fails
	 */
	public RouteResult calculate(Discipline discipline, List<GeoPoint> points) {
		GhRequest request = new GhRequest(discipline.profile(),
				points.stream().map(point -> new double[] { point.lon(), point.lat() }).toList(), false, true, false,
				List.of("surface"));
		GhResponse response;
		try {
			response = graphhopper.post()
				.uri("/route")
				.contentType(MediaType.APPLICATION_JSON)
				.body(request)
				.retrieve()
				.body(GhResponse.class);
		}
		catch (HttpClientErrorException ex) {
			if (isNotFound(ex)) {
				throw new RouteNotFoundException();
			}
			log.warn("GraphHopper rejected a route request: HTTP {}", ex.getStatusCode().value());
			throw new RoutingUnavailableException();
		}
		catch (RestClientException ex) {
			// Only the exception type: messages can contain the request
			log.warn("GraphHopper is unavailable: {}", ex.getClass().getSimpleName());
			throw new RoutingUnavailableException();
		}
		if (response == null || response.paths() == null || response.paths().isEmpty()
				|| response.paths().getFirst().points() == null
				|| response.paths().getFirst().points().coordinates() == null
				|| response.paths().getFirst().points().coordinates().size() < 2) {
			log.warn("GraphHopper returned a route without geometry");
			throw new RoutingUnavailableException();
		}
		GhPath path = response.paths().getFirst();
		return RouteCalculation.of(path.points().coordinates(), path.distance(),
				(path.ascend() != null) ? path.ascend() : 0, surfaceIntervals(path));
	}

	private static boolean isNotFound(HttpClientErrorException ex) {
		try {
			GhError error = ex.getResponseBodyAs(GhError.class);
			return error != null && error.hints() != null
					&& error.hints().stream().anyMatch(hint -> NOT_FOUND_ERRORS.contains(hint.details()));
		}
		catch (RuntimeException parseError) {
			return false;
		}
	}

	private static List<SurfaceInterval> surfaceIntervals(GhPath path) {
		if (path.details() == null || path.details().get("surface") == null) {
			return List.of();
		}
		return path.details()
			.get("surface")
			.stream()
			.filter(entry -> entry.size() == 3)
			.map(entry -> new SurfaceInterval(((Number) entry.get(0)).intValue(), ((Number) entry.get(1)).intValue(),
					String.valueOf(entry.get(2))))
			.toList();
	}

	record GhRequest(String profile, List<double[]> points, boolean points_encoded, boolean elevation,
			boolean instructions, List<String> details) {

	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	record GhResponse(List<GhPath> paths) {

	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	record GhPath(double distance, Double ascend, GhLineString points, Map<String, List<List<Object>>> details) {

	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	record GhLineString(List<double[]> coordinates) {

	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	record GhError(List<GhHint> hints) {

	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	record GhHint(String details) {

	}

}
