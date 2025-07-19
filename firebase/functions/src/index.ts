import {setGlobalOptions} from "firebase-functions";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {OpenAIService} from "./utils/aiFilter";
import {GoogleGeocodingService} from "./utils/geocodingService";
import { sanitizeInput } from "./utils/addressHandling";

// Initialize Firebase Admin
admin.initializeApp();

setGlobalOptions({ maxInstances: 10 });

// Initialize services
const aiFilterService = new OpenAIService();
const geocodingService = new GoogleGeocodingService();


/**
 * Firebase Cloud Function to pin a location with address validation and content filtering.
 *
 * This function accepts location data, validates and sanitizes the input, filters for negative content,
 * geocodes the address to get precise coordinates, and stores the location in Firebase Realtime Database.
 *
 * @param {Object} request - The Firebase functions request object
 * @param {Object} request.data - The data payload containing location information
 * @param {string} request.data.addedAt - ISO timestamp when the location was added (required)
 * @param {string} request.data.address - The address to be pinned (required)
 * @param {string} [request.data.additionalInfo] - Optional additional information about the location
 *
 * @returns {Promise<Object>} Promise that resolves to an object containing:
 *   - message: Success message
 *   - formattedAddress: The geocoded and formatted address from Google Maps
 *
 * @throws {HttpsError}
 *   - 'invalid-argument': When required fields (addedAt, address) are missing or address is invalid
 *   - 'failed-precondition': When additional info contains negative or abusive content
 *   - 'not-found': When the provided address cannot be geocoded/found on the map
 *   - 'internal': When there's a database error during save operation
 *
 * @example
 * // Call from client:
 * const result = await pin({
 *   addedAt: "2025-07-18T10:30:00.000Z",
 *   address: "1600 Amphitheatre Parkway, Mountain View, CA",
 *   additionalInfo: "Google headquarters"
 * });
 *
 * @description
 * Processing flow:
 * 1. Validates required fields (addedAt, address)
 * 2. Sanitizes input to prevent XSS attacks
 * 3. Uses AI service to detect negative content in additionalInfo
 * 4. Logs negative content to separate collection for monitoring
 * 5. Geocodes address using Google Geocoding API
 * 6. Saves location data with coordinates to Firebase Realtime Database
 * 7. Returns success message with formatted address
 */
export const pin = onCall(async (request) => {
  logger.info("pin called", { data: request.data });

  const { data } = request;

  if (!data.addedAt || !data.address) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required fields: addedAt and address"
    );
  }

  // Sanitize the address input
  const sanitizedAddress = sanitizeInput(data.address);

  // Sanitize additionalInfo to prevent injection attacks, default to empty string if not provided
  const sanitizedAdditionalInfo = sanitizeInput(data.additionalInfo || "");

  if (!sanitizedAddress.trim()) {
    throw new HttpsError("invalid-argument", "Invalid address provided");
  }

  // Check for negative content using AI filter service
  const isNegative = await aiFilterService.isNegative(sanitizedAdditionalInfo);

  if (isNegative) {
    // Log negative content to separate database for monitoring
    try {
      const db = admin.firestore();
      await db.collection("negative").add({
        addedAt: data.addedAt,
        address: sanitizedAddress,
        additionalInfo: sanitizedAdditionalInfo,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error saving negative content to database:", error);
    }
    throw new HttpsError(
      "failed-precondition",
      "Please avoid using negative or abusive language in the additional info"
    );
  }

  // Geocode the address to get coordinates and formatted address
  const geocodeResult = await geocodingService.geocodeAddress(sanitizedAddress);

  if (!geocodeResult) {
    throw new HttpsError(
      "not-found",
      "Please provide a valid address that can be found on the map"
    );
  }

  // Create final location data with geocoded coordinates and formatted address
  const finalLocationData = {
    addedAt: data.addedAt,
    address: geocodeResult.formattedAddress,
    additionalInfo: sanitizedAdditionalInfo,
    lat: geocodeResult.lat,
    lng: geocodeResult.lng,
  };

  // Database operations need error handling since they can throw exceptions
  try {
    const db = admin.database();
    const newLocationRef = db.ref("locations").push();
    await newLocationRef.set(finalLocationData);

    logger.info("POST request received and saved to database:", {
      locationId: newLocationRef.key,
      ...finalLocationData,
    });

    return {
      message: "Data logged and saved successfully",
      formattedAddress: finalLocationData.address,
    };
  } catch (error) {
    logger.error("Error saving to database:", error);
    throw new HttpsError("internal", "Internal server error");
  }
});
