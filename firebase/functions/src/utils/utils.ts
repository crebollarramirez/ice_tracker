import * as crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

/**
 * Retrieves the client IP address from the request headers or the request object.
 *
 * - Extracts the first IP address from the `x-forwarded-for` header if available.
 * - Falls back to the `req.ip` property if the header is not present.
 * - Returns "unknown" if no IP address can be determined.
 *
 * @function clientIp
 * @param {Record<string, unknown>} req - The request object containing headers and IP information.
 * @return {string} The client IP address or "unknown" if it cannot be determined.
 */
export function clientIp(req: Record<string, unknown>): string {
  // For Firebase callable functions, the request structure is different
  // Try Firebase callable structure first, then fall back to regular HTTP request structure
  const rawRequest = req.rawRequest as Record<string, unknown> | undefined;
  const headers = (rawRequest?.headers || req.headers || {}) as Record<
    string,
    string | string[] | undefined
  >;
  const ip = (rawRequest?.ip || req.ip) as string | undefined;

  const xff = (headers["x-forwarded-for"] as string | undefined) || "";
  const first = xff.split(",")[0].trim();
  return first || (ip ?? "unknown");
}

/**
 * Helper function to determine if a location should be archived (older than 7 days)
 * @param {string} addedAt - ISO timestamp string when the location was added
 * @return {boolean} true if the location is older than 7 days, false otherwise
 */
export function isOlderThan7Days(addedAt: string): boolean {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);
  const cutoffTimestamp = cutoffDate.toISOString();

  return addedAt < cutoffTimestamp;
}

/**
 * Helper function to check if a date string is in valid ISO 8601 format
 * @param {string} dateString - The date string to validate
 * @return {boolean} true if the string is a valid ISO 8601 date, false otherwise
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
 * @param {string} addedAt - ISO 8601 timestamp string (e.g., "2025-07-26T12:00:00.000Z")
 * @return {boolean} True if the date is today (UTC), false otherwise.
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

/**
 * Generates a unique key for an IP address using a salted SHA-256 hash.
 *
 * - Combines the IP address with a salt value from the environment variable `RATE_SALT`.
 * - Creates a SHA-256 hash of the combined string.
 * - Returns the resulting hash as a hexadecimal string.
 *
 * @function ipKey
 * @param {string} ip - The IP address to generate a key for.
 * @return {string} A unique hashed key for the IP address.
 */
export function ipKey(ip: string) {
  const SALT = process.env.RATE_SALT || "";
  return crypto
    .createHash("sha256")
    .update(ip + SALT)
    .digest("hex");
}

/**
 * Gets the current date in UTC as a string in the format `YYYY-MM-DD`.
 *
 * - Retrieves the current date and time.
 * - Formats the date components (year, month, day) as a zero-padded string.
 * - Returns the formatted date string.
 *
 * @function todayUTC
 * @return {string} The current date in UTC formatted as `YYYY-MM-DD`.
 */
export function todayUTC(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
