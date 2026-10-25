/**
 * Unified Live Session Schedule & Meeting Link Utility
 * Guarantees that Admin and Student portals show 100% in-sync dates, start/end times, and meeting URLs.
 */

export function toDatetimeLocal(isoString?: string | null): string {
  if (!isoString) return "";
  try {
    // If it's already in YYYY-MM-DDTHH:mm format, return it directly
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(isoString) && !isoString.includes("Z")) {
      return isoString.substring(0, 16);
    }
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
}

export function datetimeLocalToIso(val?: string | null): string | undefined {
  if (!val || typeof val !== "string" || !val.trim()) return undefined;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return undefined;
    return d.toISOString();
  } catch {
    return undefined;
  }
}

export interface FormattedLiveSchedule {
  dateFormatted: string;
  timeRangeFormatted: string;
  fullScheduleFormatted: string;
  meetingUrl: string;
  recordingUrl?: string;
  isLive: boolean;
  isUpcoming: boolean;
  isEnded: boolean;
  startDate: Date | null;
  endDate: Date | null;
}

export function getSessionMeetingUrl(session: any): string {
  if (!session) return "";
  const direct = session.meetUrl || session.meetingUrl || session.meet_url;
  if (direct && typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }
  if (session.id && typeof session.id === "string") {
    return `https://meet.jit.si/ilsi-live-${session.id.substring(0, 8)}`;
  }
  return "https://meet.jit.si/ilsi-live";
}

export function formatLiveSchedule(
  session: any,
  locale: "en" | "fr" = "en"
): FormattedLiveSchedule {
  const isFr = locale === "fr";
  const meetUrl = getSessionMeetingUrl(session);
  const recordingUrl = session?.recordingUrl || session?.recording_url;

  // Extract start date
  let start: Date | null = null;
  const rawStart = session?.startsAt || session?.starts_at;
  if (rawStart) {
    const parsed = new Date(rawStart);
    if (!isNaN(parsed.getTime())) start = parsed;
  }
  if (!start && session?.date && session?.startTime) {
    const combined = `${session.date}T${session.startTime}:00Z`;
    const parsed = new Date(combined);
    if (!isNaN(parsed.getTime())) start = parsed;
  }
  if (!start && session?.date) {
    const parsed = new Date(session.date);
    if (!isNaN(parsed.getTime())) start = parsed;
  }

  // Extract end date
  let end: Date | null = null;
  const rawEnd = session?.endsAt || session?.ends_at;
  if (rawEnd) {
    const parsed = new Date(rawEnd);
    if (!isNaN(parsed.getTime())) end = parsed;
  }
  if (!end && session?.date && session?.endTime) {
    const combined = `${session.date}T${session.endTime}:00Z`;
    const parsed = new Date(combined);
    if (!isNaN(parsed.getTime())) end = parsed;
  }
  if (start && !end) {
    end = new Date(start.getTime() + 60 * 60 * 1000); // 60 min default
  }

  const now = Date.now();
  const startTimeMs = start ? start.getTime() : 0;
  const endTimeMs = end ? end.getTime() : startTimeMs + 60 * 60 * 1000;

  const isLive = session?.status === "LIVE" || (startTimeMs <= now && endTimeMs >= now && session?.status !== "CANCELLED");
  const isEnded = session?.status === "ENDED" || (endTimeMs < now && !isLive);
  const isUpcoming = !isLive && !isEnded && session?.status !== "CANCELLED";

  let dateFormatted = "";
  let timeRangeFormatted = "";

  if (start) {
    dateFormatted = start.toLocaleDateString(isFr ? "fr-FR" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const startTimeStr = start.toLocaleTimeString(isFr ? "fr-FR" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const endTimeStr = end
      ? end.toLocaleTimeString(isFr ? "fr-FR" : "en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : "";

    timeRangeFormatted = endTimeStr ? `${startTimeStr}–${endTimeStr}` : startTimeStr;
  } else if (session?.date) {
    dateFormatted = String(session.date);
    timeRangeFormatted = session.startTime && session.endTime ? `${session.startTime}–${session.endTime}` : (session.startTime || "");
  }

  const fullScheduleFormatted = dateFormatted && timeRangeFormatted
    ? `${dateFormatted} · ${timeRangeFormatted}`
    : dateFormatted || timeRangeFormatted || "Schedule pending";

  return {
    dateFormatted,
    timeRangeFormatted,
    fullScheduleFormatted,
    meetingUrl: meetUrl,
    recordingUrl,
    isLive,
    isUpcoming,
    isEnded,
    startDate: start,
    endDate: end,
  };
}
