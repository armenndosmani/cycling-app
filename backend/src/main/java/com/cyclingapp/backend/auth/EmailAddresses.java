package com.cyclingapp.backend.auth;

import java.util.Locale;

/** Email addresses are stored and compared trimmed and lower-case. */
public final class EmailAddresses {

	public static final int MAX_LENGTH = 254;

	private EmailAddresses() {
	}

	public static String normalise(String email) {
		return (email != null) ? email.strip().toLowerCase(Locale.ROOT) : null;
	}

}
