/** Kilometres with one decimal, e.g. 42 315 m → "42.3". Units are metric only (spec). */
export function formatKilometres(meters: number): string {
  return (Math.max(0, meters) / 1000).toFixed(1);
}

/** Whole metres, e.g. for elevation gain. */
export function roundMeters(meters: number): number {
  return Math.round(meters);
}
