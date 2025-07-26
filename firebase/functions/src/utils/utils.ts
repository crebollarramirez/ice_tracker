/**
 * Helper function to determine if a location should be archived (older than 7 days)
 * @param addedAt - ISO timestamp string when the location was added
 * @returns true if the location is older than 7 days, false otherwise
 */
export function isOlderThan7Days(addedAt: string): boolean {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);
  const cutoffTimestamp = cutoffDate.toISOString();

  return addedAt < cutoffTimestamp;
}

/**
 * Helper function to check if a date string is in valid ISO 8601 format
 * @param dateString - The date string to validate
 * @returns true if the string is a valid ISO 8601 date, false otherwise
 *
 * @example
 * isValidISO8601("2025-07-25T23:21:27.427Z") // true
 * isValidISO8601("2025-07-25T12:00:00Z") // false (no milliseconds)
 * isValidISO8601("2025-07-25") // false (no time)
 * isValidISO8601("2025/07/25") // false
 * isValidISO8601("invalid") // false
 * isValidISO8601("") // false
 */
export function isValidISO8601(dateString: string): boolean {
  if (!dateString || typeof dateString !== "string") {
    return false;
  }

  // Strict ISO 8601 regex pattern - only accepts format: YYYY-MM-DDTHH:mm:ss.sssZ
  // Must include milliseconds and timezone Z
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  if (!iso8601Regex.test(dateString)) {
    return false;
  }

  // Additional validation: try to parse the date and check if it's valid
  const date = new Date(dateString);

  // Check if the date is valid (not NaN) and the ISO string matches the input exactly
  // This catches cases like "2025-13-45T12:00:00.000Z" which would match regex but be invalid dates
  return !isNaN(date.getTime()) && date.toISOString() === dateString;
}

/**
 * Checks if the given ISO 8601 timestamp is for today in UTC.
 *
 * @param addedAt - ISO 8601 timestamp string (e.g., "2025-07-26T12:00:00.000Z")
 * @returns True if the date is today (UTC), false otherwise.
 * 
 * @precondition The `addedAt` string must pass `isValidISO8601(addedAt) === true`
 */
export function isDateTodayUTC(addedAt: string): boolean {
  const pinDate = new Date(addedAt);
  const today = new Date();

  return (
    pinDate.getUTCDate() === today.getUTCDate() &&
    pinDate.getUTCMonth() === today.getUTCMonth() &&
    pinDate.getUTCFullYear() === today.getUTCFullYear()
  );
}

