import { describe, expect, it } from 'vitest';

import {
  dateFromPicker,
  formatRideDate,
  isValidTimeZone,
  minutesUntilStart,
  parseDate,
  parseTime,
  pickerValue,
  timeFromPicker,
  timeZoneLabel,
  zonedToEpoch,
} from '@/rides/dateTime';

describe('parsing', () => {
  it('accepts real dates only', () => {
    expect(parseDate('2026-11-15')).toEqual({ year: 2026, month: 11, day: 15 });
    expect(parseDate('2028-02-29')).not.toBeNull();
    expect(parseDate('2026-02-29')).toBeNull();
    expect(parseDate('2026-13-01')).toBeNull();
    expect(parseDate('15.11.2026')).toBeNull();
    expect(parseDate(null)).toBeNull();
  });

  it('accepts 24-hour times only', () => {
    expect(parseTime('09:30')).toEqual({ hour: 9, minute: 30 });
    expect(parseTime('23:59')).toEqual({ hour: 23, minute: 59 });
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('9:30')).toBeNull();
    expect(parseTime('09:60')).toBeNull();
  });

  it('knows IANA zones', () => {
    expect(isValidTimeZone('Europe/Luxembourg')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});

describe('zonedToEpoch', () => {
  it('converts a winter and a summer time in Luxembourg', () => {
    // CET = UTC+1, CEST = UTC+2
    expect(zonedToEpoch('2026-11-15', '09:30', 'Europe/Luxembourg')).toBe(
      Date.parse('2026-11-15T08:30:00Z'),
    );
    expect(zonedToEpoch('2026-07-01', '09:30', 'Europe/Luxembourg')).toBe(
      Date.parse('2026-07-01T07:30:00Z'),
    );
  });

  it('handles zones west of UTC and across the date line', () => {
    expect(zonedToEpoch('2026-11-15', '18:00', 'America/New_York')).toBe(
      Date.parse('2026-11-15T23:00:00Z'),
    );
    expect(zonedToEpoch('2026-11-15', '06:00', 'Pacific/Auckland')).toBe(
      Date.parse('2026-11-14T17:00:00Z'),
    );
  });

  it('is the same instant wherever the phone is: the zone is the meeting point zone', () => {
    const luxembourg = zonedToEpoch('2026-11-15', '09:30', 'Europe/Luxembourg');
    const lisbon = zonedToEpoch('2026-11-15', '09:30', 'Europe/Lisbon');
    expect(luxembourg! - lisbon!).toBe(-60 * 60 * 1000);
  });

  it('handles the daylight saving change days', () => {
    // 2026-03-29 02:30 does not exist in Luxembourg; resolves to a valid instant nearby
    const skipped = zonedToEpoch('2026-03-29', '02:30', 'Europe/Luxembourg');
    expect(skipped).not.toBeNull();
    expect(zonedToEpoch('2026-03-29', '04:00', 'Europe/Luxembourg')).toBe(
      Date.parse('2026-03-29T02:00:00Z'),
    );
    expect(zonedToEpoch('2026-10-25', '12:00', 'Europe/Luxembourg')).toBe(
      Date.parse('2026-10-25T11:00:00Z'),
    );
  });

  it('returns null for missing or invalid parts', () => {
    expect(zonedToEpoch(null, '09:30', 'Europe/Luxembourg')).toBeNull();
    expect(zonedToEpoch('2026-11-15', null, 'Europe/Luxembourg')).toBeNull();
    expect(zonedToEpoch('2026-11-15', '09:30', null)).toBeNull();
    expect(zonedToEpoch('2026-11-15', '09:30', 'Mars/Olympus')).toBeNull();
  });
});

describe('minutesUntilStart', () => {
  it('counts minutes from now in the meeting point zone', () => {
    const now = Date.parse('2026-11-15T08:00:00Z');
    expect(minutesUntilStart('2026-11-15', '09:30', 'Europe/Luxembourg', now)).toBe(30);
    expect(minutesUntilStart('2026-11-15', '09:00', 'Europe/Luxembourg', now)).toBe(0);
    expect(minutesUntilStart(null, '09:00', 'Europe/Luxembourg', now)).toBeNull();
  });
});

describe('picker values', () => {
  it('round-trips wall-clock date and time', () => {
    const value = pickerValue('2026-11-15', '07:05');
    expect(dateFromPicker(value)).toBe('2026-11-15');
    expect(timeFromPicker(value)).toBe('07:05');
  });

  it('opens on the given day at 09:00 when nothing is set', () => {
    const value = pickerValue(null, null, new Date(2026, 10, 11, 15, 42));
    expect(dateFromPicker(value)).toBe('2026-11-11');
    expect(timeFromPicker(value)).toBe('09:00');
  });
});

describe('labels', () => {
  it('formats the calendar date without shifting it', () => {
    // Exact punctuation depends on the ICU version; the day must stay the 15th (a Sunday)
    for (const locale of ['en', 'en-GB']) {
      const text = formatRideDate('2026-11-15', locale);
      expect(text).toMatch(/Sun/);
      expect(text).toMatch(/15/);
      expect(text).toMatch(/Nov/);
      expect(text).toMatch(/2026/);
    }
    expect(formatRideDate('not a date')).toBe('not a date');
  });

  it('labels the zone with its name and offset', () => {
    const winter = Date.parse('2026-11-15T08:30:00Z');
    expect(timeZoneLabel('Europe/Luxembourg', winter)).toMatch(/^Europe\/Luxembourg \(.*1.*\)$/);
    expect(timeZoneLabel('America/New_York', winter)).toMatch(/^America\/New York \(.+\)$/);
    expect(timeZoneLabel('Mars/Olympus', winter)).toBe('Mars/Olympus');
  });
});
