package com.cyclingapp.backend.geo;

import java.util.List;

import com.cyclingapp.backend.geo.PlaceSearchService.Place;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Place search for the route planner. Needs an access token. */
@RestController
class PlacesController {

	private final PlaceSearchService places;

	PlacesController(PlaceSearchService places) {
		this.places = places;
	}

	/**
	 * @param q 2 to 100 characters (after trimming)
	 * @param lat with {@code lon}: optional position to prefer nearby places
	 */
	@GetMapping("/api/places")
	List<Place> search(@RequestParam @NotBlank @Size(max = 100) String q,
			@RequestParam(required = false) @DecimalMin("-90") @DecimalMax("90") Double lat,
			@RequestParam(required = false) @DecimalMin("-180") @DecimalMax("180") Double lon) {
		String query = q.strip();
		if (query.length() < 2 || (lat == null) != (lon == null)) {
			throw new ErrorResponseException(HttpStatus.BAD_REQUEST, invalid(), null);
		}
		return places.search(query, (lat != null) ? new GeoPoint(lat, lon) : null);
	}

	private static ProblemDetail invalid() {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
				"The search needs 2 to 100 characters, and lat and lon together or not at all.");
		problem.setTitle("Invalid request");
		return problem;
	}

}
