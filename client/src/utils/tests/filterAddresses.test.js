import { filterAddresses } from "../filterAddresses.js";

describe("filterAddresses", () => {
  const mockAddresses = [
    {
      id: "1",
      address: "123 Main Street",
      additionalInfo: "Near the park",
      addedAt: "2025-07-12T10:00:00Z",
      lat: 40.7128,
      lng: -74.006,
    },
    {
      id: "2",
      address: "456 Oak Avenue",
      additionalInfo: "Behind the mall",
      addedAt: "2025-07-11T09:00:00Z",
      lat: 40.7589,
      lng: -73.9851,
    },
    {
      id: "3",
      address: "789 Pine Road",
      additionalInfo: "Next to school",
      addedAt: "2025-07-10T08:00:00Z",
      lat: 40.7831,
      lng: -73.9712,
    },
    {
      id: "4",
      address: "321 Elm Street",
      additionalInfo: "Corner of Elm and Main",
      addedAt: "2025-07-09T07:00:00Z",
      lat: 40.7505,
      lng: -73.9934,
    },
  ];

  describe("when searchTerm is empty or whitespace", () => {
    it("should return all addresses when searchTerm is empty string", () => {
      const result = filterAddresses(mockAddresses, "");
      expect(result).toEqual(mockAddresses);
    });

    it("should return all addresses when searchTerm is only whitespace", () => {
      const result = filterAddresses(mockAddresses, "   ");
      expect(result).toEqual(mockAddresses);
    });

    it("should return all addresses when searchTerm is tabs and spaces", () => {
      const result = filterAddresses(mockAddresses, "\t  \n  ");
      expect(result).toEqual(mockAddresses);
    });
  });

  describe("when searchTerm matches addresses", () => {
    it("should return addresses that contain the search term", () => {
      const result = filterAddresses(mockAddresses, "Street");
      expect(result).toHaveLength(2);
      expect(result).toEqual([
        mockAddresses[0], // 123 Main Street
        mockAddresses[3], // 321 Elm Street
      ]);
    });

    it("should return single address for specific search", () => {
      const result = filterAddresses(mockAddresses, "Oak");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockAddresses[1]);
    });

    it("should return addresses for partial matches", () => {
      const result = filterAddresses(mockAddresses, "Main");
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe("123 Main Street");
    });

    it("should return addresses for number matches", () => {
      const result = filterAddresses(mockAddresses, "789");
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe("789 Pine Road");
    });
  });

  describe("case insensitive matching", () => {
    it("should match regardless of case in search term", () => {
      const result = filterAddresses(mockAddresses, "STREET");
      expect(result).toHaveLength(2);
    });

    it("should match mixed case search terms", () => {
      const result = filterAddresses(mockAddresses, "mAiN");
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe("123 Main Street");
    });

    it("should match lowercase search terms", () => {
      const result = filterAddresses(mockAddresses, "oak");
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe("456 Oak Avenue");
    });
  });

  describe("search term with whitespace", () => {
    it("should trim whitespace from search term", () => {
      const result = filterAddresses(mockAddresses, "  Oak  ");
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe("456 Oak Avenue");
    });

    it("should handle search terms with leading whitespace", () => {
      const result = filterAddresses(mockAddresses, "   Pine");
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe("789 Pine Road");
    });

    it("should handle search terms with trailing whitespace", () => {
      const result = filterAddresses(mockAddresses, "Elm   ");
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe("321 Elm Street");
    });
  });

  describe("when no matches are found", () => {
    it("should return empty array for non-existent search term", () => {
      const result = filterAddresses(mockAddresses, "Nonexistent");
      expect(result).toEqual([]);
    });

    it("should return empty array for special characters", () => {
      const result = filterAddresses(mockAddresses, "!@#$%");
      expect(result).toEqual([]);
    });

    it("should return empty array for numbers not in addresses", () => {
      const result = filterAddresses(mockAddresses, "999");
      expect(result).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("should handle empty addresses array", () => {
      const result = filterAddresses([], "test");
      expect(result).toEqual([]);
    });

    it("should handle null addresses array", () => {
      const result = filterAddresses(null, "test");
      expect(result).toEqual([]);
    });

    it("should handle undefined addresses array", () => {
      const result = filterAddresses(undefined, "test");
      expect(result).toEqual([]);
    });

    it("should handle addresses with missing address field", () => {
      const addressesWithMissingField = [
        { id: "1", additionalInfo: "test" },
        { id: "2", address: "123 Test Street" },
      ];
      const result = filterAddresses(addressesWithMissingField, "Test");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("2");
    });

    it("should handle very long search terms", () => {
      const longSearchTerm = "a".repeat(1000);
      const result = filterAddresses(mockAddresses, longSearchTerm);
      expect(result).toEqual([]);
    });

    it("should handle single character search", () => {
      const result = filterAddresses(mockAddresses, "P");
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe("789 Pine Road");
    });
  });
});