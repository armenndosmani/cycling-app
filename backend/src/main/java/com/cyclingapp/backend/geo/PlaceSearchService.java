package com.cyclingapp.backend.geo;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.cyclingapp.backend.geo.GeoExceptions.PlaceSearchUnavailableException;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Place search with the self-hosted Photon server. Search terms and positions are never
 * logged or stored.
 */
@Service
public class PlaceSearchService {

	public static final int MAX_RESULTS = 10;

	private static final Logger log = LoggerFactory.getLogger(PlaceSearchService.class);

	private final RestClient photon;

	PlaceSearchService(@Qualifier("photonClient") RestClient photon) {
		this.photon = photon;
	}

	/**
	 * @param bias optional position to prefer nearby results (e.g. the map centre)
	 * @throws PlaceSearchUnavailableException if Photon is unreachable, too slow or fails
	 */
	public List<Place> search(String query, GeoPoint bias) {
		PhotonResponse response;
		try {
			response = photon.get().uri(uri -> {
				// The search term as a URI variable, so characters like & and + are
				// encoded
				uri.path("/api").queryParam("q", "{q}").queryParam("limit", MAX_RESULTS).queryParam("lang", "en");
				if (bias != null) {
					uri.queryParam("lat", bias.lat()).queryParam("lon", bias.lon());
				}
				return uri.build(Map.of("q", query));
			}).retrieve().body(PhotonResponse.class);
		}
		catch (RestClientException ex) {
			// Only the exception type: messages can contain the URL with the search term
			log.warn("Photon is unavailable: {}", ex.getClass().getSimpleName());
			throw new PlaceSearchUnavailableException();
		}
		if (response == null || response.features() == null) {
			return List.of();
		}
		return response.features()
			.stream()
			.map(PlaceSearchService::toPlace)
			.filter(Objects::nonNull)
			.limit(MAX_RESULTS)
			.toList();
	}

	private static Place toPlace(Feature feature) {
		if (feature.geometry() == null || feature.geometry().coordinates() == null
				|| feature.geometry().coordinates().length < 2 || feature.properties() == null) {
			return null;
		}
		Map<String, Object> p = feature.properties();
		String street = join(" ", text(p, "street"), text(p, "housenumber"));
		String name = (text(p, "name") != null) ? text(p, "name") : street;
		if (name == null) {
			return null;
		}
		List<String> parts = new ArrayList<>();
		for (String part : new String[] { name, street, join(" ", text(p, "postcode"), text(p, "city")),
				text(p, "state"), text(p, "country") }) {
			if (part != null && !parts.contains(part)) {
				parts.add(part);
			}
		}
		double[] coordinates = feature.geometry().coordinates();
		return new Place(name, String.join(", ", parts), coordinates[1], coordinates[0]);
	}

	private static String text(Map<String, Object> properties, String key) {
		Object value = properties.get(key);
		return (value instanceof String s && !s.isBlank()) ? s.strip() : null;
	}

	private static String join(String separator, String first, String second) {
		if (first == null) {
			return second;
		}
		return (second == null) ? first : first + separator + second;
	}

	/**
	 * @param name the place's name, or street and house number for an address
	 * @param label name with address, city and country for display
	 */
	public record Place(String name, String label, double lat, double lon) {

	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	record PhotonResponse(List<Feature> features) {

	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	record Feature(PointGeometry geometry, Map<String, Object> properties) {

	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	record PointGeometry(double[] coordinates) {

	}

}
