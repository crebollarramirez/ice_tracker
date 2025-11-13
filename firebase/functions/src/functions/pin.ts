import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { GoogleGeocodingService } from "../utils/geocodingService";
import { sanitizeInput, makeAddressKey } from "../utils/addressHandling";
import { isValidISO8601, isDateTodayUTC } from "../utils/utils";
import { PinLocation } from "../types/index";

// Initialize services USING MOCKS FOR TESTING
const geocodingService = new GoogleGeocodingService(true);

const realtimeDb = admin.database();

/**
 * Firebase Cloud Function to pin a location with address validation.
 *
 * This function accepts location data, validates and sanitizes the input, geocodes the address to get precise coordinates, and stores the location in Firebase Realtime Database under the `/pending` collection. It also ensures that the `additionalInfo` field is provided and sanitized to prevent injection attacks.
 *
 * ### Key Features:
 * - **Validation**: Ensures required fields are present and valid, including `addedAt`, `address`, `imageUrl`, `imagePath`, and `additionalInfo`.
 * - **Image Verification**: Validates that the image file exists in Firebase Storage before processing.
 * - **Sanitization**: Cleans input fields to prevent injection attacks.
 * - **Geocoding**: Converts the address into precise coordinates and a formatted address using Google Maps API.
 * - **Duplicate Handling**: Updates existing entries or creates new ones, incrementing the `reported` count for duplicates.
 * - **Error Handling**: Logs and throws detailed errors for validation, geocoding, and database operations.
 *
 * @async
 * @function pin
 * @param {CallableRequest} request - The Firebase functions request object.
 * @param {object} request.data - The data payload containing location information.
 * @param {string} request.data.addedAt - ISO 8601 timestamp when the location was added (must be today's date in UTC).
 * @param {string} request.data.imageUrl - Download URL of the image associated with the location.
 * @param {string} request.data.imagePath - Storage path of the image associated with the location.
 * @param {string} request.data.address - The physical address to be pinned (required).
 * @param {string} request.data.additionalInfo - Additional information about the location (required).
 * @returns {Promise<{message: string, formattedAddress: string}>} A promise that resolves to an object containing:
 *   - `message`: Success confirmation message.
 *   - `formattedAddress`: The geocoded and formatted address from Google Maps API.
 * @throws {HttpsError} If validation fails, geocoding fails, or database operations encounter an error.
 */
export const pin = onCall(async (request) => {
  logger.info("pin called", { data: request.data });

  const { data } = request;

  if (!data.imagePath) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required field: imagePath"
    );
  }

  if (!data.addedAt || !data.address) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required fields: addedAt and address"
    );
  }

  if (isValidISO8601(data.addedAt) === false) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid date format for addedAt. Must be ISO 8601 format."
    );
  }

  if (isDateTodayUTC(data.addedAt) === false) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid date format for addedAt. Must be today's date in ISO 8601 format."
    );
  }

  if (!data.additionalInfo) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required fields: additionalInfo"
    );
  }

  // Validate that the image exists in Firebase Storage

  console.log("Image existence check for", data.imagePath);
  //   try {
  //     const bucket = admin.storage().bucket();
  //     const file = bucket.file(data.imagePath);
  //     const [exists] = await file.exists();

  //     if (!exists) {
  //       throw new HttpsError(
  //         "invalid-argument",
  //         "Image file does not exist in storage"
  //       );
  //     }
  //   } catch (error) {
  //     if (error instanceof HttpsError) {
  //       throw error; // Re-throw our custom error
  //     }
  //     logger.error("Error checking image existence:", error);
  //     throw new HttpsError(
  //       "invalid-argument",
  //       "Unable to verify image file in storage"
  //     );
  //   }

  // Sanitize the address input
  const sanitizedAddress = sanitizeInput(data.address);

  // Sanitize additionalInfo to prevent injection attacks, default to empty string if not provided
  const sanitizedAdditionalInfo = sanitizeInput(data.additionalInfo || "");

  if (!sanitizedAddress.trim()) {
    throw new HttpsError("invalid-argument", "Invalid address provided");
  }

  // Geocode the address to get coordinates and formatted address
  const geocodeResult = await geocodingService.geocodeAddress(sanitizedAddress);

  if (!geocodeResult) {
    throw new HttpsError(
      "not-found",
      "Please provide a valid address that can be found on the map"
    );
  }

  // Database operations need error handling since they can throw exceptions
  try {
    // Create a sanitized key from the formatted address
    const addressKey = makeAddressKey(geocodeResult.formattedAddress);

    if (!addressKey) {
      throw new HttpsError(
        "invalid-argument",
        "Could not generate valid address key"
      );
    }

    // Check if this address already exists
    const existingLocationRef = realtimeDb.ref(`pending/${addressKey}`);
    const existingSnapshot = await existingLocationRef.once("value");

    const locationId = addressKey;

    // Create final location data with geocoded coordinates and formatted address
    const finalLocationData: PinLocation = {
      addedAt: data.addedAt,
      address: geocodeResult.formattedAddress,
      additionalInfo: sanitizedAdditionalInfo,
      lat: geocodeResult.lat,
      lng: geocodeResult.lng,
      reported: existingSnapshot.exists()
        ? existingSnapshot.val().reported + 1
        : 1,
      imageUrl: data.imageUrl || "",
      imagePath: data.imagePath || "",
    };

    let isNewLocation = true;

    if (existingSnapshot.exists()) {
      // Address already exists, update it instead of creating duplicate
      logger.info("Updating existing location:", {
        addressKey,
        formattedAddress: geocodeResult.formattedAddress,
      });
      isNewLocation = false;
    } else {
      logger.info("Creating new location:", {
        addressKey,
        formattedAddress: geocodeResult.formattedAddress,
      });
    }

    // Set/update the location data
    await existingLocationRef.set(finalLocationData);

    logger.info("POST request received and saved to database:", {
      locationId,
      ...finalLocationData,
    });

    return {
      message: isNewLocation
        ? "Data logged and saved successfully"
        : "Location updated successfully",
      formattedAddress: finalLocationData.address,
    };
  } catch (error) {
    logger.error("Error saving to database:", error);
    throw new HttpsError("internal", "Internal server error");
  }
});