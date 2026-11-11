package com.cyclingapp.backend.route;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import com.cyclingapp.backend.account.AccountDeletionHook;
import com.cyclingapp.backend.geo.Discipline;
import com.cyclingapp.backend.geo.GeoPoint;
import com.cyclingapp.backend.geo.RouteResult;
import com.cyclingapp.backend.geo.RouteResult.LineString;
import com.cyclingapp.backend.geo.RouteResult.SurfaceShare;
import com.cyclingapp.backend.geo.RoutingService;
import com.cyclingapp.backend.route.SavedRouteRepository.RouteSummary;
import com.cyclingapp.backend.route.SavedRouteRepository.StoredRoute;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Saved routes: private drafts, visible only to their owner. The server calculates the
 * route itself when a route is saved or its points or discipline change, so stored
 * distance, elevation and geometry always come from our routing engine. Viewing a saved
 * route never recalculates it.
 */
@Service
public class SavedRouteService implements AccountDeletionHook {

	private static final TypeReference<List<GeoPoint>> POINTS = new TypeReference<>() {
	};

	private static final TypeReference<List<double[]>> PROFILE = new TypeReference<>() {
	};

	private static final TypeReference<List<SurfaceShare>> SURFACES = new TypeReference<>() {
	};

	private final SavedRouteRepository routes;

	private final RoutingService routing;

	private final JsonMapper json;

	SavedRouteService(SavedRouteRepository routes, RoutingService routing, JsonMapper json) {
		this.routes = routes;
		this.routing = routing;
		this.json = json;
	}

	public SavedRoute create(UUID userId, RouteInput input) {
		RouteResult result = routing.calculate(input.discipline(), input.points());
		Instant now = now();
		StoredRoute route = stored(UUID.randomUUID(), input, result, now, now);
		routes.insert(userId, route);
		return toSavedRoute(route);
	}

	/**
	 * Replaces name, note, discipline and points. Recalculates only if the points or the
	 * discipline changed, so renaming works even while routing is unavailable.
	 * @throws SavedRouteNotFoundException if the route does not exist or is not the
	 * rider's
	 */
	public SavedRoute update(UUID userId, UUID id, RouteInput input) {
		SavedRoute existing = get(userId, id);
		RouteResult result = (existing.discipline() == input.discipline()
				&& samePoints(existing.points(), input.points()))
						? new RouteResult(existing.geometry(), existing.distanceMeters(), existing.ascendMeters(),
								existing.elevationProfile(), existing.surfaces())
						: routing.calculate(input.discipline(), input.points());
		StoredRoute route = stored(id, input, result, existing.createdAt(), now());
		if (!routes.update(userId, route)) {
			// Deleted in the meantime
			throw new SavedRouteNotFoundException();
		}
		return toSavedRoute(route);
	}

	/**
	 * @throws SavedRouteNotFoundException if the route does not exist or is not the
	 * rider's
	 */
	public SavedRoute get(UUID userId, UUID id) {
		return routes.find(userId, id).map(this::toSavedRoute).orElseThrow(SavedRouteNotFoundException::new);
	}

	public List<RouteSummary> list(UUID userId) {
		return routes.list(userId);
	}

	/**
	 * @throws SavedRouteNotFoundException if the route does not exist or is not the
	 * rider's
	 */
	public void delete(UUID userId, UUID id) {
		if (!routes.delete(userId, id)) {
			throw new SavedRouteNotFoundException();
		}
	}

	@Override
	public void deleteAccountData(UUID userId) {
		routes.deleteAll(userId);
	}

	private StoredRoute stored(UUID id, RouteInput input, RouteResult result, Instant createdAt, Instant updatedAt) {
		return new StoredRoute(id, input.name(), input.note(), input.discipline().name(),
				json.writeValueAsString(input.points()), json.writeValueAsString(result.geometry()),
				result.distanceMeters(), result.ascendMeters(),
				(result.elevationProfile() != null) ? json.writeValueAsString(result.elevationProfile()) : null,
				json.writeValueAsString(result.surfaces()), createdAt, updatedAt);
	}

	private SavedRoute toSavedRoute(StoredRoute route) {
		return new SavedRoute(route.id(), route.name(), route.note(), Discipline.valueOf(route.discipline()),
				json.readValue(route.pointsJson(), POINTS), json.readValue(route.geometryJson(), LineString.class),
				route.distanceMeters(), route.ascendMeters(),
				(route.elevationProfileJson() != null) ? json.readValue(route.elevationProfileJson(), PROFILE) : null,
				json.readValue(route.surfacesJson(), SURFACES), route.createdAt(), route.updatedAt());
	}

	private static boolean samePoints(List<GeoPoint> a, List<GeoPoint> b) {
		if (a.size() != b.size()) {
			return false;
		}
		for (int i = 0; i < a.size(); i++) {
			if (Double.compare(a.get(i).lat(), b.get(i).lat()) != 0
					|| Double.compare(a.get(i).lon(), b.get(i).lon()) != 0) {
				return false;
			}
		}
		return true;
	}

	/** Microseconds, like the database stores them. */
	private static Instant now() {
		return Instant.now().truncatedTo(ChronoUnit.MICROS);
	}

	/** What the rider saves; the route itself is calculated by the server. */
	public record RouteInput(String name, String note, Discipline discipline, List<GeoPoint> points) {

	}

	public record SavedRoute(UUID id, String name, String note, Discipline discipline, List<GeoPoint> points,
			LineString geometry, double distanceMeters, Double ascendMeters, List<double[]> elevationProfile,
			List<SurfaceShare> surfaces, Instant createdAt, Instant updatedAt) {

	}

}
