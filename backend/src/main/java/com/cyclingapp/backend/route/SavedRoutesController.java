package com.cyclingapp.backend.route;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import com.cyclingapp.backend.auth.CurrentUser;
import com.cyclingapp.backend.geo.Discipline;
import com.cyclingapp.backend.geo.GeoPoint;
import com.cyclingapp.backend.geo.RoutingService;
import com.cyclingapp.backend.route.SavedRouteRepository.RouteSummary;
import com.cyclingapp.backend.route.SavedRouteService.RouteInput;
import com.cyclingapp.backend.route.SavedRouteService.SavedRoute;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The signed-in rider's saved routes (private drafts). Needs an access token; another
 * rider's route answers 404.
 */
@RestController
@RequestMapping("/api/routes")
class SavedRoutesController {

	private final SavedRouteService routes;

	SavedRoutesController(SavedRouteService routes) {
		this.routes = routes;
	}

	@GetMapping
	List<RouteSummary> list(@AuthenticationPrincipal Jwt jwt) {
		return routes.list(CurrentUser.userId(jwt));
	}

	@PostMapping
	ResponseEntity<SavedRoute> create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SaveRouteRequest request) {
		SavedRoute route = routes.create(CurrentUser.userId(jwt), request.toInput());
		return ResponseEntity.created(URI.create("/api/routes/" + route.id())).body(route);
	}

	@GetMapping("/{id}")
	SavedRoute get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
		return routes.get(CurrentUser.userId(jwt), id);
	}

	@PutMapping("/{id}")
	SavedRoute update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
			@Valid @RequestBody SaveRouteRequest request) {
		return routes.update(CurrentUser.userId(jwt), id, request.toInput());
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
		routes.delete(CurrentUser.userId(jwt), id);
	}

	/**
	 * A route to save. The route itself (geometry, distance, elevation, surfaces) is
	 * calculated by the server from the points; calculated values sent by the app are
	 * ignored.
	 */
	record SaveRouteRequest(
			@NotBlank @Size(max = 80) @Pattern(regexp = "[^\\p{Cntrl}]*",
					message = "must not contain control characters") String name,
			@Size(max = 1000) String note, @NotNull Discipline discipline,
			@NotNull @Size(min = RoutingService.MIN_POINTS,
					max = RoutingService.MAX_POINTS) List<@NotNull @Valid GeoPoint> points) {

		SaveRouteRequest {
			name = (name != null) ? name.strip() : null;
			note = (note != null && !note.isBlank()) ? note.strip() : null;
		}

		RouteInput toInput() {
			return new RouteInput(name, note, discipline, points);
		}

	}

}
