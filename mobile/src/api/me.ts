import { session } from '@/auth/session';

export const BICYCLE_TYPES = ['ROAD', 'GRAVEL', 'MTB', 'URBAN'] as const;
export type BicycleType = (typeof BICYCLE_TYPES)[number];

export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 40;

/** The signed-in rider's own profile. The email is only ever shown to the rider. */
export type Me = {
  id: string;
  email: string;
  /** null until the rider chooses one after the first sign-in */
  displayName: string | null;
  bicycleTypes: BicycleType[];
  adultConfirmed: boolean;
};

export type MeUpdate = {
  displayName?: string;
  bicycleTypes?: BicycleType[];
};

export function getMe(): Promise<Me> {
  return session.authorized<Me>('/api/me');
}

/** Updates the profile and returns it. Falls back to a GET if the backend answers without a body. */
export async function updateMe(update: MeUpdate): Promise<Me> {
  const updated = await session.authorized<Me | undefined>('/api/me', {
    method: 'PATCH',
    body: update,
  });
  return updated ?? getMe();
}

/** Display name rule from the accounts spec: 2 to 40 characters after trimming. */
export function isValidDisplayName(name: string): boolean {
  const length = [...name.trim()].length;
  return length >= DISPLAY_NAME_MIN_LENGTH && length <= DISPLAY_NAME_MAX_LENGTH;
}
