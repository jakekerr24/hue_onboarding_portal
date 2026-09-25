export function formatIsoDate(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

const MS_PER_DAY = 86400000;

// Whole-day number for an ISO date string ("2026-08-10") or a Date's local calendar day.
// Using UTC day numbers keeps day differences exact across DST changes.
function toDayNumber(value) {
  if (typeof value === 'string') {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day) / MS_PER_DAY;
  }
  return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / MS_PER_DAY;
}

// Days from `today` until `isoDate` (negative when the date has passed).
export function daysUntil(isoDate, today = new Date()) {
  return toDayNumber(isoDate) - toDayNumber(today);
}

// "2026-08-10" -> "Aug 10, 2026"
export function formatDisplayDate(isoDate) {
  if (!isoDate) return '—';
  return new Date(toDayNumber(isoDate) * MS_PER_DAY).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// "2026-08-10" + 5 -> "2026-08-15"
export function addDays(isoDate, days) {
  return new Date((toDayNumber(isoDate) + days) * MS_PER_DAY).toISOString().slice(0, 10);
}

// A real point-in-time timestamp (e.g. "when was this reviewed"), unlike every other helper in
// this file, which deliberately works in UTC calendar days with no time-of-day component. This
// one is meant to show the viewer their own local wall-clock time, so it intentionally uses the
// Date object's local getters. "2026-09-23T18:16:00Z" -> "9/23/2026 12:16 pm" (in Mountain Time).
export function formatTimestamp(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const hour24 = date.getHours();
  const hour12 = hour24 % 12 || 12;
  const meridiem = hour24 < 12 ? 'am' : 'pm';
  return `${month}/${day}/${year} ${hour12}:${minutes} ${meridiem}`;
}

// ISO dates of every 1st-of-month between two ISO dates (inclusive).
export function monthStartsBetween(startIso, endIso) {
  const [startYear, startMonth] = startIso.split('-').map(Number);
  const starts = [];
  for (let index = 0; ; index += 1) {
    const monthIndex = startMonth - 1 + index;
    const year = startYear + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    const iso = `${year}-${String(month).padStart(2, '0')}-01`;
    if (iso > endIso) return starts;
    if (iso >= startIso) starts.push(iso);
  }
}
