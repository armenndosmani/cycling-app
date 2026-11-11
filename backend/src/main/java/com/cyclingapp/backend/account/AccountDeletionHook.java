package com.cyclingapp.backend.account;

import java.util.UUID;

/**
 * Deletes a feature's data of an account that is being deleted. Every feature that stores
 * data linked to a rider implements this; {@link AccountService#delete} calls all of them
 * in the same transaction before deleting the account row.
 */
public interface AccountDeletionHook {

	void deleteAccountData(UUID userId);

}
