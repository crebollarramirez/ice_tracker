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
   * States and rejects generic or overly broad addresses.
   *
   * The function applies different validation rules based on address type:
   * - For intersections: Requires route, sublocality, or locality components
   * - For other addresses: Requires street number, route, or establishment
   * - All addresses: Must have at least 3 address components and be US-based
   *
   * @param {string} address - The physical address to geocode (e.g., "123 Main St, City, State",
   *   "Hollywood Blvd & Vine St, Los Angeles, CA", "Apple Park, Cupertino, CA").
   * @return {Promise<GeocodeResult | null>} A promise that resolves to a GeocodeResult object
   * containing latitude, longitude, and the formatted address if successful, or null if:
   *   - The Google Maps API key is missing from environment variables
   *   - No geocoding results are found for the given address
   *   - The result is located outside the United States
   *   - The result is too generic (e.g., "United States" or city-only like "Los Angeles, CA")
   *   - The result has fewer than 3 address components
   *   - For non-intersections: lacks street number, route, or establishment
   *   - For intersections: lacks route, sublocality, or locality information
   *
   * @throws {Error} Does not throw errors; logs API failures and returns null instead.
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
      const isIntersection = addressComponents.some((c) =>
        c.types.includes("intersection")
      );

      // Check if it's just a city/locality pattern (e.g., "Los Angeles, CA" or "Los Angeles, CA, USA")
      const isCityPattern = /^[^,]+,\s*[A-Z]{2}(,\s*USA)?$/i.test(
        result.formatted_address
      );

      // Check if the input address looks like an intersection
      const isIntersectionInput = /\b(and|&)\b/i.test(address);

      if (
        result.formatted_address === "United States" ||
        addressComponents.length < 3 ||
        isCityPattern
      ) {
        logger.warn(
          "Geocoding result is too generic; returning null for address:",
          address
        );
        return null;
      }

      // For intersection addresses, be more permissive - just check if we have meaningful components
      if (isIntersection || isIntersectionInput) {
        // Allow intersections if they have route, sublocality, or other meaningful location data
        const hasSublocality = addressComponents.some(
          (c) =>
            c.types.includes("sublocality") ||
            c.types.includes("sublocality_level_1")
        );
        const hasLocality = addressComponents.some((c) =>
          c.types.includes("locality")
        );

        if (!hasRoute && !hasSublocality && !hasLocality) {
          logger.warn(
            "Intersection result lacks meaningful location information; returning null for address:",
            address
          );
          return null;
        }
      } else {
        // For non-intersection addresses, require more specificity
        if (!hasStreetNumber && !hasRoute && !hasEstablishment) {
          logger.warn(
            "Geocoding result lacks specificity; returning null for address:",
            address
          );
          return null;
        }
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
