package com.cyclingapp.backend.auth;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

/** SHA-256 and HMAC-SHA256 helpers. Hashes are lower-case hex strings. */
final class Hashing {

	private Hashing() {
	}

	static String sha256Hex(String value) {
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
		}
		catch (GeneralSecurityException ex) {
			throw new IllegalStateException("SHA-256 is not available", ex);
		}
	}

	static String hmacSha256Hex(SecretKey key, String value) {
		return HexFormat.of().formatHex(hmacSha256(key, value));
	}

	/** Derives a separate key for one purpose from a master secret. */
	static SecretKey deriveKey(SecretKey master, String purpose) {
		return new SecretKeySpec(hmacSha256(master, purpose), "HmacSHA256");
	}

	/** Compares two hashes in constant time. */
	static boolean matches(String expected, String actual) {
		return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
				actual.getBytes(StandardCharsets.UTF_8));
	}

	private static byte[] hmacSha256(SecretKey key, String value) {
		try {
			Mac mac = Mac.getInstance("HmacSHA256");
			mac.init(key);
			return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
		}
		catch (GeneralSecurityException ex) {
			throw new IllegalStateException("HmacSHA256 is not available", ex);
		}
	}

}
