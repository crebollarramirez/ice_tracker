import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { OpenAIService } from "./utils/aiFilter";
import { GoogleGeocodingService } from "./utils/geocodingService";
import { sanitizeInput } from "./utils/addressHandling";
import { isValidISO8601, isDateTodayUTC } from "./utils/utils";

// Initialize Firebase Admin
admin.initializeApp();

setGlobalOptions({ maxInstances: 10 });

// Initialize services
const aiFilterService = new OpenAIService();
const geocodingService = new GoogleGeocodingService();

const realtimeDb = admin.database();
const firestoreDb = admin.firestore();

/**
 * Updates pin statistics in the realtime database
 * @param addedAt - ISO timestamp string when the location was added
 */
async function updatePinStats(addedAt: string): Promise<void> {
  const statsRef = realtimeDb.ref("stats");
  const isToday = isDateTodayUTC(addedAt);

  // Use transaction for atomic updates
  await statsRef.transaction((currentStats) => {
    // Initialize stats if they don't exist
    if (!currentStats) {
      currentStats = {
        total_pins: 0,
        today_pins: 0,
        week_pins: 0,
      };
    }

    // Ensure all fields exist
    if (typeof currentStats.total_pins !== "number") {
      currentStats.total_pins = 0;
    }
    if (typeof currentStats.today_pins !== "number") {
      currentStats.today_pins = 0;
    }
    if (typeof currentStats.week_pins !== "number") {
      currentStats.week_pins = 0;
    }

    // Update the stats
    currentStats.total_pins += 1;
    currentStats.week_pins += 1; // Increment weekly count

    if (isToday) {
      currentStats.today_pins += 1;
    }

    return currentStats;
  });
}

/**
 * Firebase Cloud Function to pin a location with address validation and content filtering.
 *
 * This function accepts location data, validates and sanitizes the input, filters for negative content,
 * geocodes the address to get precise coordinates, stores the location in Firebase Realtime Database,
 * and updates pin statistics.
 *
 * @param {CallableRequest} request - The Firebase functions request object
 * @param {object} request.data - The data payload containing location information
 * @param {string} request.data.addedAt - ISO 8601 timestamp when the location was added (must be today's date in UTC)
 * @param {string} request.data.address - The physical address to be pinned (required)
 * @param {string} [request.data.additionalInfo] - Optional additional information about the location
 *
 * @returns {Promise<{message: string, formattedAddress: string}>} Promise that resolves to an object containing:
 *   - message: Success confirmation message
 *   - formattedAddress: The geocoded and formatted address from Google Maps API
 *
 * @throws {HttpsError}
 *   - 'invalid-argument': When required fields are missing, date format is invalid, or address is invalid
 *   - 'failed-precondition': When additional info contains negative or abusive language
 *   - 'not-found': When the provided address cannot be geocoded or found on the map
 *   - 'internal': When there's a database error during save operation
 *
 * @example
 * // Call from client using Firebase SDK:
 * import { getFunctions, httpsCallable } from 'firebase/functions';
 *
 * const functions = getFunctions();
 * const pinLocation = httpsCallable(functions, 'pin');
 *
 * const result = await pinLocation({
 *   addedAt: new Date().toISOString(), // Must be today's date
 *   address: "1600 Amphitheatre Parkway, Mountain View, CA",
 *   additionalInfo: "Google headquarters"
 * });
 *
 * @description
 * Processing flow:
 * 1. Validates required fields (addedAt, address) are present
 * 2. Validates addedAt is in ISO 8601 format and represents today's date in UTC
 * 3. Sanitizes address and additionalInfo inputs to prevent XSS attacks
 * 4. Uses AI service to detect negative content in additionalInfo
 * 5. Logs detected negative content to Firestore for monitoring
 * 6. Geocodes address using Google Maps Geocoding API to get coordinates
 * 7. Saves location data with coordinates to Firebase Realtime Database
 * 8. Updates pin statistics (total_pins, today_pins, week_pins) atomically
 * 9. Returns success message with formatted address
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
      await firestoreDb.collection("negative").add({
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
    const newLocationRef = realtimeDb.ref("locations").push();
    await newLocationRef.set(finalLocationData);

    // Update pin statistics
    await updatePinStats(data.addedAt);

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

// Extract the cleanup logic for testing
// export const performDailyCleanup = async () => {
//   logger.info("Database cleanup started");

//   try {
//     const locationsRef = realtimeDb.ref("locations");

//     // Calculate the cutoff date (7 days ago) for logging purposes
//     const cutoffDate = new Date();
//     cutoffDate.setDate(cutoffDate.getDate() - 7);
//     const cutoffTimestamp = cutoffDate.toISOString();

//     logger.info(
//       "Moving old data to Firestore and cleaning up RTDB for data older than:",
//       cutoffTimestamp
//     );

//     // Get all locations
//     const snapshot = await locationsRef.once("value");
//     const locations = snapshot.val();

//     if (!locations) {
//       logger.info("No locations found in database");
//       return;
//     }

//     let movedCount = 0;
//     const movePromises: Promise<void>[] = [];

//     // Iterate through all locations and identify old ones
//     Object.keys(locations).forEach((locationId) => {
//       const location = locations[locationId];

//       if (location.addedAt && isOlderThan7Days(location.addedAt)) {
//         // This location is older than a week, move it to Firestore and remove from RTDB
//         movePromises.push(
//           (async () => {
//             try {
//               // Add to Firestore oldPins collection
//               await firestoreDb.collection("oldPins").add(location);

//               // Remove from Realtime Database
//               await locationsRef.child(locationId).remove();

//               logger.info("Moved old location to Firestore:", {
//                 locationId,
//                 addedAt: location.addedAt,
//                 address: location.address,
//               });
//             } catch (error) {
//               logger.error("Error moving location:", {
//                 locationId,
//                 error: error instanceof Error ? error.message : String(error),
//               });
//               throw error;
//             }
//           })()
//         );
//         movedCount++;
//       }
//     });

//     // Execute all move operations
//     await Promise.all(movePromises);

//     logger.info("Database cleanup completed successfully", {
//       totalLocations: Object.keys(locations).length,
//       movedToFirestore: movedCount,
//       cutoffDate: cutoffTimestamp,
//     });
//   } catch (error) {
//     logger.error("Error during database cleanup:", error);
//     throw error;
//   }
// };

// export const dailyTask = onSchedule("every 24 hours", performDailyCleanup);
