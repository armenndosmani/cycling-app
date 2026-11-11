package com.cyclingapp.backend.route;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/**
 * The route does not exist or belongs to another rider. Both cases look the same, so
 * nobody can find out which route ids exist.
 */
public class SavedRouteNotFoundException extends ErrorResponseException {

	public SavedRouteNotFoundException() {
		super(HttpStatus.NOT_FOUND, ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "The route was not found."),
				null);
	}

}
