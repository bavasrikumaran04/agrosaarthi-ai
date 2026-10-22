/** Injectable time source so retention, lockout and expiry logic is testable. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export function addMinutes(date: Date, minutes: number): Date {
  return addSeconds(date, minutes * 60);
}

export function addHours(date: Date, hours: number): Date {
  return addSeconds(date, hours * 3600);
}

export function addDays(date: Date, days: number): Date {
  return addSeconds(date, days * 86_400);
}

/** UTC calendar day key, e.g. "2026-10-22" (used for daily quotas). */
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
