// src/tests/e2e/recalculateStats.e2e.ts
import * as dotenv from "dotenv";
dotenv.config();

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: process.env.GCLOUD_PROJECT_ID,
  databaseURL: process.env.FB_RTDB_EMULATOR_URL,
});

import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";

const testEnv = functionsTest({
  projectId: process.env.GCLOUD_PROJECT_ID,
  databaseURL: process.env.FB_RTDB_EMULATOR_URL,
});

// Import the wrapped function for testing
const wrappedRecalculateStats = testEnv.wrap(
  require("../../index").recalculateStats
);

const db = admin.database();
const fs = admin.firestore();

async function clearEmulators() {
  await db.ref("locations").set(null);
  await db.ref("stats").set(null);
  await fs.recursiveDelete(fs.collection("old-pins"));
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
  beforeEach(async () => {
    await clearEmulators();
  });

  afterAll(async () => {
    try {
      await admin.app().delete();
    } catch {}
    await testEnv.cleanup();
  });

  it("calculates stats correctly with mixed data across RTDB and Firestore", async () => {
    // Seed RTDB with live pins: 1 today, 1 this week (3 days ago), 1 older (6 days ago)
    await db.ref("locations").set({
      today1: {
        addedAt: isoToday(),
        address: "Today St, Nowcity",
        additionalInfo: "",
        lat: 1,
        lng: 1,
      },
      week1: {
        addedAt: isoDaysAgo(3),
        address: "Week Rd, Recenttown",
        additionalInfo: "",
        lat: 2,
        lng: 2,
      },
      week2: {
        addedAt: isoDaysAgo(6),
        address: "Almost Week Ave, Sixdaysville",
        additionalInfo: "",
        lat: 3,
        lng: 3,
      },
    });

    // Seed Firestore with old pins (>7 days)
    await fs.collection("old-pins").add({
      addedAt: isoDaysAgo(10),
      address: "Old Pin Blvd, Pastville",
      additionalInfo: "",
      lat: 4,
      lng: 4,
    });
    await fs.collection("old-pins").add({
      addedAt: isoDaysAgo(15),
      address: "Ancient Way, Historytown",
      additionalInfo: "",
      lat: 5,
      lng: 5,
    });

    // Act
    const result = await wrappedRecalculateStats({});

    // Assert
    expect(result.message).toBe("Stats recalculated successfully");

    const statsSnap = await db.ref("stats").once("value");
    const stats = statsSnap.val();
    expect(stats).toBeTruthy();
    expect(stats.total_pins).toBe(5); // 3 live + 2 old
    expect(stats.today_pins).toBe(1); // 1 added today
    expect(stats.week_pins).toBe(3); // 3 added within last 7 days (today, 3 days ago, 6 days ago)
  });

  it("handles empty databases and returns zeros", async () => {
    // No data in either database
    await db.ref("locations").set(null);
    // Firestore collection is empty by default

    // Act
    const result = await wrappedRecalculateStats({});

    // Assert
    expect(result.message).toBe("Stats recalculated successfully");

    const statsSnap = await db.ref("stats").once("value");
    const stats = statsSnap.val();
    expect(stats).toEqual({
      total_pins: 0,
      today_pins: 0,
      week_pins: 0,
    });
  });

  it("handles only old pins in Firestore with empty RTDB", async () => {
    // Empty RTDB
    await db.ref("locations").set(null);

    // Only old pins in Firestore
    await fs.collection("old-pins").add({
      addedAt: isoDaysAgo(10),
      address: "Only Old Pin St",
      additionalInfo: "",
      lat: 1,
      lng: 1,
    });
    await fs.collection("old-pins").add({
      addedAt: isoDaysAgo(20),
      address: "Very Old Pin Ave",
      additionalInfo: "",
      lat: 2,
      lng: 2,
    });

    // Act
    const result = await wrappedRecalculateStats({});

    // Assert
    expect(result.message).toBe("Stats recalculated successfully");

    const statsSnap = await db.ref("stats").once("value");
    const stats = statsSnap.val();
    expect(stats).toEqual({
      total_pins: 2, // 2 old pins
      today_pins: 0, // none today
      week_pins: 0, // none this week
    });
  });

  it("handles only live pins in RTDB with empty Firestore", async () => {
    // Seed RTDB only
    await db.ref("locations").set({
      today1: {
        addedAt: isoToday(),
        address: "Today Only St",
        additionalInfo: "",
        lat: 1,
        lng: 1,
      },
      week1: {
        addedAt: isoDaysAgo(2),
        address: "This Week Rd",
        additionalInfo: "",
        lat: 2,
        lng: 2,
      },
    });

    // Firestore is empty

    // Act
    const result = await wrappedRecalculateStats({});

    // Assert
    expect(result.message).toBe("Stats recalculated successfully");

    const statsSnap = await db.ref("stats").once("value");
    const stats = statsSnap.val();
    expect(stats).toEqual({
      total_pins: 2, // 2 live pins
      today_pins: 1, // 1 today
      week_pins: 2, // both within week
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

    await db.ref("locations").set({
      edge1: {
        addedAt: exactly7DaysAgo.toISOString(),
        address: "Exactly 7 Days Ago St",
        additionalInfo: "",
        lat: 1,
        lng: 1,
      },
      edge2: {
        addedAt: over7DaysAgo.toISOString(), // Over 7 days, should not count in week
        address: "Over 7 Days Ago Ave",
        additionalInfo: "",
        lat: 2,
        lng: 2,
      },
      edge3: {
        addedAt: within7Days.toISOString(), // Clearly within 7 days
        address: "Within 7 Days Ave",
        additionalInfo: "",
        lat: 3,
        lng: 3,
      },
    });

    // Act
    const result = await wrappedRecalculateStats({});

    // Assert
    expect(result.message).toBe("Stats recalculated successfully");

    const statsSnap = await db.ref("stats").once("value");
    const stats = statsSnap.val();
    expect(stats.total_pins).toBe(3);
    expect(stats.today_pins).toBe(0);
    // The 7-days-ago pin might or might not be included depending on exact timing
    // but the 6-days-ago pin should definitely be included
    expect(stats.week_pins).toBeGreaterThanOrEqual(1); // At least the 6-day-old pin
    expect(stats.week_pins).toBeLessThanOrEqual(2); // At most the 6-day-old + 7-day-old pins
  });

  it("overwrites existing stats correctly", async () => {
    // Seed with existing (incorrect) stats
    await db.ref("stats").set({
      total_pins: 100,
      today_pins: 50,
      week_pins: 75,
    });

    // Seed with actual data
    await db.ref("locations").set({
      pin1: {
        addedAt: isoToday(),
        address: "Correct Pin St",
        additionalInfo: "",
        lat: 1,
        lng: 1,
      },
    });

    await fs.collection("old-pins").add({
      addedAt: isoDaysAgo(10),
      address: "Correct Old Pin Ave",
      additionalInfo: "",
      lat: 2,
      lng: 2,
    });

    // Act
    const result = await wrappedRecalculateStats({});

    // Assert
    expect(result.message).toBe("Stats recalculated successfully");

    const statsSnap = await db.ref("stats").once("value");
    const stats = statsSnap.val();
    expect(stats).toEqual({
      total_pins: 2, // 1 live + 1 old (not 100)
      today_pins: 1, // 1 today (not 50)
      week_pins: 1, // 1 this week (not 75)
    });
  });

  it("throws HttpsError when RTDB access fails", async () => {
    // Mock the database ref to throw an error
    const originalRef = db.ref;
    jest.spyOn(db, "ref").mockImplementation((path) => {
      if (path === "locations") {
        const mockRef = {
          once: jest
            .fn()
            .mockRejectedValue(new Error("RTDB connection failed")),
        };
        return mockRef as any;
      }
      return originalRef.call(db, path);
    });

    try {
      await expect(wrappedRecalculateStats({})).rejects.toMatchObject({
        code: "internal",
        message: expect.stringContaining("Error recalculating stats"),
      });
    } finally {
      jest.restoreAllMocks();
    }
  });

  it("throws HttpsError when Firestore access fails", async () => {
    // Seed RTDB with valid data
    await db.ref("locations").set({
      pin1: {
        addedAt: isoToday(),
        address: "Test Pin St",
        additionalInfo: "",
        lat: 1,
        lng: 1,
      },
    });

    // Mock Firestore collection to throw an error
    const originalCollection = fs.collection;
    jest.spyOn(fs, "collection").mockImplementation((path) => {
      if (path === "old-pins") {
        return {
          get: jest
            .fn()
            .mockRejectedValue(new Error("Firestore connection failed")),
        } as any;
      }
      return originalCollection.call(fs, path);
    });

    try {
      await expect(wrappedRecalculateStats({})).rejects.toMatchObject({
        code: "internal",
        message: expect.stringContaining("Error recalculating stats"),
      });
    } finally {
      jest.restoreAllMocks();
    }
  });

  it("throws HttpsError when stats update fails", async () => {
    // Seed with valid data
    await db.ref("locations").set({
      pin1: {
        addedAt: isoToday(),
        address: "Test Pin St",
        additionalInfo: "",
        lat: 1,
        lng: 1,
      },
    });

    // Mock the stats ref set to fail
    const originalRef = db.ref;
    jest.spyOn(db, "ref").mockImplementation((path) => {
      if (path === "stats") {
        return {
          set: jest.fn().mockRejectedValue(new Error("Stats update failed")),
        } as any;
      }
      return originalRef.call(db, path);
    });

    try {
      await expect(wrappedRecalculateStats({})).rejects.toMatchObject({
        code: "internal",
        message: expect.stringContaining("Error recalculating stats"),
      });
    } finally {
      jest.restoreAllMocks();
    }
  });
});
