import {} from "./geocodingService";

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
 * @param input - The string to sanitize. Can be any value, but only strings are processed.
 * @returns A sanitized string safe for display and storage, or empty string if input is invalid
 */
export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== "string") return "";
  // Remove HTML tags but preserve their content
  return input
    .replace(/<[^>]*>/g, "") // Remove all HTML tags but keep their content
    .replace(/[<>\"']/g, "") // Remove dangerous characters but allow &
    .trim()
    .substring(0, 500); // Limit length to prevent abuse
};
