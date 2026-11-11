package com.cyclingapp.backend.ride;

import java.net.URI;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import com.cyclingapp.backend.auth.CurrentUser;
import com.cyclingapp.backend.geo.Discipline;
import com.cyclingapp.backend.geo.GeoPoint;
import com.cyclingapp.backend.ride.RideService.AccessMode;
import com.cyclingapp.backend.ride.RideService.Pace;
import com.cyclingapp.backend.ride.RideService.Ride;
import com.cyclingapp.backend.ride.RideService.RideInput;
import com.cyclingapp.backend.ride.RideService.RideSummary;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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
import tools.jackson.core.JsonParser;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;
import tools.jackson.databind.annotation.JsonDeserialize;

/**
 * Ride events. Needs an access token. What a rider sees depends on their role on the ride
 * (see {@link RideService}); rides they may not see answer 404, admin actions by other
 * riders 403.
 */
@RestController
@RequestMapping("/api/rides")
class RidesController {

	private final RideService rides;

	RidesController(RideService rides) {
		this.rides = rides;
	}

	@PostMapping
	ResponseEntity<Ride> create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody RideRequest request) {
		Ride ride = rides.create(CurrentUser.userId(jwt), request.toInput());
		return ResponseEntity.created(URI.create("/api/rides/" + ride.id())).body(ride);
	}

	@GetMapping("/mine")
	List<RideSummary> mine(@AuthenticationPrincipal Jwt jwt) {
		return rides.mine(CurrentUser.userId(jwt));
	}

	@GetMapping("/{id}")
	Ride get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
		return rides.get(CurrentUser.userId(jwt), id);
	}

	@PutMapping("/{id}")
	Ride update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody RideRequest request) {
		return rides.update(CurrentUser.userId(jwt), id, request.toInput());
	}

	@PostMapping("/{id}/publish")
	Ride publish(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
		return rides.publish(CurrentUser.userId(jwt), id);
	}

	@PostMapping("/{id}/cancel")
	Ride cancel(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
			@Valid @RequestBody(required = false) CancelRequest request) {
		return rides.cancel(CurrentUser.userId(jwt), id, (request != null) ? request.message() : null);
	}

	@PostMapping("/{id}/handover")
	Ride handOver(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
			@Valid @RequestBody HandoverRequest request) {
		return rides.handOver(CurrentUser.userId(jwt), id, request.userId());
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
		rides.delete(CurrentUser.userId(jwt), id);
	}

	/**
	 * A ride as the admin edits it. Only the name is required for a draft; publishing
	 * checks the rest. Calculated route values are never accepted from the app: they come
	 * from the saved route given by {@code routeId}. A missing {@code routeId} keeps the
	 * ride's current route copy, {@code "routeId": null} removes it.
	 */
	record RideRequest(
			@NotBlank @Size(min = 3, max = 80) @Pattern(regexp = "[^\\p{Cntrl}]*",
					message = "must not contain control characters") String name,
			@Size(max = 2000) String description, LocalDate startDate,
			@Pattern(regexp = "([01]\\d|2[0-3]):[0-5]\\d", message = "must be a time like 07:30") String startTime,
			@Size(max = 64) String timeZone, @Valid GeoPoint meetingPoint, Discipline discipline, Pace pace,
			@Min(2) @Max(50) Integer participantLimit, AccessMode accessMode, RouteIdField routeId,
			@DecimalMin("1") @DecimalMax("500") Double targetDistanceKm) {

		RideRequest {
			name = (name != null) ? name.strip() : null;
			description = (description != null && !description.isBlank()) ? description.strip() : null;
			timeZone = (timeZone != null && !timeZone.isBlank()) ? timeZone.strip() : null;
		}

		RideInput toInput() {
			return new RideInput(name, description, startDate, (startTime != null) ? LocalTime.parse(startTime) : null,
					timeZone, meetingPoint, discipline, pace, participantLimit, accessMode,
					(routeId != null) ? routeId.value() : null, routeId != null && routeId.value() == null,
					targetDistanceKm);
		}

	}

	/**
	 * {@code routeId} as sent: the Java field is null when the property is missing, and a
	 * {@code RouteIdField} with a null value when it is {@code null} in the JSON.
	 */
	@JsonDeserialize(using = RouteIdField.Deserializer.class)
	record RouteIdField(UUID value) {

		static final class Deserializer extends ValueDeserializer<RouteIdField> {

			@Override
			public RouteIdField deserialize(JsonParser parser, DeserializationContext context) {
				return new RouteIdField(context.readValue(parser, UUID.class));
			}

			// "routeId": null
			@Override
			public RouteIdField getNullValue(DeserializationContext context) {
				return new RouteIdField(null);
			}

			// No routeId property
			@Override
			public Object getAbsentValue(DeserializationContext context) {
				return null;
			}

		}

	}

	record CancelRequest(@Size(max = 500) String message) {

		CancelRequest {
			message = (message != null && !message.isBlank()) ? message.strip() : null;
		}

	}

	record HandoverRequest(@NotNull UUID userId) {

	}

}
