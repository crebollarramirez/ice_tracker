import { setGlobalOptions } from "firebase-functions";
import { HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { isOlderThan7Days, clientIp, ipKey, todayUTC } from "./utils/utils";
import { PinLocation, FirebaseCallableRequest } from "./types/index";
// import { isDateTodayUTC } from "./utils/utils";
import * as dotenv from "dotenv";
dotenv.config();

// Initialize Firebase Admin
admin.initializeApp();

// Import and re-export functions
export { pin } from "./functions/pin";

setGlobalOptions({ maxInstances: 10 });

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
 * @param {FirebaseCallableRequest} req - The request object containing client information.
 * @param {string} bucket - The logical bucket name for rate limiting.
 * @param {number} [limit=3] - The maximum number of allowed calls per day (default is 3).
 * @throws {HttpsError} If the client IP address is unknown or cannot be determined.
 * @return {Promise<boolean>} Resolves to `true` if the limit is exceeded, otherwise `false`.
 */
export async function enforceDailyQuotaByIp(
  req: FirebaseCallableRequest,
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
    const data = snap.exists ? snap.data() : {};
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

        // Proper Firestore Timestamp for TTL (25 hours ahead)
        deleteAt: admin.firestore.Timestamp.fromMillis(
          Date.now() + 25 * 60 * 60 * 1000
        ),
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
// async function updatePinStats(addedAt: string): Promise<void> {
//   const statsRef = realtimeDb.ref("stats");
//   const isToday = isDateTodayUTC(addedAt);

//   // Use transaction for atomic updates
//   await statsRef.transaction((currentStats) => {
//     // Initialize stats if they don't exist
//     if (!currentStats) {
//       currentStats = {
//         total_pins: 0,
//         today_pins: 0,
//         week_pins: 0,
//       };
//     }

//     // Ensure all fields exist
//     if (typeof currentStats.total_pins !== "number") {
//       currentStats.total_pins = 0;
//     }
//     if (typeof currentStats.today_pins !== "number") {
//       currentStats.today_pins = 0;
//     }
//     if (typeof currentStats.week_pins !== "number") {
//       currentStats.week_pins = 0;
//     }

//     // Update the stats
//     currentStats.total_pins += 1;
//     currentStats.week_pins += 1; // Increment weekly count

//     if (isToday) {
//       currentStats.today_pins += 1;
//     }

//     return currentStats;
//   });
// }

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
