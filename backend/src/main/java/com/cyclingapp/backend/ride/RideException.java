package com.cyclingapp.backend.ride;

import java.net.URI;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/**
 * Problem Details of the ride endpoints. Messages are fixed text: never ride names,
 * coordinates or other input.
 */
class RideException extends ErrorResponseException {

	static final URI NOT_RIDE_ADMIN = URI.create("urn:cycling:problem:not-ride-admin");

	static final URI RIDE_NOT_EDITABLE = URI.create("urn:cycling:problem:ride-not-editable");

	static final URI RIDE_NOT_DRAFT = URI.create("urn:cycling:problem:ride-not-draft");

	static final URI RIDE_NOT_PUBLISHED = URI.create("urn:cycling:problem:ride-not-published");

	static final URI LIMIT_BELOW_PARTICIPANTS = URI.create("urn:cycling:problem:limit-below-participants");

	static final URI ADULT_CONFIRMATION_REQUIRED = URI.create("urn:cycling:problem:adult-confirmation-required");

	static final URI AGE_RATING_CHANGE_BLOCKED = URI.create("urn:cycling:problem:age-rating-change-blocked");

	static final URI HANDOVER_TARGET_INVALID = URI.create("urn:cycling:problem:handover-target-invalid");

	private RideException(HttpStatus status, ProblemDetail problem) {
		super(status, problem, null);
	}

	private static RideException of(HttpStatus status, URI type, String title, String detail) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
		if (type != null) {
			problem.setType(type);
		}
		problem.setTitle(title);
		return new RideException(status, problem);
	}

	/**
	 * The ride does not exist or the rider may not see it. All cases look the same, so
	 * nobody can find out which drafts or invite-only rides exist.
	 */
	static RideException notFound() {
		return of(HttpStatus.NOT_FOUND, null, "Not Found", "The ride was not found.");
	}

	static RideException notRideAdmin() {
		return of(HttpStatus.FORBIDDEN, NOT_RIDE_ADMIN, "Not the ride admin", "Only the ride admin can do this.");
	}

	static RideException cancelled() {
		return of(HttpStatus.CONFLICT, RIDE_NOT_EDITABLE, "Ride cannot be changed", "The ride has been cancelled.");
	}

	static RideException started() {
		return of(HttpStatus.CONFLICT, RIDE_NOT_EDITABLE, "Ride cannot be changed", "The ride has already started.");
	}

	static RideException notDraft() {
		return of(HttpStatus.CONFLICT, RIDE_NOT_DRAFT, "Ride is not a draft",
				"Only draft rides can be published or deleted. Cancel a published ride instead.");
	}

	static RideException notPublished() {
		return of(HttpStatus.CONFLICT, RIDE_NOT_PUBLISHED, "Ride is not published",
				"Only published rides can be cancelled. Delete a draft instead.");
	}

	static RideException limitBelowParticipants() {
		return of(HttpStatus.CONFLICT, LIMIT_BELOW_PARTICIPANTS, "Limit below participants",
				"The participant limit cannot be lower than the number of riders who already have a place.");
	}

	static RideException adultConfirmationRequired() {
		return of(HttpStatus.FORBIDDEN, ADULT_CONFIRMATION_REQUIRED, "18+ confirmation required",
				"This ride is rated 18+. Confirm that you are 18 or older to create or publish it.");
	}

	static RideException ageRatingChangeBlocked() {
		return of(HttpStatus.CONFLICT, AGE_RATING_CHANGE_BLOCKED, "Age rating change blocked",
				"This route change would make the ride 18+, but riders who have not confirmed being 18 or older "
						+ "have a place on it.");
	}

	static RideException handoverTargetInvalid() {
		return of(HttpStatus.CONFLICT, HANDOVER_TARGET_INVALID, "Cannot hand over",
				"The ride can only be handed over to another confirmed participant.");
	}

	/**
	 * Missing or invalid fields, in the same format as request validation errors (field
	 * names and fixed messages, never the values).
	 */
	static RideException invalid(List<Map<String, String>> errors) {
		RideException ex = of(HttpStatus.BAD_REQUEST, null, "Invalid request",
				"The ride has invalid or missing fields.");
		ex.getBody().setProperty("errors", errors);
		return ex;
	}

}
