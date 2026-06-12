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

  try {
    return date.toLocaleString(undefined, timeZone ? { timeZone } : undefined);
  } catch {
    return date.toLocaleString();
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

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function availableTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  if (typeof intl.supportedValuesOf === "function") {
    return intl.supportedValuesOf("timeZone");
  }
  return ["UTC", "Europe/Prague", "Europe/London", "America/New_York", "America/Los_Angeles"];
}
