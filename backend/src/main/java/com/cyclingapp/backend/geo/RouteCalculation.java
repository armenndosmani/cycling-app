package com.cyclingapp.backend.geo;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.cyclingapp.backend.geo.RouteResult.LineString;
import com.cyclingapp.backend.geo.RouteResult.SurfaceShare;

/**
 * Builds a {@link RouteResult} from GraphHopper's path: elevation profile and surface
 * breakdown along the coordinates.
 */
final class RouteCalculation {

	static final int MAX_PROFILE_POINTS = 300;

	private static final double EARTH_RADIUS_METERS = 6_371_000;

	private RouteCalculation() {
	}

	/**
	 * @param coordinates {@code [lon, lat]} or {@code [lon, lat, ele]}
	 * @param distanceMeters GraphHopper's distance (includes elevation changes)
	 * @param ascendMeters GraphHopper's elevation gain
	 * @param surfaceDetails GraphHopper path details: {@code [fromIndex, toIndex, value]}
	 */
	static RouteResult of(List<double[]> coordinates, double distanceMeters, double ascendMeters,
			List<SurfaceInterval> surfaceDetails) {
		LineString geometry = new LineString(coordinates);
		double[] along = cumulativeDistances(coordinates);
		// Scale flat distances so the profile and the surfaces add up to the route
		// distance
		double flat = along[along.length - 1];
		double scale = (flat > 0) ? distanceMeters / flat : 0;
		for (int i = 0; i < along.length; i++) {
			along[i] *= scale;
		}
		boolean elevation = geometry.hasElevation();
		return new RouteResult(geometry, round(distanceMeters), elevation ? round(ascendMeters) : null,
				elevation ? profile(coordinates, along) : null, surfaces(surfaceDetails, along));
	}

	private static double[] cumulativeDistances(List<double[]> coordinates) {
		double[] along = new double[Math.max(1, coordinates.size())];
		for (int i = 1; i < coordinates.size(); i++) {
			along[i] = along[i - 1] + haversine(coordinates.get(i - 1), coordinates.get(i));
		}
		return along;
	}

	/** Evenly picked points, always including the first and the last. */
	private static List<double[]> profile(List<double[]> coordinates, double[] along) {
		int count = Math.min(coordinates.size(), MAX_PROFILE_POINTS);
		List<double[]> profile = new ArrayList<>(count);
		for (int i = 0; i < count; i++) {
			int index = (count == 1) ? 0 : (int) Math.round((double) i * (coordinates.size() - 1) / (count - 1));
			profile.add(new double[] { round(along[index]), round(coordinates.get(index)[2]) });
		}
		return profile;
	}

	private static List<SurfaceShare> surfaces(List<SurfaceInterval> details, double[] along) {
		Map<String, Double> meters = new LinkedHashMap<>();
		for (SurfaceInterval interval : details) {
			int from = clamp(interval.from(), along.length);
			int to = clamp(interval.to(), along.length);
			String surface = (interval.value() == null || interval.value().equals("missing")) ? "unknown"
					: interval.value();
			meters.merge(surface, along[to] - along[from], Double::sum);
		}
		return meters.entrySet()
			.stream()
			.map(entry -> new SurfaceShare(entry.getKey(), round(entry.getValue())))
			.filter(share -> share.meters() > 0)
			.sorted(Comparator.comparingDouble(SurfaceShare::meters).reversed())
			.toList();
	}

	private static int clamp(int index, int length) {
		return Math.max(0, Math.min(index, length - 1));
	}

	private static double haversine(double[] a, double[] b) {
		double lat1 = Math.toRadians(a[1]);
		double lat2 = Math.toRadians(b[1]);
		double dLat = lat2 - lat1;
		double dLon = Math.toRadians(b[0] - a[0]);
		double h = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(dLon / 2), 2);
		return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
	}

	/** One decimal: enough for meters, keeps responses small. */
	private static double round(double value) {
		return Math.round(value * 10) / 10.0;
	}

	record SurfaceInterval(int from, int to, String value) {

	}

}
