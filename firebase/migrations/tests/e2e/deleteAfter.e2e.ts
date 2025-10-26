import * as admin from "firebase-admin";
import { deleteAfter } from "../../migrations";
import * as readline from "readline";

// Configure Firebase Admin for testing with emulators
const TEST_PROJECT_ID = "test-migration-project";
const RTDB_EMULATOR_HOST = "localhost:9000";
const FIRESTORE_EMULATOR_HOST = "localhost:8080";

// Set environment variables for emulators
process.env.FIREBASE_DATABASE_EMULATOR_HOST = RTDB_EMULATOR_HOST;
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR_HOST;

// Initialize Firebase Admin SDK for E2E testing
let app: admin.app.App;
let realtimeDb: admin.database.Database;
let firestoreDb: admin.firestore.Firestore;

// Mock readline to simulate user input
jest.mock("readline");
const mockReadline = readline as jest.Mocked<typeof readline>;

beforeAll(async () => {
  // Initialize Firebase Admin with emulator settings
  app = admin.initializeApp(
    {
      projectId: TEST_PROJECT_ID,
      databaseURL: `http://${RTDB_EMULATOR_HOST}?ns=${TEST_PROJECT_ID}`,
    },
    "e2e-deleteAfter-test"
  );

  realtimeDb = admin.database(app);
  firestoreDb = admin.firestore(app);
});

afterAll(async () => {
  // Clean up
  if (app) {
    await app.delete();
  }
});

