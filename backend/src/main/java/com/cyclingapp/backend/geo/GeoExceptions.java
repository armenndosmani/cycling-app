package com.cyclingapp.backend.geo;

import java.net.URI;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/**
 * Problem Details of routing and place search. Messages are fixed text: never
 * coordinates, search terms or messages of the routing or search server.
 */
public final class GeoExceptions {

	static final URI ROUTE_NOT_FOUND = URI.create("urn:cycling:problem:route-not-found");

	static final URI ROUTING_UNAVAILABLE = URI.create("urn:cycling:problem:routing-unavailable");

	static final URI PLACE_SEARCH_UNAVAILABLE = URI.create("urn:cycling:problem:place-search-unavailable");

	private GeoExceptions() {
	}

	private static ProblemDetail problem(HttpStatus status, URI type, String title, String detail) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
		problem.setType(type);
		problem.setTitle(title);
		return problem;
	}

	/** No route between the points for the chosen discipline: 422. */
	public static class RouteNotFoundException extends ErrorResponseException {

		RouteNotFoundException() {
			super(HttpStatus.UNPROCESSABLE_CONTENT,
					problem(HttpStatus.UNPROCESSABLE_CONTENT, ROUTE_NOT_FOUND, "No route found",
							"No route could be found between these points for this discipline. "
									+ "Try moving a point closer to a road or path."),
					null);
		}

	}

	/** GraphHopper is unreachable, too slow or failed: 503. */
	public static class RoutingUnavailableException extends ErrorResponseException {

		RoutingUnavailableException() {
			super(HttpStatus.SERVICE_UNAVAILABLE, problem(HttpStatus.SERVICE_UNAVAILABLE, ROUTING_UNAVAILABLE,
					"Routing unavailable", "Routes cannot be calculated right now. Please try again."), null);
		}

	}

	/** Photon is unreachable, too slow or failed: 503. */
	public static class PlaceSearchUnavailableException extends ErrorResponseException {

		PlaceSearchUnavailableException() {
			super(HttpStatus.SERVICE_UNAVAILABLE, problem(HttpStatus.SERVICE_UNAVAILABLE, PLACE_SEARCH_UNAVAILABLE,
					"Place search unavailable", "Place search is not available right now. Please try again."), null);
		}

	}

}
