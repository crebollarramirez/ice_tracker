import * as admin from "firebase-admin";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize Firebase Admin SDK
admin.initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID || "iceinmyarea",
  databaseURL:
    process.env.FIREBASE_DATABASE_URL ||
    "https://iceinmyarea-default-rtdb.firebaseio.com/",
});

interface AddressData {
  addedAt: string;
  additionalInfo: string;
  address: string;
  lat: number;
  lng: number;
  reported?: number;
}

interface ConsolidatedData extends AddressData {
  reported: number;
}

interface PinLocation {
  addedAt: string;
  address: string;
  additionalInfo?: string;
  lat: number;
  lng: number;
  reported?: number;
}

// THIS HAS BEEN TESTED ALREADY. FUNCTION LOGIC IS EXACTLY THE SAME IN THE BACKEND LOGIC.
export const makeAddressKey = (address: string): string => {
  if (!address || typeof address !== "string") return "";

  return address
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove special chars except word chars, spaces, hyphens
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/-+/g, "_") // Replace hyphens with underscores
    .replace(/_+/g, "_") // Replace multiple underscores with single
    .replace(/^_|_$/g, "") // Remove leading/trailing underscores
    .substring(0, 200); // Limit length for Firebase key constraints
};

export async function migrateRealtimeDatabase(
  realtimeDb: admin.database.Database
) {
  console.log("🔄 Starting Realtime Database migration...");

  const ref = realtimeDb.ref("locations"); // Adjust this path based on your data structure

  try {
    const snapshot = await ref.once("value");
    const data = snapshot.val();

    if (!data) {
      console.log("No data found in Realtime Database");
      return;
    }

    const consolidatedData = new Map<string, ConsolidatedData>();

    // Process each record
    Object.entries(data).forEach(([originalKey, record]: [string, any]) => {
      const addressKey = makeAddressKey(record.address);
      if (!addressKey) {
        console.warn(`Skipping record ${originalKey} - invalid address key`);
        return;
      }

      if (consolidatedData.has(addressKey)) {
        // Duplicate found - increment reported count and keep most recent
        const existing = consolidatedData.get(addressKey)!;
        existing.reported += 1;

        // Compare dates and keep the most recent data
        const existingDate = new Date(existing.addedAt);
        const currentDate = new Date(record.addedAt);

        if (currentDate > existingDate) {
          // Current record is more recent, update all fields except reported count
          existing.addedAt = record.addedAt;
          existing.additionalInfo = record.additionalInfo || "";
          existing.address = record.address;
          existing.lat = record.lat;
          existing.lng = record.lng;
          console.log(
            `Updated to more recent data for address: ${record.address} (key: ${addressKey})`
          );
        } else {
          console.log(
            `Found duplicate for address: ${record.address} (key: ${addressKey}) - keeping existing more recent data`
          );
        }
      } else {
        // New address - add with reported count of 1
        consolidatedData.set(addressKey, {
          addedAt: record.addedAt,
          additionalInfo: record.additionalInfo || "",
          address: record.address,
          lat: record.lat,
          lng: record.lng,
          reported: 1,
        });
      }
    });

    console.log(
      `✅ Processed ${Object.keys(data).length} records from Realtime Database`
    );
    console.log(`📊 Consolidated to ${consolidatedData.size} unique addresses`);

    // Write transformed data back to Realtime Database
    console.log("🔄 Transforming Realtime Database data...");

    // Clear existing data
    await ref.remove();
    console.log("🗑️  Cleared old Realtime Database data");

    // Write consolidated data with new keys
    const updates: { [key: string]: ConsolidatedData } = {};
    consolidatedData.forEach((data, key) => {
      updates[key] = data;
    });

    await ref.update(updates);
    console.log("✅ Successfully transformed Realtime Database data");

    // Display summary for RTDB
    const multipleReports = Array.from(consolidatedData.entries())
      .filter(([_, data]) => data.reported > 1)
      .sort(([_, a], [__, b]) => b.reported - a.reported);

    if (multipleReports.length > 0) {
      console.log("\n🔥 RTDB - Most reported addresses:");
      multipleReports.slice(0, 5).forEach(([key, data]) => {
        console.log(`  ${data.address} - ${data.reported} reports`);
      });
    }
  } catch (error) {
    console.error("Error migrating Realtime Database:", error);
    throw error;
  }
}

