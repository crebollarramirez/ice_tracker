/**
 * Sanitizes user input by removing HTML tags and dangerous characters to prevent XSS attacks.
 *
 * This function performs the following operations:
 * - Validates input type and returns empty string for invalid inputs
 * - Strips all HTML tags while preserving their text content
 * - Removes potentially dangerous characters: <, >, ", and '
 * - Trims whitespace from both ends
 * - Limits the output to a maximum of 500 characters to prevent abuse
 *
 * @param {string} input - The string to sanitize. Can be any value, but only strings are processed.
 * @return {string} A sanitized string safe for display and storage, or empty string if input is invalid
 */
export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== "string") return "";
  // Remove HTML tags but preserve their content
  return input
    .replace(/<[^>]*>/g, "") // Remove all HTML tags but keep their content
    .replace(/[<>"']/g, "") // Remove dangerous characters but allow &
    .trim()
    .substring(0, 500); // Limit length to prevent abuse
};

/**
 * Creates a sanitized key from an address string that can be used as a Firebase database key.
 *
 * This function normalizes addresses to create consistent keys that prevent duplicate pins
 * for the same location. It performs the following operations:
 * - Converts to lowercase for case-insensitive matching
 * - Removes special characters and punctuation except spaces and hyphens
 * - Replaces spaces and multiple hyphens with single underscores
 * - Removes leading/trailing underscores
 * - Limits length to 200 characters to comply with Firebase key constraints
 *
 * @param {string} address - The formatted address from geocoding service
 * @return {string} A sanitized key suitable for use as a Firebase database key
 *
 * @example
 * makeAddressKey("123 Main St, New York, NY 10001, USA")
 * // Returns: "123_main_st_new_york_ny_10001_usa"
 */
export const makeAddressKey = (address: string): string => {
  if (!address || typeof address !== "string") return "";

  return address
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove special chars except word chars, spaces, hyphens
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/-+/g, "_") // Replace hyphens with underscores
    .replace(/_+/g, "_") // Replace multiple underscores with single
    .replace(/^_|_$/g, "") // Remove leading/trailing underscores
    .substring(0, 200); // Limit length for Firebase key constraints
};
