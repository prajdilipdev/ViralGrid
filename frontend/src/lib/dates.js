import dayjs from "dayjs";

/**
 * Date helpers that never render "Invalid Date" at the user.
 *
 * Records can carry a missing or malformed timestamp — an interrupted write, an
 * older document, a field the API left out — and both dayjs and Date happily
 * print "Invalid Date" straight into the page. These return a fallback instead.
 */

export const isValidDate = (value) => Boolean(value) && dayjs(value).isValid();

/** Format with dayjs, or return `fallback` when the value is unusable. */
export const fmt = (value, pattern = "MMM D, YYYY HH:mm", fallback = "—") =>
  isValidDate(value) ? dayjs(value).format(pattern) : fallback;

/** Locale string (used where the UI previously called toLocaleString). */
export const fmtLocal = (value, fallback = "—") =>
  isValidDate(value) ? new Date(value).toLocaleString() : fallback;
