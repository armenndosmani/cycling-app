package com.cyclingapp.backend;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Test-only endpoints that trigger each kind of error handled by ApiExceptionHandler. */
@RestController
class ErrorHandlingTestController {

	record RideRequest(@NotBlank String name, @Size(max = 5) String code) {
	}

	@PostMapping("/test/rides")
	RideRequest create(@Valid @RequestBody RideRequest request) {
		return request;
	}

	@GetMapping("/test/boom")
	String boom() {
		throw new IllegalStateException("secret internal detail: db password is hunter2");
	}

}
