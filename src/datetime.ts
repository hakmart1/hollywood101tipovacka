// Stored datetimes are UTC ISO strings. Display converts them into a target
// IANA time zone (admin's configured one) or the browser's own when omitted.
export function formatDateTime(value: string | null, timeZone?: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  // Show date and time down to the minute — never seconds.
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  };

  try {
    return date.toLocaleString(undefined, timeZone ? { ...options, timeZone } : options);
  } catch {
    return date.toLocaleString(undefined, options);
  }
}

// Offset of a time zone against UTC at a given instant.
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );

  return asUtc - date.getTime();
}

// Interpret a datetime-local input value ("YYYY-MM-DDTHH:MM") in the given
// time zone and return the corresponding UTC ISO string. Without a time zone
// the browser's local interpretation applies.
export function zonedToUtcIso(local: string, timeZone?: string | null): string {
  if (!local) {
    return local;
  }

  if (!timeZone) {
    const date = new Date(local);
    return Number.isNaN(date.getTime()) ? local : date.toISOString();
  }

  try {
    const utcGuess = new Date(`${local}:00.000Z`);
    if (Number.isNaN(utcGuess.getTime())) {
      return local;
    }
    const offset = timeZoneOffsetMs(utcGuess, timeZone);
    return new Date(utcGuess.getTime() - offset).toISOString();
  } catch {
    const date = new Date(local);
    return Number.isNaN(date.getTime()) ? local : date.toISOString();
  }
}

// Suggested contest title from a start date: "2026 Week 24" (ISO-8601 week).
// Accepts a "YYYY-MM-DD..." string and reads the date part directly.
export function weekTitle(dateValue: string): string {
  const parts = dateValue.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return "";
  }

  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Shift to the Thursday of the current ISO week (Mon = 0).
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);

  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);

  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${isoYear} Week ${String(week).padStart(2, "0")}`;
}

// UTC ISO string -> a datetime-local input value ("YYYY-MM-DDTHH:MM") expressed
// in the given time zone (or the browser's when omitted). Inverse of zonedToUtcIso.
export function utcToZonedInput(iso: string | null, timeZone?: string | null): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");

  if (!timeZone) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  }

  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })
        .formatToParts(date)
        .map((part) => [part.type, part.value])
    );
    const hour = parts.hour === "24" ? "00" : parts.hour;
    return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
  } catch {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  }
}

// The upcoming Monday as a datetime-local input value ("YYYY-MM-DDT00:00"),
// expressed as a calendar date in the given time zone (today if it's Monday).
export function nextMondayInput(timeZone?: string | null): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || undefined,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value])
  );

  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };
  const dayOfWeek = weekdays[parts.weekday] ?? 1;
  const daysUntilMonday = (8 - dayOfWeek) % 7;

  const date = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))
  );
  date.setUTCDate(date.getUTCDate() + daysUntilMonday);

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}T00:00`;
}

// Shift a datetime-local input value ("YYYY-MM-DDTHH:MM") by a number of days,
// keeping the time of day. Returns "" for an unparseable input.
export function addDaysToInput(value: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return "";
  }
  const [, year, month, day, hour, minute] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  date.setUTCDate(date.getUTCDate() + days);

  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}T${hour}:${minute}`;
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

// A practical subset of the IANA database — one or more representative city
// per UTC offset, ordered west to east so the offsets read in sequence.
const COMMON_TIME_ZONES = [
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/Mexico_City",
  "America/New_York",
  "America/Toronto",
  "America/Sao_Paulo",
  "Atlantic/Azores",
  "UTC",
  "Europe/London",
  "Europe/Lisbon",
  "Europe/Prague",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Warsaw",
  "Europe/Athens",
  "Europe/Helsinki",
  "Africa/Cairo",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland"
];

export function availableTimeZones(): string[] {
  return COMMON_TIME_ZONES;
}

// Current UTC offset of a time zone, e.g. "UTC+2", "UTC-5:30", "UTC".
// Computed against the current instant so daylight saving time is reflected.
function timeZoneOffsetLabel(timeZone: string): string {
  try {
    const name = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset"
    })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;

    if (!name) {
      return "";
    }

    const offset = name.replace(/^GMT/, "").replace(/^UTC/, "");
    return `UTC${offset}`;
  } catch {
    return "";
  }
}

// A friendly option label, e.g. "Europe/Prague (UTC+2)".
export function timeZoneLabel(timeZone: string): string {
  const offset = timeZoneOffsetLabel(timeZone);
  return offset ? `${timeZone} (${offset})` : timeZone;
}
