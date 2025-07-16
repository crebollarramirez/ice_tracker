import {
  IGeocodingService,
  GeocodeResult,
} from "../../src/utils/geocodingService";

/**
 * Mock geocoding service for testing purposes.
 */
export class MockGeocodingService implements IGeocodingService {
  private mockResponses: Map<string, GeocodeResult | null> = new Map();
  private shouldThrowError = false;

  /**
   * Set a mock response for a specific address.
   */
  setMockResponse(address: string, response: GeocodeResult | null): void {
    this.mockResponses.set(address, response);
  }

  /**
   * Configure the service to throw an error on the next call.
   */
  setShouldThrowError(shouldThrow: boolean): void {
    this.shouldThrowError = shouldThrow;
  }

  /**
   * Mock implementation of geocodeAddress.
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
