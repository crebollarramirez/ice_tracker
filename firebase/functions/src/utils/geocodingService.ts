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
   * Geocodes a specific physical address using the Google Maps Geocoding API.
   *
   * This method sends a request to the Google Maps Geocoding API with strict filtering
   * to only accept specific address types (street addresses, premises, subpremises, or
   * intersections). It validates the response to ensure the result is within the United
   * States and rejects generic or city-level addresses.
   *
   * @param {string} address - The physical address to geocode.
   * @return {Promise<GeocodeResult | null>} A promise that resolves to a GeocodeResult object
   * containing latitude, longitude, and the formatted address if successful, or null if:
   *   - The API key is missing.
   *   - No results are found.
   *   - The result is outside the U.S.
   *   - The result is too generic (e.g., "United States", city-only addresses like "Los Angeles, CA").
   *   - The result lacks specificity (no street number, route, or establishment).
   *   - The result has fewer than 3 address components.
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
        // limit it to more specific addresses like exact addresses, premises, or intersections
        result_type: "street_address|premise|subpremise|intersection",
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
      const addressComponents = result.address_components;
      const hasStreetNumber = addressComponents.some((c) =>
        c.types.includes("street_number")
      );
      const hasRoute = addressComponents.some((c) => c.types.includes("route"));
      const hasEstablishment = addressComponents.some((c) =>
        c.types.includes("establishment")
      );

      // Check if it's just a city/locality pattern (e.g., "Los Angeles, CA" or "Los Angeles, CA, USA")
      const isCityPattern = /^[^,]+,\s*[A-Z]{2}(,\s*USA)?$/i.test(
        result.formatted_address
      );

      if (
        result.formatted_address === "United States" ||
        addressComponents.length < 3 ||
        isCityPattern ||
        (!hasStreetNumber && !hasRoute && !hasEstablishment)
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
