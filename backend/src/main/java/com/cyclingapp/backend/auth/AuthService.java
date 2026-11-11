package com.cyclingapp.backend.auth;

import java.time.Instant;
import java.util.Optional;

import com.cyclingapp.backend.account.UserEntity;
import com.cyclingapp.backend.account.UserRepository;
import com.cyclingapp.backend.auth.SessionService.TokenPair;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Sign-in and sign-up with a one-time email code. */
@Service
public class AuthService {

	private final EmailCodeService codes;

	private final CodeMailer mailer;

	private final UserRepository users;

	private final SessionService sessions;

	private final String termsVersion;

	AuthService(EmailCodeService codes, CodeMailer mailer, UserRepository users, SessionService sessions,
			@Value("${app.terms.version}") String termsVersion) {
		this.codes = codes;
		this.mailer = mailer;
		this.users = users;
		this.sessions = sessions;
		this.termsVersion = termsVersion;
	}

	public String termsVersion() {
		return termsVersion;
	}

	/**
	 * Sends a sign-in code. Works the same whether or not an account exists, so the
	 * response never reveals who is registered.
	 */
	public void sendSignInCode(String email) {
		String code = codes.create(email, CodePurpose.SIGN_IN);
		mailer.sendSignInCode(email, code);
	}

	/**
	 * Verifies a sign-in code and starts a session, creating the account if needed. A
	 * correct code without the confirmations a new account needs is neither consumed nor
	 * counted as a wrong attempt.
	 */
	@Transactional
	public VerifyResult verify(String email, String code, boolean confirmAge16, String acceptTermsVersion) {
		Optional<EmailCodeEntity> validCode = codes.findValid(email, CodePurpose.SIGN_IN, code);
		if (validCode.isEmpty()) {
			// Not an exception: the wrong attempt must be committed
			return new VerifyResult.InvalidCode();
		}
		UserEntity user = users.findByEmail(email).orElse(null);
		boolean newAccount = false;
		if (user == null) {
			if (!confirmAge16 || !termsVersion.equals(acceptTermsVersion)) {
				return new VerifyResult.RegistrationRequired();
			}
			user = users.save(UserEntity.register(email, termsVersion, Instant.now()));
			newAccount = true;
		}
		codes.consume(validCode.get());
		return new VerifyResult.SignedIn(sessions.start(user.getId()), newAccount);
	}

	public sealed interface VerifyResult {

		record SignedIn(TokenPair tokens, boolean newAccount) implements VerifyResult {
		}

		record InvalidCode() implements VerifyResult {
		}

		record RegistrationRequired() implements VerifyResult {
		}

	}

}
