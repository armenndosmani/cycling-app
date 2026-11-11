/**
 * Ride date and time handling. A ride's date and start time are wall-clock values in the
 * meeting point's time zone (an IANA name), stored together with that zone. Riders elsewhere
 * see the same local time, labelled with the zone. Only `Intl` is used, no date library.
 */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type DateParts = { year: number; month: number; day: number };
export type TimeParts = { hour: number; minute: number };

/** The phone's time zone, used as the default for new rides. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** True for a known IANA time zone name. */
export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Parses YYYY-MM-DD, rejecting dates that do not exist (e.g. 2026-02-30). */
export function parseDate(value: string | null | undefined): DateParts | null {
  const match = value ? DATE_PATTERN.exec(value) : null;
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/** Parses HH:mm (24-hour clock). */
export function parseTime(value: string | null | undefined): TimeParts | null {
  const match = value ? TIME_PATTERN.exec(value) : null;
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDateParts({ year, month, day }: DateParts): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function formatTimeParts({ hour, minute }: TimeParts): string {
  return `${pad(hour)}:${pad(minute)}`;
}

/**
 * The picker works in the phone's time zone; only its wall-clock fields are used, so the
 * chosen values mean the same local time at the meeting point.
 */
export function pickerValue(date: string | null, time: string | null, now = new Date()): Date {
  const d = parseDate(date);
  const t = parseTime(time);
  return new Date(
    d?.year ?? now.getFullYear(),
    (d?.month ?? now.getMonth() + 1) - 1,
    d?.day ?? now.getDate(),
    t?.hour ?? 9,
    t?.minute ?? 0,
  );
}

export function dateFromPicker(value: Date): string {
  return formatDateParts({
    year: value.getFullYear(),
    month: value.getMonth() + 1,
    day: value.getDate(),
  });
}

export function timeFromPicker(value: Date): string {
  return formatTimeParts({ hour: value.getHours(), minute: value.getMinutes() });
}

/** Offset of `zone` from UTC at `instant`, in milliseconds (positive east of Greenwich). */
export function zoneOffsetMs(zone: string, instant: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  );
  const wholeSeconds = Math.floor(instant / 1000) * 1000;
  return asUtc - wholeSeconds;
}

/**
 * The instant (epoch ms) of a local date and time in `zone`, or null when a value is missing
 * or invalid. A time skipped by a daylight saving change resolves to the later offset.
 */
export function zonedToEpoch(
  date: string | null | undefined,
  time: string | null | undefined,
  zone: string | null | undefined,
): number | null {
  const d = parseDate(date);
  const t = parseTime(time);
  if (!d || !t || !zone) return null;
  try {
    const wallClock = Date.UTC(d.year, d.month - 1, d.day, t.hour, t.minute);
    // Two rounds settle the offset around daylight saving changes
    const first = wallClock - zoneOffsetMs(zone, wallClock);
    const second = wallClock - zoneOffsetMs(zone, first);
    return second;
  } catch {
    // Unknown zone, or Intl without time zone support: the server checks instead
    return null;
  }
}

/** Minutes from `now` until the start; null when date, time or zone are missing. */
export function minutesUntilStart(
  date: string | null | undefined,
  time: string | null | undefined,
  zone: string | null | undefined,
  now: number,
): number | null {
  const start = zonedToEpoch(date, time, zone);
  return start === null ? null : (start - now) / 60_000;
}

/** e.g. "Sat, 14 Nov 2026"; the date is a calendar date, so no zone conversion happens. */
export function formatRideDate(date: string, locale = 'en'): string {
  const d = parseDate(date);
  if (!d) return date;
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(d.year, d.month - 1, d.day)));
  } catch {
    return date;
  }
}

/**
 * Label of a time zone, e.g. "Europe/Luxembourg (GMT+1)": the IANA name tells the place, the
 * offset at the ride's start tells the clock. Falls back to the name alone.
 */
export function timeZoneLabel(zone: string, at: number, locale = 'en'): string {
  const name = zone.replace(/_/g, ' ');
  try {
    const short = new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: 'short' })
      .formatToParts(new Date(at))
      .find((part) => part.type === 'timeZoneName')?.value;
    return short && short !== zone ? `${name} (${short})` : name;
  } catch {
    return name;
  }
}