export async function migrateFirestore(firestoreDb: admin.firestore.Firestore) {
  console.log("🔄 Starting Firestore migration...");

  const collection = firestoreDb.collection("old-pins"); // Adjust collection name as needed

  try {
    const snapshot = await collection.get();

    if (snapshot.empty) {
      console.log("No data found in Firestore");
      return;
    }

    const consolidatedData = new Map<string, ConsolidatedData>();

    // Process each document
    snapshot.docs.forEach((doc) => {
      const record = doc.data() as AddressData;

      if (!record.address) {
        console.warn(`Skipping document ${doc.id} - missing address`);
        return;
      }

      const addressKey = makeAddressKey(record.address);
      if (!addressKey) {
        console.warn(`Skipping document ${doc.id} - invalid address key`);
        return;
      }

      if (consolidatedData.has(addressKey)) {
        // Duplicate found - increment reported count and keep most recent
        const existing = consolidatedData.get(addressKey)!;
        existing.reported += 1;

        // Compare dates and keep the most recent data
        const existingDate = new Date(existing.addedAt);
        const currentDate = new Date(record.addedAt);

        if (currentDate > existingDate) {
          // Current record is more recent, update all fields except reported count
          existing.addedAt = record.addedAt;
          existing.additionalInfo = record.additionalInfo || "";
          existing.address = record.address;
          existing.lat = record.lat;
          existing.lng = record.lng;
          console.log(
            `Updated to more recent data for address: ${record.address} (key: ${addressKey})`
          );
        } else {
          console.log(
            `Found duplicate for address: ${record.address} (key: ${addressKey}) - keeping existing more recent data`
          );
        }
      } else {
        // New address - add with reported count of 1
        consolidatedData.set(addressKey, {
          addedAt: record.addedAt,
          additionalInfo: record.additionalInfo || "",
          address: record.address,
          lat: record.lat,
          lng: record.lng,
          reported: 1,
        });
      }
    });

    console.log(
      `✅ Processed ${snapshot.docs.length} documents from Firestore`
    );
    console.log(`📊 Consolidated to ${consolidatedData.size} unique addresses`);

    // Write transformed data back to Firestore
    console.log("🔄 Transforming Firestore data...");

    // Delete all existing documents in batches
    const deletePromises = [];
    for (let i = 0; i < snapshot.docs.length; i += 500) {
      const batch = firestoreDb.batch();
      const batchDocs = snapshot.docs.slice(i, i + 500);
      batchDocs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      deletePromises.push(batch.commit());
    }

    await Promise.all(deletePromises);
    console.log("🗑️  Cleared old Firestore data");

    // Write consolidated data with new document IDs
    const writePromises = [];
    const consolidatedArray = Array.from(consolidatedData.entries());

    for (let i = 0; i < consolidatedArray.length; i += 500) {
      const batch = firestoreDb.batch();
      const batchData = consolidatedArray.slice(i, i + 500);

      batchData.forEach(([key, data]) => {
        const docRef = collection.doc(key);
        batch.set(docRef, data);
      });

      writePromises.push(batch.commit());
    }

    await Promise.all(writePromises);
    console.log("✅ Successfully transformed Firestore data");

    // Display summary for Firestore
    const multipleReports = Array.from(consolidatedData.entries())
      .filter(([_, data]) => data.reported > 1)
      .sort(([_, a], [__, b]) => b.reported - a.reported);

    if (multipleReports.length > 0) {
      console.log("\n🔥 Firestore - Most reported addresses:");
      multipleReports.slice(0, 5).forEach(([key, data]) => {
        console.log(`  ${data.address} - ${data.reported} reports`);
      });
    }
  } catch (error) {
    console.error("Error migrating Firestore:", error);
    throw error;
  }
}

async function runMigration() {
  console.log("🚀 Starting Firebase data migration...");
  console.log("=====================================");
  console.log("Each database will be transformed independently:");
  console.log("- Realtime Database: Transform data in place with new keys");
  console.log("- Firestore: Transform data in place with new document IDs");
  console.log("=====================================\n");

  // Initialize database references
  const realtimeDb = admin.database();
  const firestoreDb = admin.firestore();

  try {
    // Ask for confirmation before starting
    console.log(
      "⚠️  This will transform and replace all existing data in both databases."
    );
    console.log("Make sure you have backed up your data before proceeding.");
    console.log("📦 Proceeding with migration...\n");

    // Transform data in both databases independently
    await Promise.all([
      migrateRealtimeDatabase(realtimeDb),
      migrateFirestore(firestoreDb),
    ]);

    console.log("\n🎉 Migration completed successfully!");
    console.log("=====================================");
    console.log("✅ Realtime Database data has been transformed with new keys");
    console.log("✅ Firestore data has been transformed with new document IDs");
    console.log("✅ Duplicates have been consolidated in each database");
    console.log("✅ 'reported' field has been added to track duplicate counts");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    // Close the app
    await admin.app().delete();
  }
}

