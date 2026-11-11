package com.cyclingapp.backend.geo;

import java.util.List;

/**
 * A calculated route.
 *
 * @param geometry GeoJSON LineString, coordinates {@code [lon, lat, ele]} ({@code ele}
 * missing when there is no elevation data)
 * @param distanceMeters total distance
 * @param ascendMeters total elevation gain, null without elevation data
 * @param elevationProfile {@code [distanceMeters, elevationMeters]} pairs along the route
 * (at most {@value RouteCalculation#MAX_PROFILE_POINTS}), null without elevation data
 * @param surfaces meters per OSM surface value, longest first ("unknown" where not
 * mapped)
 */
public record RouteResult(LineString geometry, double distanceMeters, Double ascendMeters,
		List<double[]> elevationProfile, List<SurfaceShare> surfaces) {

	public record LineString(String type, List<double[]> coordinates) {

		public LineString(List<double[]> coordinates) {
			this("LineString", coordinates);
		}

		public boolean hasElevation() {
			return !coordinates.isEmpty() && coordinates.getFirst().length >= 3;
		}

	}

	public record SurfaceShare(String surface, double meters) {

	}

}
