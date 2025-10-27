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
import { clientIp, ipKey, todayUTC } from "./utils/utils";
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
 * @async
 * @function enforceDailyQuotaByIp
 * @description
 * Enforces a daily quota for the number of calls allowed per IP address for a specific logical bucket.
 *
 * - Retrieves the client IP address from the request.
 * - Checks if the IP address has exceeded the daily limit for the specified bucket.
 * - Updates the Firestore document to track the count and reset it for a new day.
 *
 * @param {any} req - The request object containing client information.
 * @param {string} bucket - The logical bucket name for rate limiting.
 * @param {number} [limit=3] - The maximum number of allowed calls per day (default is 3).
 * @throws {HttpsError} If the client IP address is unknown or cannot be determined.
 * @returns {Promise<boolean>} Resolves to `true` if the limit is exceeded, otherwise `false`.
 */
export async function enforceDailyQuotaByIp(
  req: any,
  bucket: string,
  limit = 3
): Promise<boolean> {
  const ip = clientIp(req);

  // Reject requests with unknown IP to prevent abuse
  if (ip === "unknown") {
    throw new HttpsError(
      "failed-precondition",
      "Unable to determine client IP address. Request blocked for security."
    );
  }

  const key = ipKey(ip);
  const doc = firestoreDb.collection("rate_daily_ip").doc(`${bucket}_${key}`);
  const today = todayUTC();

  const result = await firestoreDb.runTransaction(async (tx) => {
    const snap = await tx.get(doc);
    const data = snap.exists ? (snap.data() as any) : {};
    const date = data?.date ?? today;
    let count = typeof data?.count === "number" ? data.count : 0;

    if (date !== today) count = 0; // new day → reset

    if (count >= limit) {
      return true; // Above limit
    }

    tx.set(
      doc,
      {
        date: today,
        count: count + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        // TTL: automatically delete after 25 hours (1 day + 1 hour buffer)
        deleteAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
      },
      { merge: true }
    );

    return false; // Below limit, request allowed
  });

  return result;
}

/**
 * Updates pin statistics in the realtime database.
 *
 * This function increments the total, weekly, and daily pin counts
 * in the Firebase Realtime Database. It ensures atomic updates
 * using transactions.
 *
 * @async
 * @function updatePinStats
 * @param {string} addedAt - ISO timestamp string when the location was added.
 * @return {Promise<void>} A promise that resolves when the stats are updated.
 * @throws {Error} If there is an issue during the transaction.
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
 * @async
 * @function pin
 * @param {CallableRequest} request - The Firebase functions request object.
 * @param {object} request.data - The data payload containing location information.
 * @param {string} request.data.addedAt - ISO 8601 timestamp when the location was added (must be today's date in UTC).
 * @param {string} request.data.address - The physical address to be pinned (required).
 * @param {string} [request.data.additionalInfo] - Optional additional information about the location.
 * @returns {Promise<{message: string, formattedAddress: string}>} A promise that resolves to an object containing:
 *   - message: Success confirmation message.
 *   - formattedAddress: The geocoded and formatted address from Google Maps API.
 * @throws {HttpsError} If validation fails, geocoding fails, or database operations encounter an error.
 */
export const pin = onCall({ enforceAppCheck: true }, async (request) => {
  logger.info("pin called", { data: request.data });

  // Enforce rate limiting: max 3 calls per IP per day
  const isAboveLimit = await enforceDailyQuotaByIp(request, "pin", 3);

  if (isAboveLimit) {
    throw new HttpsError(
      "resource-exhausted",
      "Daily limit reached. Try again tomorrow."
    );
  }

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

    // update stats regarless of new or existing location since we are counting reports
    await updatePinStats(data.addedAt);

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

/**
 *
 * @description
 * Performs daily cleanup of the Firebase Realtime Database and Firestore.
 *
 * This function moves pins older than 7 days from the Realtime Database (`locations` node) to Firestore (`old-pins` collection),
 * resets the `today_pins` counter to 0, and adjusts the `week_pins` counter by subtracting the number of pins older than 7 days.
 *
 * @async
 * @function performDailyCleanup
 * @return {Promise<void>} A promise that resolves when the cleanup is complete.
 * @throws {HttpsError} If there is an issue during the cleanup process, such as database or Firestore errors.
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
                // Check if this location already exists in Firestore using the locationId as document ID
                const existingDocRef = firestoreDb
                  .collection("old-pins")
                  .doc(locationId);
                const existingDoc = await existingDocRef.get();

                if (existingDoc.exists) {
                  // Document exists, update it
                  const existingData = existingDoc.data() as PinLocation;
                  const updatedData: Partial<PinLocation> = {
                    addedAt: location.addedAt, // Update with most recent addedAt
                    reported:
                      (existingData.reported || 0) + (location.reported || 1), // Increment reported count
                  };

                  // Update additionalInfo only if it's provided and not empty
                  if (
                    location.additionalInfo &&
                    location.additionalInfo.trim()
                  ) {
                    updatedData.additionalInfo = location.additionalInfo;
                  }

                  await existingDocRef.update(updatedData);

                  logger.info("Updated existing location in Firestore:", {
                    locationId,
                    addedAt: location.addedAt,
                    address: location.address,
                    reported: updatedData.reported,
                  });
                } else {
                  // Document doesn't exist, create it with the locationId as document ID
                  await existingDocRef.set(location);

                  logger.info("Added new location to Firestore:", {
                    locationId,
                    addedAt: location.addedAt,
                    address: location.address,
                  });
                }

                // Remove from Realtime Database
                await locationsRef.child(locationId).remove();
              } catch (error) {
                // throw new HttpsError("aborted", "Error moving old location to Firestore")
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

/**
 * Scheduled task to perform daily cleanup at 11:59 PM UTC.
 *
 * This task invokes the `performDailyCleanup` function to handle database maintenance.
 *
 * @function dailyTask
 */
export const dailyTask = onSchedule("59 23 * * *", performDailyCleanup);
