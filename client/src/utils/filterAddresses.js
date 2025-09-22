/**
 * @function filterAddresses
 * @description
 * Filters an array of address objects based on a search term.
 *
 * - Returns all addresses if the search term is empty or whitespace-only.
 * - Filters addresses whose `address` field includes the search term (case-insensitive).
 * - Handles edge cases such as missing or invalid `addresses` array or `address` field.
 *
 * @param {Array<Object>} addresses - The array of address objects to filter.
 * @param {string} searchTerm - The search term to filter addresses by.
 *
 * @returns {Array<Object>} The filtered array of address objects.
 */
export const filterAddresses = (addresses, searchTerm) => {
  // Handle edge cases for addresses array
  if (!addresses || !Array.isArray(addresses)) {
    return [];
  }

  // Handle empty or whitespace-only search terms
  if (!searchTerm || !searchTerm.trim()) {
    return addresses;
  }

  const trimmedSearchTerm = searchTerm.trim().toLowerCase();

  return addresses.filter((address) => {
    // Handle addresses with missing address field
    if (!address || !address.address || typeof address.address !== "string") {
      return false;
    }

    return address.address.toLowerCase().includes(trimmedSearchTerm);
  });
};
