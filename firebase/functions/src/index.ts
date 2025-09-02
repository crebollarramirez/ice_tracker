import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { OpenAIService } from "./utils/aiFilter";
import { GoogleGeocodingService } from "./utils/geocodingService";
import { sanitizeInput, makeAddressKey } from "./utils/addressHandling";
import {
  isValidISO8601,
  isDateTodayUTC,
  isOlderThan7Days,
} from "./utils/utils";
import { PinLocation } from "./types/index";
import * as dotenv from "dotenv";
dotenv.config();

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
 * @param {string} addedAt - ISO timestamp string when the location was added
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
    // Create a sanitized key from the formatted address
    const addressKey = makeAddressKey(geocodeResult.formattedAddress);

    if (!addressKey) {
      throw new HttpsError(
        "invalid-argument",
        "Could not generate valid address key"
      );
    }

    // Check if this address already exists
    const existingLocationRef = realtimeDb.ref(`locations/${addressKey}`);
    const existingSnapshot = await existingLocationRef.once("value");

    let locationId = addressKey;
    let isNewLocation = true;

    if (existingSnapshot.exists()) {
      // Address already exists, update it instead of creating duplicate
      isNewLocation = false;
      logger.info("Updating existing location:", {
        addressKey,
        formattedAddress: geocodeResult.formattedAddress,
      });
    } else {
      logger.info("Creating new location:", {
        addressKey,
        formattedAddress: geocodeResult.formattedAddress,
      });
    }

    // Set/update the location data
    await existingLocationRef.set(finalLocationData);

    // Only update pin statistics if this is a new location
    if (isNewLocation) {
      await updatePinStats(data.addedAt);
    }

    logger.info("POST request received and saved to database:", {
      locationId,
      isNewLocation,
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

/**
 * Performs daily cleanup of the Firebase Realtime Database and Firestore.
 *
 * This function is designed to:
 * 1. Move pins older than 7 days from the Realtime Database (`locations` node) to Firestore (`old-pins` collection).
 * 2. Reset the `today_pins` counter to 0 since a new day has started.
 * 3. Adjust the `week_pins` counter by subtracting the number of pins older than 7 days.
 *
 * @async
 * @function performDailyCleanup
 *
 * @throws {Error} If there is an issue during the cleanup process, such as database or Firestore errors.
 *
 * @description
 * Processing flow:
 * 1. Calculate the cutoff date (7 days ago) to identify old pins.
 * 2. Retrieve all pins from the `locations` node in the Realtime Database.
 * 3. Identify pins older than 7 days and move them to the `old-pins` collection in Firestore.
 * 4. Remove the moved pins from the Realtime Database.
 * 5. Update the `stats` node in the Realtime Database:
 *    - Reset `today_pins` to 0.
 *    - Adjust `week_pins` by subtracting the number of pins moved to Firestore.
 * 6. Log the results of the cleanup process, including the number of pins moved and updated statistics.
 *
 * @example
 * // This function is scheduled to run daily at 11:59 PM UTC:
 */
export const performDailyCleanup = async () => {
  logger.info("Database cleanup started");

  try {
    const locationsRef = realtimeDb.ref("locations");
    const statsRef = realtimeDb.ref("stats");

    // Calculate the cutoff date (7 days ago) for logging purposes
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const cutoffTimestamp = cutoffDate.toISOString();

    logger.info(
      "Moving old data to Firestore and cleaning up RTDB for data older than:",
      cutoffTimestamp
    );

    // Get all locations
    const snapshot = await locationsRef.once("value");
    const locations = snapshot.val();

    let movedCount = 0;
    let weekOldCount = 0;
    const movePromises: Promise<void>[] = [];

    if (locations) {
      // Iterate through all locations and identify old ones
      Object.keys(locations).forEach((locationId) => {
        const location = locations[locationId];

        if (isOlderThan7Days(location.addedAt)) {
          weekOldCount++;
          // This location is older than a week, move it to Firestore and remove from RTDB
          movePromises.push(
            (async () => {
              try {
                // Add to Firestore old-pins collection
                await firestoreDb.collection("old-pins").add(location);

                // Remove from Realtime Database
                await locationsRef.child(locationId).remove();

                logger.info("Moved old location to Firestore:", {
                  locationId,
                  addedAt: location.addedAt,
                  address: location.address,
                });
              } catch (error) {
                // Defensive logging to prevent logger failures
                try {
                  logger.error("Error moving location:", {
                    locationId: String(locationId || "unknown"),
                    address: location?.address || "unknown",
                    errorMessage:
                      error instanceof Error ? error.message : "Unknown error",
                    errorType:
                      error instanceof Error ? error.name : typeof error,
                  });
                } catch (logError) {
                  // Fallback if structured logging fails
                  console.error(
                    `Failed to log error for location ${locationId}:`,
                    logError
                  );
                  console.error(
                    "Original error:",
                    error instanceof Error ? error.message : error
                  );
                }

                throw new HttpsError(
                  "aborted",
                  "Error moving old location to Firestore"
                );
              }
            })()
          );
          movedCount++;
        }
      });

      // Execute all move operations
      await Promise.all(movePromises);
    }

    // Update stats (this will run whether there are locations or not)
    await statsRef.transaction((currentStats) => {
      // Initialize stats if null or undefined
      if (!currentStats) {
        return {
          total_pins: 0,
          today_pins: 0,
          week_pins: 0,
        };
      }

      // Ensure all required fields exist and are numbers
      const stats = {
        total_pins:
          typeof currentStats.total_pins === "number"
            ? currentStats.total_pins
            : 0,
        today_pins: 0, // Always reset today_pins during daily cleanup
        week_pins:
          typeof currentStats.week_pins === "number"
            ? currentStats.week_pins
            : 0,
      };

      // Subtract the number of old pins that were removed from week_pins
      stats.week_pins = Math.max(0, stats.week_pins - weekOldCount);

      return stats;
    });

    if (!locations) {
      logger.info("No locations found in database");
    }

    logger.info("Database cleanup completed successfully", {
      totalLocations: locations ? Object.keys(locations).length : 0,
      movedToFirestore: movedCount,
      weekOldPinsRemoved: weekOldCount,
      cutoffDate: cutoffTimestamp,
      statsUpdated: "Reset today_pins to 0 and adjusted week_pins",
    });
  } catch (error) {
    throw new HttpsError("aborted", "database cleanup failed");
  }
};

export const dailyTask = onSchedule("59 23 * * *", performDailyCleanup);

/**
 * Callable function to recalculate statistics based on existing database data.
 *
 * This function aggregates pin statistics from both the Firebase Realtime Database
 * and Firestore. It is useful for one-time recalculations when statistics might
 * be inaccurate due to data inconsistencies or missing updates.
 *
 * @async
 * @function recalculateStats
 *
 * @returns {Promise<{message: string}>} A promise that resolves to an object containing:
 *   - message: A success message indicating the stats were recalculated.
 *
 * @throws {HttpsError} Throws an error with the following codes:
 *   - 'internal': If there is an issue during the recalculation process.
 *
 * @description
 * Processing flow:
 * 1. Fetches all live pins from the `locations` node in the Firebase Realtime Database.
 * 2. Fetches the count of old pins from the `old-pins` collection in Firestore.
 * 3. Aggregates the following statistics:
 *    - `total_pins`: Total number of pins (live + old).
 *    - `today_pins`: Number of pins added today.
 *    - `week_pins`: Number of pins added in the last 7 days.
 * 4. Updates the `stats` node in the Firebase Realtime Database with the aggregated values.
 * 5. Logs the results of the recalculation process.
 *
 */
export const recalculateStats = onCall(async () => {
  logger.info("Recalculating stats...");

  const locationsRef = realtimeDb.ref("locations");
  const statsRef = realtimeDb.ref("stats");
  const oldPinsCollection = firestoreDb.collection("old-pins");

  try {
    const snapshot = await locationsRef.once("value");
    const locations = snapshot.val();

    const oldPinsSnapshot = await oldPinsCollection.get();
    const oldPinsCount = oldPinsSnapshot.size;

    let totalPins = oldPinsCount; // Start with the count of old pins in Firestore
    let todayPins = 0;
    let weekPins = 0;

    const now = new Date();
    const today = now.toISOString().split("T")[0]; // Today's date in YYYY-MM-DD format
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);

    if (locations) {
      Object.values(locations).forEach((location) => {
        totalPins++;

        const pinLocation = location as PinLocation;

        const addedAt = new Date(pinLocation.addedAt);
        if (addedAt.toISOString().split("T")[0] === today) {
          todayPins++;
        }
        if (addedAt >= weekAgo) {
          weekPins++;
        }
      });
    }

    // Update the stats in the database
    await statsRef.set({
      total_pins: totalPins,
      today_pins: todayPins,
      week_pins: weekPins,
    });

    logger.info("Stats recalculated successfully", {
      totalPins,
      todayPins,
      weekPins,
    });

    return { message: "Stats recalculated successfully" };
  } catch (error) {
    logger.error("Error recalculating stats:", error);
    throw new HttpsError("internal", "Error recalculating stats");
  }
});
