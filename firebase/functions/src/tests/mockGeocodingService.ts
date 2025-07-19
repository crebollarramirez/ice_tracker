import {
  IGeocodingService,
  GeocodeResult,
} from "@utils/geocodingService";

/**
 * Mock geocoding service for testing purposes.
 */
export class MockGeocodingService implements IGeocodingService {
  private mockResponses: Map<string, GeocodeResult | null> = new Map();
  private shouldThrowError = false;

  /**
   * Set a mock response for a specific address.
   * @param {string} address - The address to set a mock response for.
   * @param {GeocodeResult | null} response - The geocoding result to return.
   */
  setMockResponse(address: string, response: GeocodeResult | null): void {
    this.mockResponses.set(address, response);
  }

  /**
   * Configure the service to throw an error on the next call.
   * @param {boolean} shouldThrow - Whether to throw an error on the next call.
   */
  setShouldThrowError(shouldThrow: boolean): void {
    this.shouldThrowError = shouldThrow;
  }

  /**
   * Mock implementation of geocodeAddress.
   * @param {string} address - The address to geocode.
   * @return {Promise<GeocodeResult | null>} The geocoding result or null if not found.
   */
  async geocodeAddress(address: string): Promise<GeocodeResult | null> {
    if (this.shouldThrowError) {
      // Simulate API error by returning null (matching real service behavior)
      return null;
    }

    if (this.mockResponses.has(address)) {
      return this.mockResponses.get(address) || null;
    }

    // Default behavior: return null for unknown addresses
    return null;
  }

  /**
   * Clear all mock responses.
   */
  clearMockResponses(): void {
    this.mockResponses.clear();
    this.shouldThrowError = false;
  }
}
