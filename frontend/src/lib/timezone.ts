/**
 * Timezone and Date-Time utilities for cohort scheduling and lesson access windows.
 * Guarantees accurate UTC storage while giving users full local timezone clarity.
 */

export interface TimezoneInfo {
  timeZone: string;
  name: string;
  offsetMinutes: number;
  offsetFormatted: string;
}

/**
 * Returns the user's detected local timezone identifier (e.g. "Asia/Kolkata", "America/New_York").
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Returns the short abbreviation or formatted offset (e.g. "IST", "EDT", "GMT+5:30").
 */
export function getUserTimezoneAbbr(date = new Date()): string {
  try {
    const tz = getUserTimezone();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart ? tzPart.value : getGmtOffsetString(date);
  } catch {
    return getGmtOffsetString(date);
  }
}

/**
 * Calculates a friendly GMT offset string like "GMT+05:30" or "GMT-04:00".
 */
export function getGmtOffsetString(date = new Date()): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const hours = Math.floor(abs / 60).toString().padStart(2, "0");
  const mins = (abs % 60).toString().padStart(2, "0");
  return `GMT${sign}${hours}:${mins}`;
}

/**
 * Converts a UTC ISO string (or Date object) into a localized `YYYY-MM-DDTHH:mm` string
 * safe for binding directly to `<input type="datetime-local" />` WITHOUT timezone drift.
 */
export function toLocalDatetimeInputValue(utcDateStr?: string | Date | null): string {
  if (!utcDateStr) return "";
  const d = typeof utcDateStr === "string" ? new Date(utcDateStr) : utcDateStr;
  if (isNaN(d.getTime())) return "";

  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Converts a value from an `<input type="datetime-local" />` (which is in user's local timezone)
 * into a standard UTC ISO-8601 string (`...Z`) for backend persistence.
 */
export function fromLocalDatetimeInputValue(localDatetimeString?: string | null): string | null {
  if (!localDatetimeString || !localDatetimeString.trim()) return null;
  const d = new Date(localDatetimeString);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Formats a UTC ISO date string into a user-friendly localized date-time representation,
 * explicitly indicating the user's timezone.
 */
export function formatLocalizedDateTime(
  utcDateStr?: string | Date | null,
  locale = "en",
  includeTimezone = true
): string {
  if (!utcDateStr) return "";
  const d = typeof utcDateStr === "string" ? new Date(utcDateStr) : utcDateStr;
  if (isNaN(d.getTime())) return "";

  const loc = locale === "fr" ? "fr-FR" : "en-US";
  const dateFormatted = d.toLocaleDateString(loc, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeFormatted = d.toLocaleTimeString(loc, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (!includeTimezone) {
    return `${dateFormatted}, ${timeFormatted}`;
  }

  const abbr = getUserTimezoneAbbr(d);
  return `${dateFormatted}, ${timeFormatted} (${abbr})`;
}
