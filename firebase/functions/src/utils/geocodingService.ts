import * as logger from "firebase-functions/logger";

/**
 * Represents the result of a geocoding operation.
 */
export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

/**
 * Interface for geocoding services.
 */
export interface IGeocodingService {
  geocodeAddress(address: string): Promise<GeocodeResult | null>;
}

/**
 * Google Maps Geocoding Service implementation.
 */
export class GoogleGeocodingService implements IGeocodingService {
  private readonly apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
  }

  async geocodeAddress(address: string): Promise<GeocodeResult | null> {
    try {
      if (!this.apiKey) {
        logger.error("Google Maps API key not found in environment variables");
        return null;
      }

      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        return {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          formattedAddress: result.formatted_address,
        };
      } else {
        logger.warn(
          "No geocoding results found for address:",
          address,
          "Status:",
          data.status
        );
        return null;
      }
    } catch (error) {
      logger.error("Google Geocoding API error:", error);
      return null;
    }
  }
}
