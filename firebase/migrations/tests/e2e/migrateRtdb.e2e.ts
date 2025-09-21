import * as admin from "firebase-admin";
import { migrateRealtimeDatabase } from "../../migrations";

// Configure Firebase Admin for testing with emulators
const TEST_PROJECT_ID = "test-migration-project";
const RTDB_EMULATOR_HOST = "localhost:9000";

// Set environment variables for emulator
process.env.FIREBASE_DATABASE_EMULATOR_HOST = RTDB_EMULATOR_HOST;

// Initialize Firebase Admin SDK for E2E testing
let app: admin.app.App;
let realtimeDb: admin.database.Database;

beforeAll(async () => {
  // Initialize Firebase Admin with emulator settings
  app = admin.initializeApp(
    {
      projectId: TEST_PROJECT_ID,
      databaseURL: `http://${RTDB_EMULATOR_HOST}?ns=${TEST_PROJECT_ID}`,
    },
    "e2e-test"
  );

  realtimeDb = admin.database(app);
});

afterAll(async () => {
  // Clean up
  if (app) {
    await app.delete();
  }
});

describe("migrateRealtimeDatabase E2E Tests", () => {
  beforeEach(async () => {
    // Clear the emulator database before each test
    await realtimeDb.ref().set(null);
  });

  it("should successfully migrate RTDB data with exact duplicates and consolidate them", async () => {
    // Seed the database with test data containing exact duplicates
    const testData = {
      "original-key-1": {
        addedAt: "2025-09-16T10:00:00.000Z",
        additionalInfo: "Ice on sidewalk",
        address: "123 Main Street",
        lat: 40.7128,
        lng: -74.006,
      },
      "original-key-2": {
        addedAt: "2025-09-16T11:00:00.000Z",
        additionalInfo: "Slippery area",
        address: "123 Main Street", // Exact duplicate
        lat: 40.7128,
        lng: -74.006,
      },
      "original-key-3": {
        addedAt: "2025-09-16T12:00:00.000Z",
        additionalInfo: "Icy patch",
        address: "456 Oak Avenue",
        lat: 40.7589,
        lng: -73.9851,
      },
      "original-key-4": {
        addedAt: "2025-09-16T13:00:00.000Z",
        additionalInfo: "Frozen puddle",
        address: "456 Oak Avenue", // Exact duplicate
        lat: 40.7589,
        lng: -73.9851,
      },
    };

    await realtimeDb.ref("locations").set(testData);

    // Execute the migration
    await migrateRealtimeDatabase(realtimeDb);

    // Verify the results
    const migratedSnapshot = await realtimeDb.ref("locations").once("value");
    const migratedData = migratedSnapshot.val();

    // Should have 2 unique addresses after consolidation
    expect(Object.keys(migratedData)).toHaveLength(2);

    // Verify the first consolidated address (123 Main Street)
    expect(migratedData["123_main_street"]).toBeDefined();
    expect(migratedData["123_main_street"].address).toBe("123 Main Street");
    expect(migratedData["123_main_street"].reported).toBe(2);
    expect(migratedData["123_main_street"].lat).toBe(40.7128);
    expect(migratedData["123_main_street"].lng).toBe(-74.006);
    // Should keep the most recent data (key-2 has later timestamp)
    expect(migratedData["123_main_street"].addedAt).toBe(
      "2025-09-16T11:00:00.000Z"
    );
    expect(migratedData["123_main_street"].additionalInfo).toBe(
      "Slippery area"
    );

    // Verify the second consolidated address (456 Oak Avenue)
    expect(migratedData["456_oak_avenue"]).toBeDefined();
    expect(migratedData["456_oak_avenue"].address).toBe("456 Oak Avenue");
    expect(migratedData["456_oak_avenue"].reported).toBe(2);
    expect(migratedData["456_oak_avenue"].lat).toBe(40.7589);
    expect(migratedData["456_oak_avenue"].lng).toBe(-73.9851);
    // Should keep the most recent data (key-4 has later timestamp)
    expect(migratedData["456_oak_avenue"].addedAt).toBe(
      "2025-09-16T13:00:00.000Z"
    );
    expect(migratedData["456_oak_avenue"].additionalInfo).toBe("Frozen puddle");

    // Verify old keys are gone
    expect(migratedData["original-key-1"]).toBeUndefined();
    expect(migratedData["original-key-2"]).toBeUndefined();
    expect(migratedData["original-key-3"]).toBeUndefined();
    expect(migratedData["original-key-4"]).toBeUndefined();
  });

  it("should handle empty database gracefully", async () => {
    // Execute migration on empty database
    await migrateRealtimeDatabase(realtimeDb);

    // Verify no data was created
    const snapshot = await realtimeDb.ref("locations").once("value");
    expect(snapshot.exists()).toBe(false);
  });

  it("should create proper address keys from various address formats", async () => {
    // Test data with various address formats that should be normalized
    const testData = {
      "key-1": {
        addedAt: "2025-09-16T10:00:00.000Z",
        additionalInfo: "Test location 1",
        address: "Main St & Oak Ave", // Special characters
        lat: 40.7128,
        lng: -74.006,
      },
      "key-2": {
        addedAt: "2025-09-16T11:00:00.000Z",
        additionalInfo: "Test location 2",
        address: "  123  Main  Street  ", // Extra spaces
        lat: 40.7589,
        lng: -73.9851,
      },
      "key-3": {
        addedAt: "2025-09-16T12:00:00.000Z",
        additionalInfo: "Test location 3",
        address: "Pine-Road-North", // Hyphens
        lat: 40.7831,
        lng: -73.9712,
      },
      "key-4": {
        addedAt: "2025-09-16T13:00:00.000Z",
        additionalInfo: "Test location 4",
        address: "First Avenue (North)", // Parentheses
        lat: 40.7505,
        lng: -73.9934,
      },
    };

    await realtimeDb.ref("locations").set(testData);

    // Execute the migration
    await migrateRealtimeDatabase(realtimeDb);

    // Verify the results
    const migratedSnapshot = await realtimeDb.ref("locations").once("value");
    const migratedData = migratedSnapshot.val();

    // Should have 4 unique addresses
    expect(Object.keys(migratedData)).toHaveLength(4);

    // Verify the keys were properly formatted
    const expectedKeys = [
      "main_st_oak_ave", // Special chars removed, spaces to underscores
      "123_main_street", // Extra spaces normalized
      "pine_road_north", // Hyphens converted to underscores
      "first_avenue_north", // Parentheses removed
    ];

    expectedKeys.forEach((key) => {
      expect(migratedData[key]).toBeDefined();
      expect(migratedData[key].reported).toBe(1);
    });
  });

  it("should consolidate addresses with different formatting but same semantic meaning", async () => {
    // Test data with addresses that should be considered the same after normalization
    const testData = {
      "key-1": {
        addedAt: "2025-09-16T10:00:00.000Z",
        additionalInfo: "First report",
        address: "123 Main Street",
        lat: 40.7128,
        lng: -74.006,
      },
      "key-2": {
        addedAt: "2025-09-16T11:00:00.000Z",
        additionalInfo: "Second report",
        address: "123 Main Street", // Same after normalization
        lat: 40.7128,
        lng: -74.006,
      },
      "key-3": {
        addedAt: "2025-09-16T12:00:00.000Z",
        additionalInfo: "Third report",
        address: "123 Main Street", // Same after normalization
        lat: 40.7128,
        lng: -74.006,
      },
      "key-4": {
        addedAt: "2025-09-16T13:00:00.000Z",
        additionalInfo: "Different location",
        address: "456 Oak Avenue",
        lat: 40.7589,
        lng: -73.9851,
      },
    };

    await realtimeDb.ref("locations").set(testData);

    // Execute the migration
    await migrateRealtimeDatabase(realtimeDb);

    // Verify the results
    const migratedSnapshot = await realtimeDb.ref("locations").once("value");
    const migratedData = migratedSnapshot.val();

    // Should have only 2 unique addresses after consolidation
    expect(Object.keys(migratedData)).toHaveLength(2);

    // Verify the first consolidated address (123 Main Street variations)
    expect(migratedData["123_main_street"]).toBeDefined();
    expect(migratedData["123_main_street"].address).toBe("123 Main Street");
    expect(migratedData["123_main_street"].reported).toBe(3); // Three reports consolidated
    expect(migratedData["123_main_street"].lat).toBe(40.7128);
    expect(migratedData["123_main_street"].lng).toBe(-74.006);
    // Should keep the most recent data (key-3 has the latest timestamp)
    expect(migratedData["123_main_street"].addedAt).toBe(
      "2025-09-16T12:00:00.000Z"
    );
    expect(migratedData["123_main_street"].additionalInfo).toBe("Third report");

    // Verify the second address (456 Oak Avenue)
    expect(migratedData["456_oak_avenue"]).toBeDefined();
    expect(migratedData["456_oak_avenue"].address).toBe("456 Oak Avenue");
    expect(migratedData["456_oak_avenue"].reported).toBe(1);
    expect(migratedData["456_oak_avenue"].lat).toBe(40.7589);
    expect(migratedData["456_oak_avenue"].lng).toBe(-73.9851);
  });

  it("should keep the most recent data when consolidating duplicates", async () => {
    // Test data with duplicates where the most recent should be preserved
    const testData = {
      "key-1": {
        addedAt: "2025-09-16T08:00:00.000Z", // Oldest
        additionalInfo: "First report - should be overwritten",
        address: "789 Pine Street",
        lat: 40.7,
        lng: -74.0,
      },
      "key-2": {
        addedAt: "2025-09-16T15:30:00.000Z", // Most recent - should be kept
        additionalInfo: "Latest report - should be kept",
        address: "789 Pine Street",
        lat: 40.7001, // Slightly different coordinates
        lng: -74.0001,
      },
      "key-3": {
        addedAt: "2025-09-16T12:15:00.000Z", // Middle date
        additionalInfo: "Middle report - should be overwritten",
        address: "789 Pine Street",
        lat: 40.7002,
        lng: -74.0002,
      },
      "key-4": {
        addedAt: "2025-09-16T14:00:00.000Z", // Another duplicate, but older than key-2
        additionalInfo: "Another report - should be overwritten",
        address: "789 Pine Street",
        lat: 40.7003,
        lng: -74.0003,
      },
    };

    await realtimeDb.ref("locations").set(testData);

    // Execute the migration
    await migrateRealtimeDatabase(realtimeDb);

    // Verify the results
    const migratedSnapshot = await realtimeDb.ref("locations").once("value");
    const migratedData = migratedSnapshot.val();

    // Should have only 1 unique address after consolidation
    expect(Object.keys(migratedData)).toHaveLength(1);

    // Verify the consolidated address kept the most recent data
    expect(migratedData["789_pine_street"]).toBeDefined();
    expect(migratedData["789_pine_street"].address).toBe("789 Pine Street");
    expect(migratedData["789_pine_street"].reported).toBe(4); // Four reports consolidated
    expect(migratedData["789_pine_street"].addedAt).toBe(
      "2025-09-16T15:30:00.000Z"
    ); // Most recent date
    expect(migratedData["789_pine_street"].additionalInfo).toBe(
      "Latest report - should be kept"
    ); // Most recent info
    expect(migratedData["789_pine_street"].lat).toBe(40.7001); // Most recent coordinates
    expect(migratedData["789_pine_street"].lng).toBe(-74.0001);
  });

  it("should handle large datasets efficiently", async () => {
    // Create a large dataset with some duplicates
    const testData: { [key: string]: any } = {};
    const numRecords = 100;
    const numUniqueAddresses = 20; // This will create 5 duplicates per address

    for (let i = 0; i < numRecords; i++) {
      const addressIndex = i % numUniqueAddresses;
      testData[`key-${i}`] = {
        addedAt: new Date(2025, 8, 16, i % 24, (i * 15) % 60, 0).toISOString(),
        additionalInfo: `Report ${i}`,
        address: `${1000 + addressIndex} Test Street`,
        lat: 40.7128 + i * 0.001,
        lng: -74.006 + i * 0.001,
      };
    }

    await realtimeDb.ref("locations").set(testData);

    const startTime = Date.now();

    // Execute the migration
    await migrateRealtimeDatabase(realtimeDb);

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    // Verify performance (should complete within reasonable time)
    expect(executionTime).toBeLessThan(10000); // Less than 10 seconds

    // Verify the results
    const migratedSnapshot = await realtimeDb.ref("locations").once("value");
    const migratedData = migratedSnapshot.val();

    // Should have the correct number of unique addresses
    expect(Object.keys(migratedData)).toHaveLength(numUniqueAddresses);

    // Verify each consolidated address has the correct reported count
    Object.values(migratedData).forEach((data: any) => {
      expect(data.reported).toBe(5); // Each address should have 5 reports
      expect(data.address).toMatch(/^\d{4} Test Street$/); // Should match the pattern
    });
  });

  // this won't happen since we validate input, but just in case
  it("should handle records with missing or invalid addresses", async () => {
    // Test data with some invalid records
    const testData = {
      "valid-key-1": {
        addedAt: "2025-09-16T10:00:00.000Z",
        additionalInfo: "Valid record",
        address: "123 Main Street",
        lat: 40.7128,
        lng: -74.006,
      },
      "invalid-key-1": {
        addedAt: "2025-09-16T11:00:00.000Z",
        additionalInfo: "Invalid - no address",
        // address is missing
        lat: 40.7589,
        lng: -73.9851,
      },
      "invalid-key-2": {
        addedAt: "2025-09-16T12:00:00.000Z",
        additionalInfo: "Invalid - empty address",
        address: "", // Empty address
        lat: 40.7831,
        lng: -73.9712,
      },
      "invalid-key-3": {
        addedAt: "2025-09-16T13:00:00.000Z",
        additionalInfo: "Invalid - null address",
        address: null, // Null address
        lat: 40.7505,
        lng: -73.9934,
      },
      "valid-key-2": {
        addedAt: "2025-09-16T14:00:00.000Z",
        additionalInfo: "Another valid record",
        address: "456 Oak Avenue",
        lat: 40.7589,
        lng: -73.9851,
      },
    };

    await realtimeDb.ref("locations").set(testData);

    // Execute the migration
    await migrateRealtimeDatabase(realtimeDb);

    // Verify the results
    const migratedSnapshot = await realtimeDb.ref("locations").once("value");
    const migratedData = migratedSnapshot.val();

    // Should have only 2 valid addresses (invalid ones should be skipped)
    expect(Object.keys(migratedData)).toHaveLength(2);

    // Verify the valid records were processed
    expect(migratedData["123_main_street"]).toBeDefined();
    expect(migratedData["123_main_street"].address).toBe("123 Main Street");
    expect(migratedData["123_main_street"].reported).toBe(1);

    expect(migratedData["456_oak_avenue"]).toBeDefined();
    expect(migratedData["456_oak_avenue"].address).toBe("456 Oak Avenue");
    expect(migratedData["456_oak_avenue"].reported).toBe(1);

    // Verify invalid records were not included
    expect(migratedData["invalid-key-1"]).toBeUndefined();
    expect(migratedData["invalid-key-2"]).toBeUndefined();
    expect(migratedData["invalid-key-3"]).toBeUndefined();
  });

  it("should preserve all required fields in migrated data", async () => {
    // Test data to verify all fields are preserved
    const testData = {
      "test-key": {
        addedAt: "2025-09-16T10:30:45.123Z",
        additionalInfo: "Detailed ice report with special characters: #@$%",
        address: "987 Elm Drive",
        lat: 40.7128456,
        lng: -74.0059731,
      },
    };

    await realtimeDb.ref("locations").set(testData);

    // Execute the migration
    await migrateRealtimeDatabase(realtimeDb);

    // Verify the results
    const migratedSnapshot = await realtimeDb.ref("locations").once("value");
    const migratedData = migratedSnapshot.val();

    expect(Object.keys(migratedData)).toHaveLength(1);

    const migratedRecord = migratedData["987_elm_drive"];
    expect(migratedRecord).toBeDefined();

    // Verify all fields are preserved with correct values
    expect(migratedRecord.addedAt).toBe("2025-09-16T10:30:45.123Z");
    expect(migratedRecord.additionalInfo).toBe(
      "Detailed ice report with special characters: #@$%"
    );
    expect(migratedRecord.address).toBe("987 Elm Drive");
    expect(migratedRecord.lat).toBe(40.7128456);
    expect(migratedRecord.lng).toBe(-74.0059731);
    expect(migratedRecord.reported).toBe(1);

    // Verify the field types
    expect(typeof migratedRecord.addedAt).toBe("string");
    expect(typeof migratedRecord.additionalInfo).toBe("string");
    expect(typeof migratedRecord.address).toBe("string");
    expect(typeof migratedRecord.lat).toBe("number");
    expect(typeof migratedRecord.lng).toBe("number");
    expect(typeof migratedRecord.reported).toBe("number");
  });
});
