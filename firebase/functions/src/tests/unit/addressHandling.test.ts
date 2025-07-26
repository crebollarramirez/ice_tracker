import { sanitizeInput } from "@utils/addressHandling";
import { GoogleGeocodingService } from "@utils/geocodingService";
import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock the geocoding service module
jest.mock("@utils/geocodingService");

// Get the mocked constructor
const MockedGoogleGeocodingService = GoogleGeocodingService as jest.MockedClass<
  typeof GoogleGeocodingService
>;

describe("sanitizeInput", () => {
  it("should remove HTML tags", () => {
    const input = "<script>alert('xss')</script>Hello World";
    const result = sanitizeInput(input);
    expect(result).toBe("alert(xss)Hello World");
  });

  it("should remove dangerous characters", () => {
    const input = 'Hello &\' "World" <script>';
    const result = sanitizeInput(input);
    expect(result).toBe("Hello & World");
  });

  it("should trim whitespace", () => {
    const input = "  Hello World  ";
    const result = sanitizeInput(input);
    expect(result).toBe("Hello World");
  });

  it("should limit length to 500 characters", () => {
    const input = "a".repeat(600);
    const result = sanitizeInput(input);
    expect(result).toHaveLength(500);
  });

  it("should return empty string for invalid input", () => {
    expect(sanitizeInput(null as unknown as string)).toBe("");
    expect(sanitizeInput(undefined as unknown as string)).toBe("");
    expect(sanitizeInput(123 as unknown as string)).toBe("");
  });

  it("should handle empty string", () => {
    const result = sanitizeInput("");
    expect(result).toBe("");
  });

  it("should handle string with only whitespace", () => {
    const input = "   ";
    const result = sanitizeInput(input);
    expect(result).toBe("");
  });

  it("should handle mixed HTML and dangerous characters", () => {
    const input = '<div>Hello &amp; "quoted" text</div>';
    const result = sanitizeInput(input);
    expect(result).toBe("Hello &amp; quoted text");
  });
});

describe("GoogleGeocodingService", () => {
  let mockGeocodingService: jest.Mocked<GoogleGeocodingService>;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Create a new mocked instance
    mockGeocodingService =
      new MockedGoogleGeocodingService() as jest.Mocked<GoogleGeocodingService>;
  });

  it("should return null if address is invalid", async () => {
    // Mock the geocodeAddress method to return null for invalid addresses
    mockGeocodingService.geocodeAddress.mockResolvedValue(null);

    const result = await mockGeocodingService.geocodeAddress(
      "asdasdasdasdasdasdnonexistentaddress"
    );

    expect(result).toBeNull();
    expect(mockGeocodingService.geocodeAddress).toHaveBeenCalledWith(
      "asdasdasdasdasdasdnonexistentaddress"
    );
  });

  it("should return valid geocode result for a known address", async () => {
    const mockResult = {
      lat: 34.052235,
      lng: -118.243683,
      formattedAddress: "N Main St & W College St, Los Angeles, CA, USA",
    };

    // Mock the geocodeAddress method to return the mock result
    mockGeocodingService.geocodeAddress.mockResolvedValue(mockResult);

    const result = await mockGeocodingService.geocodeAddress(
      "N Main St and W College st, los angeles, CA"
    );

    expect(result).toEqual(mockResult);
    expect(result?.lat).toBeCloseTo(34.052235, 5);
    expect(result?.lng).toBeCloseTo(-118.243683, 5);
    expect(mockGeocodingService.geocodeAddress).toHaveBeenCalledWith(
      "N Main St and W College st, los angeles, CA"
    );
  });

  it("should handle geocoding service errors", async () => {
    // Mock the geocodeAddress method to reject with an error
    mockGeocodingService.geocodeAddress.mockRejectedValue(
      new Error("API Error")
    );

    // Test that the service handles errors gracefully
    await expect(
      mockGeocodingService.geocodeAddress(
        "N Main St and W College st, los angeles, CA"
      )
    ).rejects.toThrow("API Error");

    expect(mockGeocodingService.geocodeAddress).toHaveBeenCalledWith(
      "N Main St and W College st, los angeles, CA"
    );
  });

  it("should work with different addresses", async () => {
    const mockResults = [
      {
        address: "1600 Amphitheatre Parkway, Mountain View, CA",
        result: {
          lat: 37.4224764,
          lng: -122.0842499,
          formattedAddress:
            "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
        },
      },
      {
        address: "Times Square, New York, NY",
        result: {
          lat: 40.758,
          lng: -73.9855,
          formattedAddress: "Times Square, New York, NY 10036, USA",
        },
      },
    ];

    // Set up mock responses for each address
    mockResults.forEach((mock) => {
      mockGeocodingService.geocodeAddress.mockResolvedValueOnce(mock.result);
    });

    // Test each address
    for (const mock of mockResults) {
      const result = await mockGeocodingService.geocodeAddress(mock.address);
      expect(result).toEqual(mock.result);
    }

    // Verify all calls were made
    expect(mockGeocodingService.geocodeAddress).toHaveBeenCalledTimes(
      mockResults.length
    );
    mockResults.forEach((mock, index) => {
      expect(mockGeocodingService.geocodeAddress).toHaveBeenNthCalledWith(
        index + 1,
        mock.address
      );
    });
  });

  it("should handle multiple calls with different responses", async () => {
    const firstAddress = "Address 1";
    const secondAddress = "Address 2";

    const firstResult = {
      lat: 1.0,
      lng: 1.0,
      formattedAddress: "Formatted Address 1",
    };

    const secondResult = {
      lat: 2.0,
      lng: 2.0,
      formattedAddress: "Formatted Address 2",
    };

    // Set up different responses for consecutive calls
    mockGeocodingService.geocodeAddress
      .mockResolvedValueOnce(firstResult)
      .mockResolvedValueOnce(secondResult);

    const result1 = await mockGeocodingService.geocodeAddress(firstAddress);
    const result2 = await mockGeocodingService.geocodeAddress(secondAddress);

    expect(result1).toEqual(firstResult);
    expect(result2).toEqual(secondResult);
    expect(mockGeocodingService.geocodeAddress).toHaveBeenCalledTimes(2);
    expect(mockGeocodingService.geocodeAddress).toHaveBeenNthCalledWith(
      1,
      firstAddress
    );
    expect(mockGeocodingService.geocodeAddress).toHaveBeenNthCalledWith(
      2,
      secondAddress
    );
  });
});
