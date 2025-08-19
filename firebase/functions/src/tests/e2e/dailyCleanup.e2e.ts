process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: process.env.GCLOUD_PROJECT_ID,
  databaseURL: process.env.FB_RTDB_EMULATOR_URL,
});

import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";
import { performDailyCleanup } from "../../index";
import { CollectionReference } from "@google-cloud/firestore";

const testEnv = functionsTest({
  projectId: process.env.GCLOUD_PROJECT_ID,
  databaseURL: process.env.FB_RTDB_EMULATOR_URL,
});

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

describe("performDailyCleanup E2E", () => {
  beforeEach(async () => {
    await clearEmulators();
  });

  afterAll(async () => {
    try {
      await admin.app().delete();
    } catch {}
    await testEnv.cleanup();
  });

  it("moves >7d pins to Firestore, removes them from RTDB, and updates stats", async () => {
    // Seed RTDB with: 1 old (8d), 1 recent (6d), 1 today
    const locationsRef = db.ref("locations");
    const oldPin = {
      addedAt: isoDaysAgo(8),
      address: "Old Pin St, Pastville",
      additionalInfo: "",
      lat: 1,
      lng: 1,
    };
    const weekPin = {
      addedAt: isoDaysAgo(6),
      address: "Recent Rd, Weektown",
      additionalInfo: "",
      lat: 2,
      lng: 2,
    };
    const todayPin = {
      addedAt: new Date().toISOString(),
      address: "Today Ave, Nowcity",
      additionalInfo: "",
      lat: 3,
      lng: 3,
    };

    await locationsRef.set({
      old1: oldPin,
      wk1: weekPin,
      td1: todayPin,
    });

    // Seed stats. Your implementation subtracts count of old pins from week_pins.
    // Start at 3 so after subtracting 1 (old) we end at 2.
    await db.ref("stats").set({
      total_pins: 3,
      today_pins: 1,
      week_pins: 3,
    });

    // Act
    await performDailyCleanup();

    // Assert RTDB: old removed; week+today remain
    const afterLocSnap = await locationsRef.once("value");
    const afterLoc = afterLocSnap.val();
    expect(afterLoc).toBeTruthy();
    const ids = Object.keys(afterLoc);
    expect(ids).toEqual(expect.arrayContaining(["wk1", "td1"]));
    expect(ids).not.toEqual(expect.arrayContaining(["old1"]));

    // Assert Firestore: 1 doc moved to "old-pins" and it matches oldPin
    const oldPinsSnap = await fs.collection("old-pins").get();
    expect(oldPinsSnap.size).toBe(1);
    const moved = oldPinsSnap.docs[0].data();
    expect(moved.addedAt).toBe(oldPin.addedAt);
    expect(moved.address).toBe(oldPin.address);

    // Assert stats: today_pins reset to 0; week_pins decreased by 1; total_pins unchanged
    const afterStatsSnap = await db.ref("stats").once("value");
    const stats = afterStatsSnap.val();
    expect(stats).toBeTruthy();
    expect(stats.today_pins).toBe(0);
    expect(stats.week_pins).toBe(2); // 3 - 1 old = 2
    expect(stats.total_pins).toBe(3); // unchanged by cleanup
  });

  it("handles empty locations gracefully and only resets today_pins", async () => {
    // No locations
    await db.ref("locations").set(null);

    // Existing stats with no old pins to subtract
    await db.ref("stats").set({
      total_pins: 5,
      today_pins: 2,
      week_pins: 4,
    });

    await performDailyCleanup();

    const oldPinsSnap = await fs.collection("old-pins").get();
    expect(oldPinsSnap.size).toBe(0);

    const statsSnap = await db.ref("stats").once("value");
    const stats = statsSnap.val();
    expect(stats.today_pins).toBe(0); // reset
    expect(stats.week_pins).toBe(4); // unchanged (no old pins)
    expect(stats.total_pins).toBe(5); // unchanged
  });

  it("creates stats when missing and sets zeros", async () => {
    // Seed: one old, one recent; stats node missing
    await db.ref("stats").set(null);
    await db.ref("locations").set({
      old1: {
        addedAt: isoDaysAgo(10),
        address: "Way Old Blvd",
        additionalInfo: "",
        lat: 0,
        lng: 0,
      },
      wk1: {
        addedAt: isoDaysAgo(2),
        address: "Within Week Ln",
        additionalInfo: "",
        lat: 0,
        lng: 0,
      },
    });

    await performDailyCleanup();

    // Stats should be initialized to zeros per implementation when null
    const statsSnap = await db.ref("stats").once("value");
    const stats = statsSnap.val();
    expect(stats).toEqual({
      total_pins: 0,
      today_pins: 0,
      week_pins: 0,
    });

    // Old pin moved to Firestore; recent remains in RTDB
    const oldPinsSnap = await fs.collection("old-pins").get();
    expect(oldPinsSnap.size).toBe(1);

    const locationsSnap = await db.ref("locations").once("value");
    const locs = locationsSnap.val();
    expect(Object.keys(locs)).toEqual(["wk1"]);
  });

  it("throws HttpsError when database operation fails", async () => {
    const locationsRef = db.ref("locations");
    await locationsRef.set({
      old1: {
        addedAt: isoDaysAgo(8),
        address: "Old Pin St, Pastville",
        additionalInfo: "",
        lat: 1,
        lng: 1,
      },
      old2: {
        addedAt: isoDaysAgo(9),
        address: "Another Old St, Pastville",
        additionalInfo: "",
        lat: 2,
        lng: 2,
      },
    });

    // Mock add on all CollectionReference instances so the first add fails
    const originalAdd = CollectionReference.prototype.add;
    const addSpy = jest
      .spyOn(CollectionReference.prototype as any, "add")
      .mockRejectedValueOnce(new Error("Firestore connection failed"))
      .mockImplementation(function (this: any, ...args: any[]) {
        return originalAdd.apply(this, args as any);
      });

    await expect(performDailyCleanup()).rejects.toThrow(
      "database cleanup failed"
    );

    addSpy.mockRestore();
  });
});
