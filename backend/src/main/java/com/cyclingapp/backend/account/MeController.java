package com.cyclingapp.backend.account;

import java.util.List;
import java.util.UUID;

import com.cyclingapp.backend.auth.AuthRateLimits;
import com.cyclingapp.backend.auth.CodePurpose;
import com.cyclingapp.backend.auth.CurrentUser;
import com.cyclingapp.backend.auth.InvalidCodeException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in rider's own account. Every endpoint needs an access token. */
@RestController
@RequestMapping("/api/me")
class MeController {

	private final AccountService accounts;

	private final AuthRateLimits rateLimits;

	MeController(AccountService accounts, AuthRateLimits rateLimits) {
		this.accounts = accounts;
		this.rateLimits = rateLimits;
	}

	@GetMapping
	MeResponse get(@AuthenticationPrincipal Jwt jwt) {
		return MeResponse.of(accounts.get(CurrentUser.userId(jwt)));
	}

	@PatchMapping
	MeResponse update(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpdateMeRequest request) {
		return MeResponse.of(accounts.update(CurrentUser.userId(jwt), request.displayName(), request.bicycleTypes()));
	}

	@PostMapping("/adult-confirmation")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void confirmAdult(@AuthenticationPrincipal Jwt jwt) {
		accounts.confirmAdult(CurrentUser.userId(jwt));
	}

	@PostMapping("/deletion-code")
	@ResponseStatus(HttpStatus.ACCEPTED)
	void requestDeletionCode(@AuthenticationPrincipal Jwt jwt, HttpServletRequest http) {
		String email = accounts.emailOf(CurrentUser.userId(jwt));
		rateLimits.checkCodeRequest(CodePurpose.DELETE_ACCOUNT, email, http.getRemoteAddr());
		accounts.sendDeletionCode(email);
	}

	@PostMapping("/delete")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void delete(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody DeleteRequest request, HttpServletRequest http) {
		rateLimits.checkVerification(http.getRemoteAddr());
		if (!accounts.delete(CurrentUser.userId(jwt), request.code())) {
			throw new InvalidCodeException();
		}
	}

	record UpdateMeRequest(
			@Size(min = 2, max = 40) @Pattern(regexp = "[^\\p{Cntrl}]*",
					message = "must not contain control characters") String displayName,
			@Size(max = 10) List<@NotNull BicycleType> bicycleTypes) {

		UpdateMeRequest {
			displayName = (displayName != null) ? displayName.strip() : null;
		}

	}

	record DeleteRequest(@NotBlank @Size(max = 16) String code) {

		DeleteRequest {
			code = (code != null) ? code.strip() : null;
		}

	}

	record MeResponse(UUID id, String email, String displayName, List<BicycleType> bicycleTypes,
			boolean adultConfirmed) {

		static MeResponse of(UserEntity user) {
			return new MeResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getBicycleTypes(),
					user.isAdultConfirmed());
		}

	}

}
