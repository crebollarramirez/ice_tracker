/**
 * @function formatDate
 * @description
 * Formats a date string into a human-readable format with a timezone abbreviation.
 *
 * - Parses the input date string to create a Date object.
 * - Extracts the timezone abbreviation from the localized string if present.
 * - Formats the date into "Month Day, Year Hour:Minute AM/PM Timezone" format.
 *
 * @param {string} dateString - The date string to format, expected in the format "9/21/2025, 10:44:56 PM".
 *
 * @returns {string} The formatted date string, e.g., "Sept 21, 2025 10:44PM PDT".
 *
 */
export const formatDate = (dateString) => {
  // Parse the input date string to create a Date object
  const date = new Date(dateString);

  // Format with timezone included
  const formatted = date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short", // This will include the timezone abbreviation
  });

  // Remove space between time and AM/PM to get format like "10:44PM"
  const formattedTime = formatted.replace(/(\d+:\d+)\s+(AM|PM)/, "$1$2");

  return formattedTime;
};