async function runStatsRecalculation() {
  console.log("📊 Starting stats recalculation...");
  console.log("=====================================");
  console.log("This will recalculate statistics from both databases:");
  console.log("- Realtime Database: Live pins");
  console.log("- Firestore: Old pins");
  console.log("=====================================\n");

  // Initialize database references
  const realtimeDb = admin.database();
  const firestoreDb = admin.firestore();

  try {
    const result = await recalculateStats(realtimeDb, firestoreDb);
    console.log("\n🎉 Stats recalculation completed successfully!");
    console.log("=====================================");
    console.log(`✅ ${result.message}`);
  } catch (error) {
    console.error("❌ Stats recalculation failed:", error);
    process.exit(1);
  } finally {
    // Close the app
    await admin.app().delete();
  }
}

function showUsage() {
  console.log("Firebase Migration Tool");
  console.log("======================");
  console.log("");
  console.log("Usage:");
  console.log(
    "  npm run migrate migrateDBs       - Migrate and consolidate both databases"
  );
  console.log(
    "  npm run migrate recalculateStats  - Recalculate statistics from both databases"
  );
  console.log("");
  console.log("Alternative usage:");
  console.log("  node migrations.js migrateDBs");
  console.log("  node migrations.js recalculateStats");
  console.log("");
  console.log("Commands:");
  console.log(
    "  migrateDBs        Consolidate duplicate addresses in both RTDB and Firestore"
  );
  console.log(
    "  recalculateStats  Recalculate pin statistics from both databases"
  );
  console.log("");
}

/**
 * @async
 * @function recalculateStats
 * @description
 * Recalculates statistics for pins stored in both Realtime Database and Firestore.
 *
 * - Aggregates the total number of pins, today's pins, and weekly pins.
 * - Sums up the `reported` counts from both databases, defaulting to 1 if missing.
 * - Updates the calculated statistics in the Realtime Database.
 *
 * @param {admin.database.Database} realtimeDb - The Realtime Database instance.
 * @param {admin.firestore.Firestore} firestoreDb - The Firestore instance.
 *
 * @throws {Error} If an error occurs during the recalculation process.
 *
 * @returns {Promise<{ message: string }>} Resolves with a success message upon completion.
 */
export async function recalculateStats(
  realtimeDb: admin.database.Database,
  firestoreDb: admin.firestore.Firestore
): Promise<{ message: string }> {
  console.info("Recalculating stats...");

  const locationsRef = realtimeDb.ref("locations");
  const statsRef = realtimeDb.ref("stats");
  const oldPinsCollection = firestoreDb.collection("old-pins");

  try {
    const snapshot = await locationsRef.once("value");
    const locations = snapshot.val();

    const oldPinsSnapshot = await oldPinsCollection.get();

    // Sum up reported counts from Firestore old pins
    let totalPins = 0;
    oldPinsSnapshot.docs.forEach((doc) => {
      const data = doc.data() as PinLocation;
      totalPins += data.reported || 1; // Default to 1 if reported field is missing
    });

    let todayPins = 0;
    let weekPins = 0;

    const now = new Date();
    const today = now.toISOString().split("T")[0]; // Today's date in YYYY-MM-DD format
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);

    if (locations) {
      Object.values(locations).forEach((location) => {
        const pinLocation = location as PinLocation;
        const reportedCount = pinLocation.reported || 1; // Default to 1 if reported field is missing

        // Add to total pins count
        totalPins += reportedCount;

        const addedAt = new Date(pinLocation.addedAt);

        // Sum reported counts for today's pins
        if (addedAt.toISOString().split("T")[0] === today) {
          todayPins += reportedCount;
        }

        // Sum reported counts for week's pins
        if (addedAt >= weekAgo) {
          weekPins += reportedCount;
        }
      });
    }

    // Update the stats in the database
    await statsRef.set({
      total_pins: totalPins,
      today_pins: todayPins,
      week_pins: weekPins,
    });

    console.info("Stats recalculated successfully", {
      totalPins,
      todayPins,
      weekPins,
    });

    return { message: "Stats recalculated successfully" };
  } catch (error) {
    console.error("Error recalculating stats:", error);
    throw new Error("Error recalculating stats");
  }
}

// Run commands based on command line arguments if this file is executed directly (not imported in tests)
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "migrateDBs":
      runMigration().catch((error) => {
        console.error("Failed to run migration:", error);
        process.exit(1);
      });
      break;

    case "recalculateStats":
      runStatsRecalculation().catch((error) => {
        console.error("Failed to recalculate stats:", error);
        process.exit(1);
      });
      break;

    case "--help":
    case "-h":
    case "help":
      showUsage();
      break;

    default:
      if (!command) {
        console.error("❌ No command provided.\n");
      } else {
        console.error(`❌ Unknown command: ${command}\n`);
      }
      showUsage();
      process.exit(1);
  }
}
