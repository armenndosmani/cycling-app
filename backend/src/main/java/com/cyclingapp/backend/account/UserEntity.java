package com.cyclingapp.backend.account;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A rider's account. Stores no birth date: only the dates of the 16+ and 18+
 * confirmations and the accepted terms version.
 */
@Entity
@Table(name = "users")
public class UserEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(nullable = false, unique = true)
	private String email;

	@Column(name = "display_name")
	private String displayName;

	@Convert(converter = BicycleTypesConverter.class)
	@Column(name = "bicycle_types", nullable = false)
	private List<BicycleType> bicycleTypes = List.of();

	@Column(name = "age16_confirmed_at", nullable = false)
	private Instant age16ConfirmedAt;

	@Column(name = "adult_confirmed_at")
	private Instant adultConfirmedAt;

	@Column(name = "terms_version", nullable = false)
	private String termsVersion;

	@Column(name = "terms_accepted_at", nullable = false)
	private Instant termsAcceptedAt;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected UserEntity() {
	}

	/**
	 * A new account; the rider has confirmed being 16 or older and accepted the terms.
	 */
	public static UserEntity register(String email, String termsVersion, Instant now) {
		UserEntity user = new UserEntity();
		user.email = email;
		user.age16ConfirmedAt = now;
		user.termsVersion = termsVersion;
		user.termsAcceptedAt = now;
		user.createdAt = now;
		return user;
	}

	public UUID getId() {
		return id;
	}

	public String getEmail() {
		return email;
	}

	public String getDisplayName() {
		return displayName;
	}

	void setDisplayName(String displayName) {
		this.displayName = displayName;
	}

	public List<BicycleType> getBicycleTypes() {
		return bicycleTypes;
	}

	void setBicycleTypes(List<BicycleType> bicycleTypes) {
		this.bicycleTypes = List.copyOf(bicycleTypes);
	}

	public boolean isAdultConfirmed() {
		return adultConfirmedAt != null;
	}

	/** Stores the date of the 18+ confirmation once; later calls change nothing. */
	void confirmAdult(Instant now) {
		if (adultConfirmedAt == null) {
			adultConfirmedAt = now;
		}
	}

}
