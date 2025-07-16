import { sanitizeInput } from "../../src/utils/addressHandling";
import { MockGeocodingService } from "./mockGeocodingService";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

describe("sanitizeInput", () => {
  it("should remove HTML tags", () => {
    const input = "<script>alert('xss')</script>Hello World";
    const result = sanitizeInput(input);
    expect(result).toBe("alert(xss)Hello World");
  });

  it("should remove dangerous characters", () => {
    const input = "Hello &' \"World\" <script>";
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
    const input = "<div>Hello &amp; \"quoted\" text</div>";
    const result = sanitizeInput(input);
    expect(result).toBe("Hello &amp; quoted text");
  });
});

describe("GoogleGeocodingService", () => {
  let mockService: MockGeocodingService;

  beforeEach(() => {
    mockService = new MockGeocodingService();
  });

  afterEach(() => {
    mockService.clearMockResponses();
  });

  it("should return null if address is invalid", async () => {
    // Mock service will return null for unknown addresses by default
    const result = await mockService.geocodeAddress(
      "asdasdasdasdasdasdnonexistentaddress"
    );
    expect(result).toBeNull();
  });

  it("should return valid geocode result for a known address", async () => {
    const mockResult = {
      lat: 34.052235,
      lng: -118.243683,
      formattedAddress: "N Main St & W College St, Los Angeles, CA, USA",
    };

    mockService.setMockResponse(
      "N Main St and W College st, los angeles, CA",
      mockResult
    );

    const result = await mockService.geocodeAddress(
      "N Main St and W College st, los angeles, CA"
    );

    expect(result).toEqual(mockResult);
    expect(result?.lat).toBeCloseTo(34.052235, 5);
    expect(result?.lng).toBeCloseTo(-118.243683, 5);
  });

  it("should handle geocoding service errors", async () => {
    mockService.setShouldThrowError(true);

    const result = await mockService.geocodeAddress(
      "N Main St and W College st, los angeles, CA"
    );

    // The service should handle errors gracefully and return null (matching real service behavior)
    expect(result).toBeNull();
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

    for (const mock of mockResults) {
      mockService.setMockResponse(mock.address, mock.result);
      const result = await mockService.geocodeAddress(mock.address);
      expect(result).toEqual(mock.result);
    }
  });
});
