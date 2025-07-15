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
