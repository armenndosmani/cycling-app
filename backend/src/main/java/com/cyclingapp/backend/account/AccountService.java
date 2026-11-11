package com.cyclingapp.backend.account;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

import com.cyclingapp.backend.auth.CodeMailer;
import com.cyclingapp.backend.auth.CodePurpose;
import com.cyclingapp.backend.auth.EmailCodeService;
import com.cyclingapp.backend.auth.InvalidRefreshTokenException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The signed-in rider's own account: profile, 18+ confirmation and deletion. */
@Service
public class AccountService {

	private final UserRepository users;

	private final EmailCodeService codes;

	private final CodeMailer mailer;

	AccountService(UserRepository users, EmailCodeService codes, CodeMailer mailer) {
		this.users = users;
		this.codes = codes;
		this.mailer = mailer;
	}

	@Transactional(readOnly = true)
	public UserEntity get(UUID userId) {
		return find(userId);
	}

	/** Changes only the fields that are given (not null). */
	@Transactional
	public UserEntity update(UUID userId, String displayName, List<BicycleType> bicycleTypes) {
		UserEntity user = find(userId);
		if (displayName != null) {
			user.setDisplayName(displayName);
		}
		if (bicycleTypes != null) {
			// Keep the rider's order (the first is the route planner default), drop
			// duplicates
			user.setBicycleTypes(List.copyOf(new LinkedHashSet<>(bicycleTypes)));
		}
		return user;
	}

	@Transactional
	public void confirmAdult(UUID userId) {
		find(userId).confirmAdult(Instant.now());
	}

	public String emailOf(UUID userId) {
		return get(userId).getEmail();
	}

	/** Emails a fresh code to the account's own address to confirm deleting it. */
	public void sendDeletionCode(String email) {
		String code = codes.create(email, CodePurpose.DELETE_ACCOUNT);
		mailer.sendDeletionCode(email, code);
	}

	/**
	 * Deletes the account and all its data if the code is valid. A wrong code counts as
	 * an attempt.
	 * @return false if the code is wrong, expired or used
	 */
	@Transactional
	public boolean delete(UUID userId, String code) {
		UserEntity user = find(userId);
		if (codes.findValid(user.getEmail(), CodePurpose.DELETE_ACCOUNT, code).isEmpty()) {
			return false;
		}
		codes.deleteAll(user.getEmail());
		// Sessions and refresh tokens are deleted by the database (on delete cascade).
		// Extension point: when routes and rides exist, delete saved routes, cancel
		// upcoming rides the rider administers, remove their participation and show their
		// chat messages as "Deleted rider" here (docs/specs/accounts.md).
		users.delete(user);
		return true;
	}

	private UserEntity find(UUID userId) {
		// A valid access token belongs to an existing account (sessions are deleted with
		// it), so this only fails in a race with account deletion
		return users.findById(userId).orElseThrow(InvalidRefreshTokenException::new);
	}

}
