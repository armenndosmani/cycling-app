package com.cyclingapp.backend.geo;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Route calculation for the route planner. Needs an access token. Nothing is stored:
 * saving is {@code /api/routes}.
 */
@RestController
class RoutingController {

	private final RoutingService routing;

	RoutingController(RoutingService routing) {
		this.routing = routing;
	}

	@PostMapping("/api/routing/route")
	RouteResult route(@Valid @RequestBody RouteRequest request) {
		return routing.calculate(request.discipline(), request.points());
	}

	/**
	 * @param points start, up to 25 waypoints and destination; the destination may equal
	 * the start (a loop)
	 */
	record RouteRequest(@NotNull Discipline discipline, @NotNull @Size(min = RoutingService.MIN_POINTS,
			max = RoutingService.MAX_POINTS) List<@NotNull @Valid GeoPoint> points) {

	}

}
