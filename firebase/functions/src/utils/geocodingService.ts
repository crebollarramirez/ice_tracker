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
 * Google Maps API response structure.
 */
interface GoogleMapsResponse {
  results: Array<{
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
    formatted_address: string;
    address_components: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
  }>;
  status: string;
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
  /**
   * Geocodes a physical address using the Google Maps Geocoding API.
   *
   * This method sends a request to the Google Maps Geocoding API to retrieve
   * geolocation data for a given address. It validates the response to ensure
   * the result is within the United States and rejects generic or fallback results.
   *
   * @param {string} address - The physical address to geocode.
   * @return {Promise<GeocodeResult | null>} A promise that resolves to a GeocodeResult object
   * containing latitude, longitude, and the formatted address if successful, or null if:
   *   - The API key is missing.
   *   - No results are found.
   *   - The best result is outside the U.S.
   *   - The result is too generic (e.g., "United States").
   *
   * @throws {Error} Logs and returns null if the Google Maps API request fails.
   */
  async geocodeAddress(address: string): Promise<GeocodeResult | null> {
    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) return null;

      const params = new URLSearchParams({
        address,
        key: apiKey,
        components: "country:US",
        region: "us",
      });

      const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;
      const response = await fetch(url);
      const data = (await response.json()) as GoogleMapsResponse;

      if (!data.results || data.results.length === 0) {
        logger.warn(
          "No geocoding results found for address:",
          address,
          "Status:",
          data.status
        );
        return null;
      }

      const result = data.results[0];

      // Safety check: ensure the chosen result is actually in the U.S.
      const country = result.address_components?.find((c) =>
        c.types.includes("country")
      );
      if (!country || country.short_name !== "US") {
        logger.warn(
          "Geocoding result is outside the U.S.; returning null for address:",
          address
        );
        return null;
      }

      // Additional validation: Reject generic or fallback results
      if (
        result.formatted_address === "United States" ||
        result.address_components.length < 2
      ) {
        logger.warn(
          "Geocoding result is too generic; returning null for address:",
          address
        );
        return null;
      }

      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
      };
    } catch (error) {
      logger.error("Google Geocoding API error:", error);
      return null;
    }
  }
}
