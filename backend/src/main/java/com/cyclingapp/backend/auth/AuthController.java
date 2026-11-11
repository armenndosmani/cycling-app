package com.cyclingapp.backend.auth;

import com.cyclingapp.backend.auth.AuthService.VerifyResult;
import com.cyclingapp.backend.auth.SessionService.TokenPair;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Passwordless sign-in. Code request, verification and refresh are public (see
 * SecurityConfig); signing out needs an access token.
 */
@RestController
@RequestMapping("/api/auth")
class AuthController {

	private final AuthService auth;

	private final SessionService sessions;

	private final AuthRateLimits rateLimits;

	AuthController(AuthService auth, SessionService sessions, AuthRateLimits rateLimits) {
		this.auth = auth;
		this.sessions = sessions;
		this.rateLimits = rateLimits;
	}

	@PostMapping("/email/code")
	@ResponseStatus(HttpStatus.ACCEPTED)
	void requestCode(@Valid @RequestBody CodeRequest request, HttpServletRequest http) {
		rateLimits.checkCodeRequest(CodePurpose.SIGN_IN, request.email(), http.getRemoteAddr());
		auth.sendSignInCode(request.email());
	}

	@PostMapping("/email/verify")
	TokenResponse verify(@Valid @RequestBody VerifyRequest request, HttpServletRequest http) {
		rateLimits.checkVerification(http.getRemoteAddr());
		VerifyResult result = auth.verify(request.email(), request.code(), Boolean.TRUE.equals(request.confirmAge16()),
				request.acceptTermsVersion());
		return switch (result) {
			case VerifyResult.SignedIn signedIn -> TokenResponse.of(signedIn.tokens(), signedIn.newAccount());
			case VerifyResult.RegistrationRequired ignored ->
				throw new RegistrationRequiredException(auth.termsVersion());
			case VerifyResult.InvalidCode ignored -> throw new InvalidCodeException();
		};
	}

	@PostMapping("/refresh")
	TokenResponse refresh(@Valid @RequestBody RefreshRequest request) {
		return sessions.refresh(request.refreshToken())
			.map(tokens -> TokenResponse.of(tokens, false))
			.orElseThrow(InvalidRefreshTokenException::new);
	}

	@PostMapping("/sign-out")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	void signOut(@AuthenticationPrincipal Jwt jwt) {
		sessions.revoke(CurrentUser.sessionId(jwt));
	}

	record CodeRequest(@NotBlank @Email @Size(max = EmailAddresses.MAX_LENGTH) String email) {

		CodeRequest {
			email = EmailAddresses.normalise(email);
		}

	}

	record VerifyRequest(@NotBlank @Email @Size(max = EmailAddresses.MAX_LENGTH) String email,
			@NotBlank @Size(max = 16) String code, Boolean confirmAge16, @Size(max = 32) String acceptTermsVersion) {

		VerifyRequest {
			email = EmailAddresses.normalise(email);
			code = (code != null) ? code.strip() : null;
		}

	}

	record RefreshRequest(@NotBlank @Size(max = 128) String refreshToken) {
	}

	record TokenResponse(String accessToken, String refreshToken, long accessTokenExpiresIn, boolean newAccount) {

		static TokenResponse of(TokenPair tokens, boolean newAccount) {
			return new TokenResponse(tokens.accessToken(), tokens.refreshToken(), tokens.accessTokenExpiresIn(),
					newAccount);
		}

	}

}