describe("deleteAfter E2E Tests", () => {
  let mockInterface: any;

  beforeEach(async () => {
    // Clear the emulator databases before each test
    await realtimeDb.ref().set(null);

    // Clear Firestore collections
    const oldPinsCollection = firestoreDb.collection("old-pins");
    const snapshot = await oldPinsCollection.get();
    const batch = firestoreDb.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Setup readline mock
    mockInterface = {
      question: jest.fn(),
      close: jest.fn(),
    };
    mockReadline.createInterface.mockReturnValue(mockInterface);
  });

  describe("Date Validation", () => {
    it("should throw error for invalid date format", async () => {
      await expect(
        deleteAfter("invalid-date", realtimeDb, firestoreDb)
      ).rejects.toThrow(
        'Invalid date format: invalid-date. Please use ISO 8601 format (e.g., "2024-10-25" or "2024-10-25T12:30:00.000Z")'
      );
    });

    it("should accept valid ISO 8601 date formats", async () => {
      const validDates = [
        "2024-10-25",
        "2024-10-25T12:30:00.000Z",
        "2024-12-31T23:59:59.999Z",
      ];

      for (const date of validDates) {
        const result = await deleteAfter(date, realtimeDb, firestoreDb);
        expect(result.message).toBe("No pins found to delete");
        expect(result.deleted).toEqual({ rtdb: 0, firestore: 0 });
      }
    });
  });

  describe("Database Scanning and Deletion", () => {
    it("should handle empty databases", async () => {
      const result = await deleteAfter("2024-10-25", realtimeDb, firestoreDb);

      expect(result).toEqual({
        message: "No pins found to delete",
        deleted: { rtdb: 0, firestore: 0 },
      });
    });

    it("should scan and delete pins correctly from RTDB based on date", async () => {
      const targetDate = "2024-10-25";

      // Seed RTDB with test data
      const rtdbData = {
        pin1: { addedAt: "2024-10-24T12:00:00.000Z", address: "123 Main St" }, // Before target
        pin2: { addedAt: "2024-10-25T10:00:00.000Z", address: "456 Oak Ave" }, // On target
        pin3: { addedAt: "2024-10-26T15:00:00.000Z", address: "789 Pine Rd" }, // After target
      };
      await realtimeDb.ref("locations").set(rtdbData);

      // Mock user confirmation as "yes"
      mockInterface.question.mockImplementation(
        (message: string, callback: (answer: string) => void) => {
          expect(message).toContain("❓ Delete 2 pins? [y/n]:");
          callback("y");
        }
      );

      const result = await deleteAfter(targetDate, realtimeDb, firestoreDb);

      expect(result).toEqual({
        message: "Successfully deleted 2 pins from 2024-10-25 onwards",
        deleted: { rtdb: 2, firestore: 0 },
      });

      // Verify pins were actually deleted from RTDB
      const remainingData = (
        await realtimeDb.ref("locations").once("value")
      ).val();
      expect(remainingData).toEqual({
        pin1: { addedAt: "2024-10-24T12:00:00.000Z", address: "123 Main St" },
      });
    });

    it("should scan and delete pins correctly from Firestore based on date", async () => {
      const targetDate = "2024-10-25";

      // Seed Firestore with test data
      const oldPinsCollection = firestoreDb.collection("old-pins");
      await oldPinsCollection.doc("doc1").set({
        addedAt: "2024-10-23T08:00:00.000Z",
        address: "111 Elm St",
      }); // Before target
      await oldPinsCollection.doc("doc2").set({
        addedAt: "2024-10-25T14:00:00.000Z",
        address: "222 Maple Ave",
      }); // On target
      await oldPinsCollection.doc("doc3").set({
        addedAt: "2024-10-27T09:00:00.000Z",
        address: "333 Cedar Ln",
      }); // After target

      // Mock user confirmation as "yes"
      mockInterface.question.mockImplementation(
        (message: string, callback: (answer: string) => void) => {
          expect(message).toContain("❓ Delete 2 pins? [y/n]:");
          callback("y");
        }
      );

      const result = await deleteAfter(targetDate, realtimeDb, firestoreDb);

      expect(result).toEqual({
        message: "Successfully deleted 2 pins from 2024-10-25 onwards",
        deleted: { rtdb: 0, firestore: 2 },
      });

      // Verify pins were actually deleted from Firestore
      const remainingDocs = await oldPinsCollection.get();
      expect(remainingDocs.size).toBe(1);
      expect(remainingDocs.docs[0].id).toBe("doc1");
    });

    it("should delete pins from both databases simultaneously", async () => {
      const targetDate = "2024-10-25";

      // Seed RTDB
      const rtdbData = {
        pin1: { addedAt: "2024-10-24T12:00:00.000Z", address: "123 Main St" }, // Before
        pin2: { addedAt: "2024-10-25T10:00:00.000Z", address: "456 Oak Ave" }, // On/after
        pin3: { addedAt: "2024-10-26T15:00:00.000Z", address: "789 Pine Rd" }, // After
      };
      await realtimeDb.ref("locations").set(rtdbData);

      // Seed Firestore
      const oldPinsCollection = firestoreDb.collection("old-pins");
      await oldPinsCollection.doc("doc1").set({
        addedAt: "2024-10-24T08:00:00.000Z",
        address: "111 Elm St",
      }); // Before
      await oldPinsCollection.doc("doc2").set({
        addedAt: "2024-10-25T14:00:00.000Z",
        address: "222 Maple Ave",
      }); // On/after

      // Mock user confirmation as "yes"
      mockInterface.question.mockImplementation(
        (message: string, callback: (answer: string) => void) => {
          expect(message).toContain("❓ Delete 3 pins? [y/n]:");
          callback("y");
        }
      );

      const result = await deleteAfter(targetDate, realtimeDb, firestoreDb);

      expect(result).toEqual({
        message: "Successfully deleted 3 pins from 2024-10-25 onwards",
        deleted: { rtdb: 2, firestore: 1 },
      });

      // Verify RTDB deletions
      const remainingRtdbData = (
        await realtimeDb.ref("locations").once("value")
      ).val();
      expect(remainingRtdbData).toEqual({
        pin1: { addedAt: "2024-10-24T12:00:00.000Z", address: "123 Main St" },
      });

      // Verify Firestore deletions
      const remainingFirestoreDocs = await oldPinsCollection.get();
      expect(remainingFirestoreDocs.size).toBe(1);
      expect(remainingFirestoreDocs.docs[0].id).toBe("doc1");
    });
  });

  describe("User Confirmation", () => {
    beforeEach(async () => {
      // Seed both databases with data that would be deleted
      const rtdbData = {
        pin1: { addedAt: "2024-10-25T10:00:00.000Z", address: "123 Main St" },
        pin2: { addedAt: "2024-10-26T15:00:00.000Z", address: "456 Oak Ave" },
      };
      await realtimeDb.ref("locations").set(rtdbData);

      const oldPinsCollection = firestoreDb.collection("old-pins");
      await oldPinsCollection.doc("doc1").set({
        addedAt: "2024-10-25T14:00:00.000Z",
        address: "789 Pine Rd",
      });
    });

    it("should cancel deletion when user responds 'n'", async () => {
      mockInterface.question.mockImplementation(
        (message: string, callback: (answer: string) => void) => {
          expect(message).toContain("❓ Delete 3 pins? [y/n]:");
          callback("n");
        }
      );

      const result = await deleteAfter("2024-10-25", realtimeDb, firestoreDb);

      expect(result).toEqual({
        message: "Deletion cancelled by user",
        deleted: { rtdb: 0, firestore: 0 },
      });

      // Verify no deletions occurred
      const rtdbData = (await realtimeDb.ref("locations").once("value")).val();
      expect(Object.keys(rtdbData)).toHaveLength(2);

      const firestoreDocs = await firestoreDb.collection("old-pins").get();
      expect(firestoreDocs.size).toBe(1);
    });

    it("should proceed with deletion when user responds 'y'", async () => {
      mockInterface.question.mockImplementation(
        (message: string, callback: (answer: string) => void) => {
          expect(message).toContain("Delete 3 pins? [y/n]:");
          callback("y");
        }
      );

      const result = await deleteAfter("2024-10-25", realtimeDb, firestoreDb);

      expect(result).toEqual({
        message: "Successfully deleted 3 pins from 2024-10-25 onwards",
        deleted: { rtdb: 2, firestore: 1 },
      });

      // Verify deletions occurred
      const rtdbData = (await realtimeDb.ref("locations").once("value")).val();
      expect(rtdbData).toBeNull();

      const firestoreDocs = await firestoreDb.collection("old-pins").get();
      expect(firestoreDocs.size).toBe(0);
    });

    it("should accept variations of 'yes' responses", async () => {
      const yesVariations = ["y", "Y", "yes", "YES", "Yes"];

      for (const response of yesVariations) {
        // Reset data for each test
        const rtdbData = {
          pin1: { addedAt: "2024-10-25T10:00:00.000Z", address: "123 Main St" },
        };
        await realtimeDb.ref("locations").set(rtdbData);

        // Clear Firestore for this iteration
        const oldPinsCollection = firestoreDb.collection("old-pins");
        const snapshot = await oldPinsCollection.get();
        const batch = firestoreDb.batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();

        mockInterface.question.mockImplementation(
          (message: string, callback: (answer: string) => void) => {
            callback(response);
          }
        );

        const result = await deleteAfter("2024-10-25", realtimeDb, firestoreDb);

        expect(result.deleted.rtdb).toBe(1);
        expect(result.deleted.firestore).toBe(0);

        // Verify deletion occurred
        const remainingData = (
          await realtimeDb.ref("locations").once("value")
        ).val();
        expect(remainingData).toBeNull();
      }
    });
  });

  describe("Firestore Batch Operations", () => {
    it("should handle large Firestore datasets with batching", async () => {
      const oldPinsCollection = firestoreDb.collection("old-pins");

      // Create 1200 documents to test batching (Firestore limit is 500 per batch)
      const batch1 = firestoreDb.batch();
      const batch2 = firestoreDb.batch();
      const batch3 = firestoreDb.batch();

      for (let i = 0; i < 1200; i++) {
        const docRef = oldPinsCollection.doc(`doc${i}`);
        const data = {
          addedAt: "2024-10-25T10:00:00.000Z",
          address: `${i} Test Street`,
        };

        if (i < 400) {
          batch1.set(docRef, data);
        } else if (i < 800) {
          batch2.set(docRef, data);
        } else {
          batch3.set(docRef, data);
        }
      }

      await Promise.all([batch1.commit(), batch2.commit(), batch3.commit()]);

      // Mock user confirmation
      mockInterface.question.mockImplementation(
        (message: string, callback: (answer: string) => void) => {
          expect(message).toContain("Delete 1200 pins? [y/n]:");
          callback("y");
        }
      );

      const result = await deleteAfter("2024-10-25", realtimeDb, firestoreDb);

      expect(result.deleted.firestore).toBe(1200);
      expect(result.deleted.rtdb).toBe(0);

      // Verify all documents were deleted
      const remainingDocs = await oldPinsCollection.get();
      expect(remainingDocs.size).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle pins with exactly the target date", async () => {
      const targetDate = "2024-10-25T12:30:00.000Z";

      const rtdbData = {
        pin1: { addedAt: "2024-10-25T12:30:00.000Z", address: "123 Main St" }, // Exact match
        pin2: { addedAt: "2024-10-25T12:29:59.999Z", address: "456 Oak Ave" }, // 1ms before
        pin3: { addedAt: "2024-10-25T12:30:00.001Z", address: "789 Pine Rd" }, // 1ms after
      };
      await realtimeDb.ref("locations").set(rtdbData);

      mockInterface.question.mockImplementation(
        (message: string, callback: (answer: string) => void) => {
          expect(message).toContain("Delete 2 pins? [y/n]:");
          callback("y");
        }
      );

      const result = await deleteAfter(targetDate, realtimeDb, firestoreDb);

      expect(result.deleted.rtdb).toBe(2);

      // Verify only the pin before target date remains
      const remainingData = (
        await realtimeDb.ref("locations").once("value")
      ).val();
      expect(remainingData).toEqual({
        pin2: { addedAt: "2024-10-25T12:29:59.999Z", address: "456 Oak Ave" },
      });
    });
  });

//   describe("Performance and Reliability", () => {
//     it("should complete deletion of moderate dataset within reasonable time", async () => {
//       // Create moderate dataset (50 RTDB pins + 50 Firestore docs)
//       const rtdbData: { [key: string]: any } = {};
//       for (let i = 0; i < 50; i++) {
//         rtdbData[`pin${i}`] = {
//           addedAt: "2024-10-25T10:00:00.000Z",
//           address: `${i} RTDB Street`,
//         };
//       }
//       await realtimeDb.ref("locations").set(rtdbData);

//       const oldPinsCollection = firestoreDb.collection("old-pins");
//       const firestoreBatch = firestoreDb.batch();
//       for (let i = 0; i < 50; i++) {
//         const docRef = oldPinsCollection.doc(`doc${i}`);
//         firestoreBatch.set(docRef, {
//           addedAt: "2024-10-25T10:00:00.000Z",
//           address: `${i} Firestore Avenue`,
//         });
//       }
//       await firestoreBatch.commit();

//       mockInterface.question.mockImplementation(
//         (message: string, callback: (answer: string) => void) => {
//           expect(message).toContain("❓ Delete 100 pins? [y/n]:");
//           callback("y");
//         }
//       );

//       const startTime = Date.now();
//       const result = await deleteAfter("2024-10-25", realtimeDb, firestoreDb);
//       const endTime = Date.now();

//       expect(result.deleted.rtdb).toBe(50);
//       expect(result.deleted.firestore).toBe(50);

//       // Should complete within 5 seconds for moderate dataset
//       expect(endTime - startTime).toBeLessThan(5000);

//       // Verify all data was deleted
//       const remainingRtdbData = (
//         await realtimeDb.ref("locations").once("value")
//       ).val();
//       expect(remainingRtdbData).toBeNull();

//       const remainingFirestoreDocs = await oldPinsCollection.get();
//       expect(remainingFirestoreDocs.size).toBe(0);
//     });

//     it("should handle concurrent database operations gracefully", async () => {
//       // Seed initial data
//       const rtdbData = {
//         pin1: { addedAt: "2024-10-25T10:00:00.000Z", address: "123 Main St" },
//         pin2: { addedAt: "2024-10-26T15:00:00.000Z", address: "456 Oak Ave" },
//       };
//       await realtimeDb.ref("locations").set(rtdbData);

//       const oldPinsCollection = firestoreDb.collection("old-pins");
//       await oldPinsCollection.doc("doc1").set({
//         addedAt: "2024-10-25T14:00:00.000Z",
//         address: "789 Pine Rd",
//       });

//       // Start deletion process
//       mockInterface.question.mockImplementation(
//         (message: string, callback: (answer: string) => void) => {
//           // Simulate concurrent write during confirmation
//           setTimeout(async () => {
//             await realtimeDb.ref("locations/pin3").set({
//               addedAt: "2024-10-27T12:00:00.000Z",
//               address: "999 New Street",
//             });
//           }, 100);

//           setTimeout(() => callback("y"), 200);
//         }
//       );

//       const result = await deleteAfter("2024-10-25", realtimeDb, firestoreDb);

//       // Should still delete the original pins
//       expect(result.deleted.rtdb).toBe(2);
//       expect(result.deleted.firestore).toBe(1);

//       // Verify the concurrent write wasn't affected
//       const remainingData = (
//         await realtimeDb.ref("locations").once("value")
//       ).val();
//       expect(remainingData).toEqual({
//         pin3: {
//           addedAt: "2024-10-27T12:00:00.000Z",
//           address: "999 New Street",
//         },
//       });
//     });
//   });

//   describe("Error Recovery", () => {
//     it("should maintain data integrity if partial operation fails", async () => {
//       // This test simulates a scenario where RTDB succeeds but Firestore might fail
//       // Since we're using real emulators, we'll test data consistency

//       const rtdbData = {
//         pin1: { addedAt: "2024-10-25T10:00:00.000Z", address: "123 Main St" },
//       };
//       await realtimeDb.ref("locations").set(rtdbData);

//       const oldPinsCollection = firestoreDb.collection("old-pins");
//       await oldPinsCollection.doc("doc1").set({
//         addedAt: "2024-10-25T14:00:00.000Z",
//         address: "789 Pine Rd",
//       });

//       mockInterface.question.mockImplementation(
//         (message: string, callback: (answer: string) => void) => {
//           expect(message).toContain("❓ Delete 2 pins? [y/n]:");
//           callback("y");
//         }
//       );

//       const result = await deleteAfter("2024-10-25", realtimeDb, firestoreDb);

//       // Both operations should succeed with emulators
//       expect(result.deleted.rtdb).toBe(1);
//       expect(result.deleted.firestore).toBe(1);

//       // Verify clean state
//       const remainingRtdbData = (
//         await realtimeDb.ref("locations").once("value")
//       ).val();
//       expect(remainingRtdbData).toBeNull();

//       const remainingFirestoreDocs = await oldPinsCollection.get();
//       expect(remainingFirestoreDocs.size).toBe(0);
//     });
//   });
});
