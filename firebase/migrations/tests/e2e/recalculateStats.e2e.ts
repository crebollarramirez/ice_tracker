// E2E tests for recalculateStats function
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_DATABASE_EMULATOR_HOST = "localhost:9000";

import * as admin from "firebase-admin";
import { recalculateStats } from "../../migrations";

// Configure Firebase Admin for testing with emulators
const TEST_PROJECT_ID = "test-recalculate-stats";

// Initialize Firebase Admin SDK for E2E testing
let app: admin.app.App;
let realtimeDb: admin.database.Database;
let firestoreDb: admin.firestore.Firestore;

async function clearEmulators() {
  await realtimeDb.ref("locations").set(null);
  await realtimeDb.ref("stats").set(null);
  await firestoreDb.recursiveDelete(firestoreDb.collection("old-pins"));
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function isoToday(): string {
  return new Date().toISOString();
}

describe("recalculateStats E2E", () => {
  beforeAll(async () => {
    // Initialize Firebase Admin SDK for E2E testing
    app = admin.initializeApp(
      {
        projectId: TEST_PROJECT_ID,
        databaseURL: `http://localhost:9000?ns=${TEST_PROJECT_ID}`,
      },
      `test-${Date.now()}`
    );

    realtimeDb = app.database();
    firestoreDb = app.firestore();
  });

  beforeEach(async () => {
    await clearEmulators();
  });

  afterAll(async () => {
    try {
      await app.delete();
    } catch (error) {
      console.error("Error deleting app:", error);
    }
  });

  it("calculates stats correctly with mixed data across RTDB and Firestore", async () => {
    // Seed RTDB with live pins: reported counts of 2, 3, 1 respectively
    await realtimeDb.ref("locations").set({
      today1: {
        addedAt: isoToday(),
        address: "Today St, Nowcity",
        additionalInfo: "",
        lat: 1,
        lng: 1,
        reported: 2, // 2 reports for today
      },
      week1: {
        addedAt: isoDaysAgo(3),
        address: "Week Rd, Recenttown",
        additionalInfo: "",
        lat: 2,
        lng: 2,
        reported: 3, // 3 reports this week
      },
      week2: {
        addedAt: isoDaysAgo(6),
        address: "Almost Week Ave, Sixdaysville",
        additionalInfo: "",
        lat: 3,
        lng: 3,
        reported: 1, // 1 report this week
      },
    });

    // Seed Firestore with old pins (>7 days) with reported counts
    await firestoreDb.collection("old-pins").add({
      addedAt: isoDaysAgo(10),
      address: "Old Pin Blvd, Pastville",
      additionalInfo: "",
      lat: 4,
      lng: 4,
      reported: 4, // 4 old reports
    });
    await firestoreDb.collection("old-pins").add({
      addedAt: isoDaysAgo(15),
      address: "Ancient Way, Historytown",
      additionalInfo: "",
      lat: 5,
      lng: 5,
      reported: 2, // 2 old reports
    });

    // Act
    const result = await recalculateStats(realtimeDb, firestoreDb);

    // Assert
    expect(result.message).toBe("Stats recalculated successfully");

    const statsSnap = await realtimeDb.ref("stats").once("value");
    const stats = statsSnap.val();
    expect(stats).toBeTruthy();
    expect(stats.total_pins).toBe(12); // 2+3+1 live + 4+2 old = 12
    expect(stats.today_pins).toBe(2); // 2 reported today
    expect(stats.week_pins).toBe(6); // 2+3+1 reported within last 7 days
  });

  it("handles empty databases and returns zeros", async () => {
    // No data in either database
    await realtimeDb.ref("locations").set(null);
    // Firestore collection is empty by default

    // Act
    const result = await recalculateStats(realtimeDb, firestoreDb);

    // Assert
    expect(result.message).toBe("Stats recalculated successfully");

    const statsSnap = await realtimeDb.ref("stats").once("value");
    const stats = statsSnap.val();
    expect(stats).toEqual({
      total_pins: 0,
      today_pins: 0,
      week_pins: 0,
    });
  });

  it("handles only old pins in Firestore with empty RTDB", async () => {
    // Empty RTDB
    await realtimeDb.ref("locations").set(null);

    // Only old pins in Firestore with reported counts
    await firestoreDb.collection("old-pins").add({
      addedAt: isoDaysAgo(10),
      address: "Only Old Pin St",
      additionalInfo: "",
      lat: 1,
      lng: 1,
      reported: 3, // 3 reports
    });
    await firestoreDb.collection("old-pins").add({
      addedAt: isoDaysAgo(20),
      address: "Very Old Pin Ave",
      additionalInfo: "",
      lat: 2,
      lng: 2,
      reported: 5, // 5 reports
    });

    // Act
    const result = await recalculateStats(realtimeDb, firestoreDb);

    // Assert
    expect(result.message).toBe("Stats recalculated successfully");

    const statsSnap = await realtimeDb.ref("stats").once("value");
    const stats = statsSnap.val();
    expect(stats).toEqual({
      total_pins: 8, // 3+5 old reports
      today_pins: 0, // none today
      week_pins: 0, // none this week
    });
  });

  it("handles only live pins in RTDB with empty Firestore", async () => {
    // Seed RTDB only with reported counts
    await realtimeDb.ref("locations").set({
      today1: {
        addedAt: isoToday(),
        address: "Today Only St",
        additionalInfo: "",
        lat: 1,
        lng: 1,
        reported: 4, // 4 reports today
      },
      week1: {
        addedAt: isoDaysAgo(2),
        address: "This Week Rd",
        additionalInfo: "",
        lat: 2,
        lng: 2,
        reported: 2, // 2 reports this week
      },
    });

    // Firestore is empty

    // Act
    const result = await recalculateStats(realtimeDb, firestoreDb);

    // Assert
    expect(result.message).toBe("Stats recalculated successfully");

    const statsSnap = await realtimeDb.ref("stats").once("value");
    const stats = statsSnap.val();
    expect(stats).toEqual({
      total_pins: 6, // 4+2 live reports
      today_pins: 4, // 4 today
      week_pins: 6, // both within week (4+2)
    });
  });

  it("handles missing reported field by defaulting to 1", async () => {
    // Seed RTDB with pins missing reported field
    await realtimeDb.ref("locations").set({
      today1: {
        addedAt: isoToday(),
        address: "Today No Reported St",
        additionalInfo: "",
        lat: 1,
        lng: 1,
        // missing reported field - should default to 1
      },
      week1: {
        addedAt: isoDaysAgo(2),
        address: "This Week No Reported Rd",
        additionalInfo: "",
        lat: 2,
        lng: 2,
        // missing reported field - should default to 1
      },
    });

    // Seed Firestore with pins missing reported field
    await firestoreDb.collection("old-pins").add({
      addedAt: isoDaysAgo(10),
      address: "Old Pin No Reported Ave",
      additionalInfo: "",
      lat: 3,
      lng: 3,
      // missing reported field - should default to 1
    });

    // Act
    const result = await recalculateStats(realtimeDb, firestoreDb);

    // Assert
    expect(result.message).toBe("Stats recalculated successfully");

    const statsSnap = await realtimeDb.ref("stats").once("value");
    const stats = statsSnap.val();
    expect(stats).toEqual({
      total_pins: 3, // 1+1+1 (all default to 1)
      today_pins: 1, // 1 today
      week_pins: 2, // both live pins within week (1+1)
    });
  });

  it("correctly handles edge case dates (exactly 7 days ago)", async () => {
    // Pin exactly 7 days ago - let's test the actual behavior
    const now = new Date();
    const exactly7DaysAgo = new Date();
    exactly7DaysAgo.setDate(now.getDate() - 7);
    exactly7DaysAgo.setHours(0, 0, 0, 0); // Start of day 7 days ago

    const over7DaysAgo = new Date();
    over7DaysAgo.setDate(now.getDate() - 8);

    const within7Days = new Date();
    within7Days.setDate(now.getDate() - 6); // Clearly within 7 days

    await realtimeDb.ref("locations").set({
      edge1: {
        addedAt: exactly7DaysAgo.toISOString(),
        address: "Exactly 7 Days Ago St",
        additionalInfo: "",
        lat: 1,
        lng: 1,
        reported: 3, // 3 reports exactly 7 days ago
      },
      edge2: {
        addedAt: over7DaysAgo.toISOString(), // Over 7 days, should not count in week
        address: "Over 7 Days Ago Ave",
        additionalInfo: "",
        lat: 2,
        lng: 2,
        reported: 2, // 2 reports over 7 days ago
      },
      edge3: {
        addedAt: within7Days.toISOString(), // Clearly within 7 days
        address: "Within 7 Days Ave",
        additionalInfo: "",
        lat: 3,
        lng: 3,
        reported: 4, // 4 reports within 7 days
      },
    });

    // Act
    const result = await recalculateStats(realtimeDb, firestoreDb);

    // Assert
    expect(result.message).toBe("Stats recalculated successfully");

    const statsSnap = await realtimeDb.ref("stats").once("value");
    const stats = statsSnap.val();
    expect(stats.total_pins).toBe(9); // 3+2+4 = 9 total reports
    expect(stats.today_pins).toBe(0); // No reports today
    // The 7-days-ago pin might or might not be included depending on exact timing
    // but the 6-days-ago pin should definitely be included
    expect(stats.week_pins).toBeGreaterThanOrEqual(4); // At least the 6-day-old pin (4 reports)
    expect(stats.week_pins).toBeLessThanOrEqual(7); // At most the 6-day-old + 7-day-old pins (4+3)
  });

  it("overwrites existing stats correctly", async () => {
    // Seed with existing (incorrect) stats
    await realtimeDb.ref("stats").set({
      total_pins: 100,
      today_pins: 50,
      week_pins: 75,
    });

    // Seed with actual data
    await realtimeDb.ref("locations").set({
      pin1: {
        addedAt: isoToday(),
        address: "Correct Pin St",
        additionalInfo: "",
        lat: 1,
        lng: 1,
        reported: 3, // 3 reports today
      },
    });

    await firestoreDb.collection("old-pins").add({
      addedAt: isoDaysAgo(10),
      address: "Correct Old Pin Ave",
      additionalInfo: "",
      lat: 2,
      lng: 2,
      reported: 7, // 7 old reports
    });

    // Act
    const result = await recalculateStats(realtimeDb, firestoreDb);

    // Assert
    expect(result.message).toBe("Stats recalculated successfully");

    const statsSnap = await realtimeDb.ref("stats").once("value");
    const stats = statsSnap.val();
    expect(stats).toEqual({
      total_pins: 10, // 3 live + 7 old = 10 (not 100)
      today_pins: 3, // 3 today (not 50)
      week_pins: 3, // 3 this week (not 75)
    });
  });

  it("throws error when RTDB access fails", async () => {
    // Mock the database ref to throw an error
    const originalRef = realtimeDb.ref;
    jest.spyOn(realtimeDb, "ref").mockImplementation((path: any) => {
      if (path === "locations") {
        const mockRef = {
          once: jest
            .fn()
            .mockRejectedValue(new Error("RTDB connection failed")),
        };
        return mockRef as any;
      }
      return originalRef.call(realtimeDb, path);
    });

    try {
      await expect(recalculateStats(realtimeDb, firestoreDb)).rejects.toThrow(
        "Error recalculating stats"
      );
    } finally {
      jest.restoreAllMocks();
    }
  });

  it("throws error when Firestore access fails", async () => {
    // Seed RTDB with valid data
    await realtimeDb.ref("locations").set({
      pin1: {
        addedAt: isoToday(),
        address: "Test Pin St",
        additionalInfo: "",
        lat: 1,
        lng: 1,
        reported: 1,
      },
    });

    // Mock Firestore collection to throw an error
    const originalCollection = firestoreDb.collection;
    jest.spyOn(firestoreDb, "collection").mockImplementation((path: any) => {
      if (path === "old-pins") {
        return {
          get: jest
            .fn()
            .mockRejectedValue(new Error("Firestore connection failed")),
        } as any;
      }
      return originalCollection.call(firestoreDb, path);
    });

    try {
      await expect(recalculateStats(realtimeDb, firestoreDb)).rejects.toThrow(
        "Error recalculating stats"
      );
    } finally {
      jest.restoreAllMocks();
    }
  });

  it("throws error when stats update fails", async () => {
    // Seed with valid data
    await realtimeDb.ref("locations").set({
      pin1: {
        addedAt: isoToday(),
        address: "Test Pin St",
        additionalInfo: "",
        lat: 1,
        lng: 1,
        reported: 1,
      },
    });

    // Mock the stats ref set to fail
    const originalRef = realtimeDb.ref;
    jest.spyOn(realtimeDb, "ref").mockImplementation((path: any) => {
      if (path === "stats") {
        return {
          set: jest.fn().mockRejectedValue(new Error("Stats update failed")),
        } as any;
      }
      return originalRef.call(realtimeDb, path);
    });

    try {
      await expect(recalculateStats(realtimeDb, firestoreDb)).rejects.toThrow(
        "Error recalculating stats"
      );
    } finally {
      jest.restoreAllMocks();
    }
  });
});
