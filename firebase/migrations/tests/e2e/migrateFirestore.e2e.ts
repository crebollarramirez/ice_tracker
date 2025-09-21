// E2E tests for migrateFirestore function
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

import * as admin from "firebase-admin";
import { migrateFirestore } from "../../migrations";

// Configure Firebase Admin for testing with emulators
const TEST_PROJECT_ID = "test-migrate-firestore";

// Initialize Firebase Admin SDK for E2E testing
let app: admin.app.App;
let firestoreDb: admin.firestore.Firestore;

async function clearEmulator() {
  const collection = firestoreDb.collection("old-pins");
  await firestoreDb.recursiveDelete(collection);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function isoToday(): string {
  return new Date().toISOString();
}

describe("migrateFirestore E2E", () => {
  beforeAll(async () => {
    // Initialize Firebase Admin SDK for E2E testing
    app = admin.initializeApp(
      {
        projectId: TEST_PROJECT_ID,
      },
      `test-${Date.now()}`
    );

    firestoreDb = app.firestore();
  });

  beforeEach(async () => {
    await clearEmulator();
  });

  afterAll(async () => {
    try {
      await app.delete();
    } catch (error) {
      console.error("Error deleting app:", error);
    }
  });

  it("successfully migrates Firestore data with exact address duplicates", async () => {
    // Store expected dates as variables to avoid timing issues
    const firstReportDate = isoDaysAgo(10);
    const secondReportDate = isoDaysAgo(8); // More recent - should be kept
    const thirdReportDate = isoDaysAgo(12);

    // Seed Firestore with duplicate addresses
    const collection = firestoreDb.collection("old-pins");

    await collection.add({
      addedAt: firstReportDate,
      additionalInfo: "First report",
      address: "123 Main Street",
      lat: 40.7128,
      lng: -74.006,
    });

    await collection.add({
      addedAt: secondReportDate, // More recent
      additionalInfo: "Second report - should be kept",
      address: "123 Main Street", // Exact duplicate
      lat: 40.7129, // Slightly different coords
      lng: -74.0061,
    });

    await collection.add({
      addedAt: thirdReportDate,
      additionalInfo: "Different location",
      address: "456 Oak Avenue",
      lat: 40.7589,
      lng: -73.9851,
    });

    // Act
    await migrateFirestore(firestoreDb);

    // Assert - Check the migrated data
    const migratedSnapshot = await collection.get();
    expect(migratedSnapshot.docs).toHaveLength(2); // Should have 2 unique addresses

    const migratedData: { [key: string]: any } = {};
    migratedSnapshot.docs.forEach((doc) => {
      migratedData[doc.id] = doc.data();
    });

    // Verify the consolidated Main Street address
    expect(migratedData["123_main_street"]).toBeDefined();
    expect(migratedData["123_main_street"].address).toBe("123 Main Street");
    expect(migratedData["123_main_street"].reported).toBe(2); // Two reports consolidated
    expect(migratedData["123_main_street"].addedAt).toBe(secondReportDate); // Most recent date kept
    expect(migratedData["123_main_street"].additionalInfo).toBe(
      "Second report - should be kept"
    );
    expect(migratedData["123_main_street"].lat).toBe(40.7129); // Most recent coords
    expect(migratedData["123_main_street"].lng).toBe(-74.0061);

    // Verify the Oak Avenue address (no duplicates)
    expect(migratedData["456_oak_avenue"]).toBeDefined();
    expect(migratedData["456_oak_avenue"].address).toBe("456 Oak Avenue");
    expect(migratedData["456_oak_avenue"].reported).toBe(1); // Single report
    expect(migratedData["456_oak_avenue"].addedAt).toBe(thirdReportDate);
    expect(migratedData["456_oak_avenue"].additionalInfo).toBe(
      "Different location"
    );
  });

  it("handles addresses with special characters and formatting", async () => {
    const collection = firestoreDb.collection("old-pins");

    // Add addresses with various formatting that should be normalized
    await collection.add({
      addedAt: isoToday(),
      additionalInfo: "Special chars",
      address: "Main St & Oak Ave", // Special characters
      lat: 40.7128,
      lng: -74.006,
    });

    await collection.add({
      addedAt: isoDaysAgo(1),
      additionalInfo: "Extra spaces",
      address: "  123  Main  Street  ", // Extra spaces
      lat: 40.7589,
      lng: -73.9851,
    });

    await collection.add({
      addedAt: isoDaysAgo(2),
      additionalInfo: "Hyphens",
      address: "Pine-Road-North", // Hyphens
      lat: 40.7831,
      lng: -73.9712,
    });

    // Act
    await migrateFirestore(firestoreDb);

    // Assert - Check that addresses were properly normalized
    const migratedSnapshot = await collection.get();
    expect(migratedSnapshot.docs).toHaveLength(3);

    const migratedData: { [key: string]: any } = {};
    migratedSnapshot.docs.forEach((doc) => {
      migratedData[doc.id] = doc.data();
    });

    // Verify normalized keys exist
    expect(migratedData["main_st_oak_ave"]).toBeDefined();
    expect(migratedData["main_st_oak_ave"].address).toBe("Main St & Oak Ave");
    expect(migratedData["main_st_oak_ave"].reported).toBe(1);

    expect(migratedData["123_main_street"]).toBeDefined();
    expect(migratedData["123_main_street"].address).toBe(
      "  123  Main  Street  "
    );
    expect(migratedData["123_main_street"].reported).toBe(1);

    expect(migratedData["pine_road_north"]).toBeDefined();
    expect(migratedData["pine_road_north"].address).toBe("Pine-Road-North");
    expect(migratedData["pine_road_north"].reported).toBe(1);
  });

  it("consolidates multiple reports for the same normalized address", async () => {
    // Store expected dates as variables to avoid timing issues
    const firstVariationDate = isoDaysAgo(5);
    const mostRecentDate = isoDaysAgo(3); // Most recent - should be kept
    const middleVariationDate = isoDaysAgo(4);
    const differentStreetDate = isoDaysAgo(6);

    const collection = firestoreDb.collection("old-pins");

    // Add multiple variations of the same address that should consolidate
    await collection.add({
      addedAt: firstVariationDate,
      additionalInfo: "First variation",
      address: "123 Main Street",
      lat: 40.7128,
      lng: -74.006,
    });

    await collection.add({
      addedAt: mostRecentDate, // Most recent
      additionalInfo: "Most recent - should be kept",
      address: "123 Main Street",
      lat: 40.713,
      lng: -74.0062,
    });

    await collection.add({
      addedAt: middleVariationDate,
      additionalInfo: "Middle variation",
      address: "123 Main Street",
      lat: 40.7129,
      lng: -74.0061,
    });

    await collection.add({
      addedAt: differentStreetDate,
      additionalInfo: "Different street",
      address: "789 Pine Avenue",
      lat: 40.8,
      lng: -74.1,
    });

    // Act
    await migrateFirestore(firestoreDb);

    // Assert
    const migratedSnapshot = await collection.get();
    expect(migratedSnapshot.docs).toHaveLength(2); // Should have 2 unique addresses

    const migratedData: { [key: string]: any } = {};
    migratedSnapshot.docs.forEach((doc) => {
      migratedData[doc.id] = doc.data();
    });

    // Verify Main Street consolidation
    expect(migratedData["123_main_street"]).toBeDefined();
    expect(migratedData["123_main_street"].address).toBe("123 Main Street");
    expect(migratedData["123_main_street"].reported).toBe(3); // Three reports consolidated
    expect(migratedData["123_main_street"].addedAt).toBe(mostRecentDate); // Most recent kept
    expect(migratedData["123_main_street"].additionalInfo).toBe(
      "Most recent - should be kept"
    );
    expect(migratedData["123_main_street"].lat).toBe(40.713); // Most recent coords
    expect(migratedData["123_main_street"].lng).toBe(-74.0062);

    // Verify Pine Avenue (no duplicates)
    expect(migratedData["789_pine_avenue"]).toBeDefined();
    expect(migratedData["789_pine_avenue"].address).toBe("789 Pine Avenue");
    expect(migratedData["789_pine_avenue"].reported).toBe(1);
    expect(migratedData["789_pine_avenue"].addedAt).toBe(differentStreetDate);
    expect(migratedData["789_pine_avenue"].additionalInfo).toBe(
      "Different street"
    );
  });

  it("handles empty collection gracefully", async () => {
    // No data in collection - should not throw errors

    // Act
    await migrateFirestore(firestoreDb);

    // Assert - Should complete without errors
    const collection = firestoreDb.collection("old-pins");
    const snapshot = await collection.get();
    expect(snapshot.empty).toBe(true);
  });

  it("skips documents with missing or invalid addresses", async () => {
    const collection = firestoreDb.collection("old-pins");

    // Add valid document
    await collection.add({
      addedAt: isoToday(),
      additionalInfo: "Valid document",
      address: "123 Valid Street",
      lat: 40.7128,
      lng: -74.006,
    });

    // Add document with missing address
    await collection.add({
      addedAt: isoDaysAgo(1),
      additionalInfo: "Missing address",
      lat: 40.7589,
      lng: -73.9851,
      // address field missing
    });

    // Add document with empty address
    await collection.add({
      addedAt: isoDaysAgo(2),
      additionalInfo: "Empty address",
      address: "",
      lat: 40.7831,
      lng: -73.9712,
    });

    // Add document with null address
    await collection.add({
      addedAt: isoDaysAgo(3),
      additionalInfo: "Null address",
      address: null,
      lat: 40.79,
      lng: -73.98,
    });

    // Act
    await migrateFirestore(firestoreDb);

    // Assert - Only valid address should remain
    const migratedSnapshot = await collection.get();
    expect(migratedSnapshot.docs).toHaveLength(1);

    const validDoc = migratedSnapshot.docs[0];
    expect(validDoc.id).toBe("123_valid_street");
    expect(validDoc.data().address).toBe("123 Valid Street");
    expect(validDoc.data().reported).toBe(1);
  });

  it("preserves all required fields during migration", async () => {
    const collection = firestoreDb.collection("old-pins");

    await collection.add({
      addedAt: "2025-09-15T14:30:00.000Z",
      additionalInfo: "Detailed info about ice conditions",
      address: "999 Test Boulevard",
      lat: 40.75,
      lng: -74.05,
    });

    // Act
    await migrateFirestore(firestoreDb);

    // Assert - All fields should be preserved
    const migratedSnapshot = await collection.get();
    expect(migratedSnapshot.docs).toHaveLength(1);

    const migratedDoc = migratedSnapshot.docs[0];
    const data = migratedDoc.data();

    expect(migratedDoc.id).toBe("999_test_boulevard");
    expect(data.addedAt).toBe("2025-09-15T14:30:00.000Z");
    expect(data.additionalInfo).toBe("Detailed info about ice conditions");
    expect(data.address).toBe("999 Test Boulevard");
    expect(data.lat).toBe(40.75);
    expect(data.lng).toBe(-74.05);
    expect(data.reported).toBe(1);
  });

  it("handles large datasets efficiently", async () => {
    const collection = firestoreDb.collection("old-pins");

    // Add a larger number of documents to test batching
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(
        collection.add({
          addedAt: isoDaysAgo(i % 30), // Vary dates
          additionalInfo: `Report number ${i}`,
          address: `${i} Test Street`, // Each address is unique
          lat: 40.7 + i * 0.001,
          lng: -74.0 + i * 0.001,
        })
      );
    }

    // Add some duplicates
    for (let i = 0; i < 10; i++) {
      promises.push(
        collection.add({
          addedAt: isoDaysAgo(i),
          additionalInfo: `Duplicate report ${i}`,
          address: "Duplicate Street", // Same address
          lat: 40.8,
          lng: -74.1,
        })
      );
    }

    await Promise.all(promises);

    // Act
    const startTime = Date.now();
    await migrateFirestore(firestoreDb);
    const endTime = Date.now();

    // Assert
    const migratedSnapshot = await collection.get();

    // Should have 50 unique addresses + 1 consolidated duplicate = 51 total
    expect(migratedSnapshot.docs).toHaveLength(51);

    // Verify the duplicate consolidation
    const duplicateDoc = migratedSnapshot.docs.find(
      (doc) => doc.id === "duplicate_street"
    );
    expect(duplicateDoc).toBeDefined();
    expect(duplicateDoc!.data().reported).toBe(10); // 10 duplicates consolidated

    // Performance check - should complete in reasonable time (adjust as needed)
    const executionTime = endTime - startTime;
    expect(executionTime).toBeLessThan(30000); // Should complete within 30 seconds
  });

  it("handles edge cases with date comparison", async () => {
    const collection = firestoreDb.collection("old-pins");

    const baseDate = new Date("2025-09-15T12:00:00.000Z");

    // Add documents with very close timestamps
    await collection.add({
      addedAt: baseDate.toISOString(),
      additionalInfo: "First report",
      address: "Time Test Street",
      lat: 40.7,
      lng: -74.0,
    });

    // Add document 1 millisecond later
    const laterDate = new Date(baseDate.getTime() + 1);
    await collection.add({
      addedAt: laterDate.toISOString(),
      additionalInfo: "Later report - should be kept",
      address: "Time Test Street",
      lat: 40.7001,
      lng: -74.0001,
    });

    // Add document 1 millisecond earlier
    const earlierDate = new Date(baseDate.getTime() - 1);
    await collection.add({
      addedAt: earlierDate.toISOString(),
      additionalInfo: "Earlier report",
      address: "Time Test Street",
      lat: 40.6999,
      lng: -73.9999,
    });

    // Act
    await migrateFirestore(firestoreDb);

    // Assert
    const migratedSnapshot = await collection.get();
    expect(migratedSnapshot.docs).toHaveLength(1);

    const migratedDoc = migratedSnapshot.docs[0];
    const data = migratedDoc.data();

    expect(data.addedAt).toBe(laterDate.toISOString()); // Most recent should be kept
    expect(data.additionalInfo).toBe("Later report - should be kept");
    expect(data.reported).toBe(3); // All three reports consolidated
    expect(data.lat).toBe(40.7001); // Coordinates from most recent
    expect(data.lng).toBe(-74.0001);
  });

  it("handles missing additionalInfo field gracefully", async () => {
    const collection = firestoreDb.collection("old-pins");

    // Add document without additionalInfo
    await collection.add({
      addedAt: isoToday(),
      address: "No Info Street",
      lat: 40.7,
      lng: -74.0,
      // additionalInfo missing
    });

    // Add document with null additionalInfo
    await collection.add({
      addedAt: isoDaysAgo(1),
      additionalInfo: null,
      address: "Null Info Avenue",
      lat: 40.71,
      lng: -74.01,
    });

    // Add document with empty additionalInfo
    await collection.add({
      addedAt: isoDaysAgo(2),
      additionalInfo: "",
      address: "Empty Info Boulevard",
      lat: 40.72,
      lng: -74.02,
    });

    // Act
    await migrateFirestore(firestoreDb);

    // Assert
    const migratedSnapshot = await collection.get();
    expect(migratedSnapshot.docs).toHaveLength(3);

    migratedSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      expect(data.additionalInfo).toBe(""); // Should default to empty string
      expect(data.reported).toBe(1);
    });
  });
});
