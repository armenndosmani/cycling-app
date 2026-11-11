/** Same normalisation as the backend (trim, lower-case), so the code screen shows what was sent. */
export function normaliseEmail(input: string): string {
  return input.trim().toLowerCase();
}

/** Light client-side check only; the backend validates properly. */
export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Keeps digits only, at most `length` of them (pasted codes may contain spaces). */
export function sanitiseCode(input: string, length = 6): string {
  return input.replace(/\D/g, '').slice(0, length);
}
