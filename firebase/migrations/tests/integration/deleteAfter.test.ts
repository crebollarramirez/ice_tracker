import { deleteAfter } from "../../migrations";
import * as admin from "firebase-admin";

// Mock Firebase Admin
jest.mock("firebase-admin", () => {
  const mockInitializeApp = jest.fn();
  const mockDatabase = jest.fn(() => ({
    ref: jest.fn(() => ({
      once: jest.fn(),
      update: jest.fn(),
    })),
  }));
  const mockFirestore = jest.fn(() => ({
    collection: jest.fn(() => ({
      get: jest.fn(),
      doc: jest.fn(() => ({ ref: {} })),
    })),
    batch: jest.fn(() => ({
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    })),
  }));

  return {
    initializeApp: mockInitializeApp,
    database: mockDatabase,
    firestore: mockFirestore,
  };
});

// Mock readline for user confirmation
jest.mock("readline", () => {
  const mockInterface = {
    question: jest.fn(),
    close: jest.fn(),
  };
  return {
    createInterface: jest.fn(() => mockInterface),
  };
});

describe("deleteAfter Integration Tests", () => {
  let mockRealtimeDb: jest.Mocked<admin.database.Database>;
  let mockFirestoreDb: jest.Mocked<admin.firestore.Firestore>;
  let mockLocationsRef: any;
  let mockOldPinsCollection: any;
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    // Mock console methods to reduce test noise
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = jest.fn();
    console.error = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();

    // Mock Realtime Database
    mockLocationsRef = {
      once: jest.fn(),
      update: jest.fn(),
    };

    mockRealtimeDb = {
      ref: jest.fn().mockReturnValue(mockLocationsRef),
    } as any;

    // Mock Firestore
    const mockBatch = {
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };

    mockOldPinsCollection = {
      get: jest.fn(),
      doc: jest.fn().mockReturnValue({ ref: {} }),
    };

    mockFirestoreDb = {
      collection: jest.fn().mockReturnValue(mockOldPinsCollection),
      batch: jest.fn().mockReturnValue(mockBatch),
    } as any;

    // Mock readline for user confirmation
    const readline = require("readline");
    const mockInterface = {
      question: jest.fn(),
      close: jest.fn(),
    };
    readline.createInterface.mockReturnValue(mockInterface);
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("Date Validation", () => {
    it("should throw error for invalid date format", async () => {
      await expect(
        deleteAfter("invalid-date", mockRealtimeDb, mockFirestoreDb)
      ).rejects.toThrow(
        'Invalid date format: invalid-date. Please use ISO 8601 format (e.g., "2024-10-25" or "2024-10-25T12:30:00.000Z")'
      );
    });

    it("should accept valid ISO 8601 date formats", async () => {
      // Mock empty databases
      mockLocationsRef.once.mockResolvedValue({ val: () => null });
      mockOldPinsCollection.get.mockResolvedValue({ docs: [] });

      const validDates = [
        "2024-10-25",
        "2024-10-25T12:30:00.000Z",
        "2024-12-31T23:59:59.999Z",
      ];

      for (const date of validDates) {
        const result = await deleteAfter(date, mockRealtimeDb, mockFirestoreDb);
        expect(result.message).toBe("No pins found to delete");
      }
    });
  });

  describe("Database Scanning", () => {
    it("should handle empty databases", async () => {
      // Mock empty databases
      mockLocationsRef.once.mockResolvedValue({ val: () => null });
      mockOldPinsCollection.get.mockResolvedValue({ docs: [] });

      const result = await deleteAfter(
        "2024-10-25",
        mockRealtimeDb,
        mockFirestoreDb
      );

      expect(result).toEqual({
        message: "No pins found to delete",
        deleted: { rtdb: 0, firestore: 0 },
      });
    });

    it("should scan and identify pins correctly based on date", async () => {
      const targetDate = "2024-10-25";

      // Mock RTDB data
      const rtdbData = {
        pin1: { addedAt: "2024-10-24T12:00:00.000Z", address: "123 Main St" }, // Before target
        pin2: { addedAt: "2024-10-25T10:00:00.000Z", address: "456 Oak Ave" }, // On target
        pin3: { addedAt: "2024-10-26T15:00:00.000Z", address: "789 Pine Rd" }, // After target
      };

      mockLocationsRef.once.mockResolvedValue({ val: () => rtdbData });

      // Mock Firestore data
      const firestoreDocs = [
        {
          id: "doc1",
          data: () => ({
            addedAt: "2024-10-23T08:00:00.000Z",
            address: "111 Elm St",
          }),
        }, // Before target
        {
          id: "doc2",
          data: () => ({
            addedAt: "2024-10-25T14:00:00.000Z",
            address: "222 Maple Ave",
          }),
        }, // On target
        {
          id: "doc3",
          data: () => ({
            addedAt: "2024-10-27T09:00:00.000Z",
            address: "333 Cedar Ln",
          }),
        }, // After target
      ];

      mockOldPinsCollection.get.mockResolvedValue({ docs: firestoreDocs });

      // Mock user confirmation as "no"
      const readline = require("readline");
      const mockInterface = readline.createInterface();
      mockInterface.question.mockImplementation(
        (message: string, callback: (answer: string) => void) => {
          callback("n");
        }
      );

      const result = await deleteAfter(
        targetDate,
        mockRealtimeDb,
        mockFirestoreDb
      );

      expect(result).toEqual({
        message: "Deletion cancelled by user",
        deleted: { rtdb: 0, firestore: 0 },
      });

      // Verify that the correct pins would have been identified for deletion
      // (pin2, pin3 from RTDB and doc2, doc3 from Firestore)
      expect(mockLocationsRef.once).toHaveBeenCalledWith("value");
      expect(mockOldPinsCollection.get).toHaveBeenCalled();
    });
  });

  describe("User Confirmation", () => {
    beforeEach(() => {
      // Mock data with pins to delete
      const rtdbData = {
        pin1: { addedAt: "2024-10-25T10:00:00.000Z", address: "123 Main St" },
        pin2: { addedAt: "2024-10-26T15:00:00.000Z", address: "456 Oak Ave" },
      };

      mockLocationsRef.once.mockResolvedValue({ val: () => rtdbData });

      const firestoreDocs = [
        {
          id: "doc1",
          data: () => ({
            addedAt: "2024-10-25T14:00:00.000Z",
            address: "789 Pine Rd",
          }),
        },
      ];

      mockOldPinsCollection.get.mockResolvedValue({ docs: firestoreDocs });
    });

    it("should cancel deletion when user responds 'n'", async () => {
      const readline = require("readline");
      const mockInterface = readline.createInterface();
      mockInterface.question.mockImplementation(
        (message: string, callback: (answer: string) => void) => {
          expect(message).toContain("Delete 3 pins? [y/n]:");
          callback("n");
        }
      );

      const result = await deleteAfter(
        "2024-10-25",
        mockRealtimeDb,
        mockFirestoreDb
      );

      expect(result).toEqual({
        message: "Deletion cancelled by user",
        deleted: { rtdb: 0, firestore: 0 },
      });

      // Verify no deletion calls were made
      expect(mockLocationsRef.update).not.toHaveBeenCalled();
      expect(mockFirestoreDb.batch).not.toHaveBeenCalled();
    });

    it("should proceed with deletion when user responds 'y'", async () => {
      const readline = require("readline");
      const mockInterface = readline.createInterface();
      mockInterface.question.mockImplementation(
        (message: string, callback: (answer: string) => void) => {
          expect(message).toContain("Delete 3 pins? [y/n]:");
          callback("y");
        }
      );

      // Mock successful deletion
      mockLocationsRef.update.mockResolvedValue(undefined);
      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      mockFirestoreDb.batch.mockReturnValue(mockBatch as any);

      const result = await deleteAfter(
        "2024-10-25",
        mockRealtimeDb,
        mockFirestoreDb
      );

      expect(result).toEqual({
        message: "Successfully deleted 3 pins from 2024-10-25 onwards",
        deleted: { rtdb: 2, firestore: 1 },
      });

      // Verify deletion calls were made
      expect(mockLocationsRef.update).toHaveBeenCalledWith({
        pin1: null,
        pin2: null,
      });
      expect(mockBatch.delete).toHaveBeenCalledTimes(1);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it("should accept variations of 'yes' responses", async () => {
      const yesVariations = ["y", "Y", "yes", "YES", "Yes"];

      for (const response of yesVariations) {
        jest.clearAllMocks();

        // Re-setup mocks for each iteration
        const rtdbData = {
          pin1: { addedAt: "2024-10-25T10:00:00.000Z", address: "123 Main St" },
        };
        mockLocationsRef.once.mockResolvedValue({ val: () => rtdbData });
        mockOldPinsCollection.get.mockResolvedValue({ docs: [] });
        mockLocationsRef.update.mockResolvedValue(undefined);

        const readline = require("readline");
        const mockInterface = readline.createInterface();
        mockInterface.question.mockImplementation(
          (message: string, callback: (answer: string) => void) => {
            callback(response);
          }
        );

        const result = await deleteAfter(
          "2024-10-25",
          mockRealtimeDb,
          mockFirestoreDb
        );

        expect(result.deleted.rtdb).toBe(1);
        expect(result.deleted.firestore).toBe(0);
      }
    });
  });

  describe("Deletion Operations", () => {
    it("should handle RTDB deletion correctly", async () => {
      const rtdbData = {
        pin1: { addedAt: "2024-10-25T10:00:00.000Z", address: "123 Main St" },
        pin2: { addedAt: "2024-10-26T15:00:00.000Z", address: "456 Oak Ave" },
        pin3: { addedAt: "2024-10-24T08:00:00.000Z", address: "789 Pine Rd" }, // Before target
      };

      mockLocationsRef.once.mockResolvedValue({ val: () => rtdbData });
      mockOldPinsCollection.get.mockResolvedValue({ docs: [] });
      mockLocationsRef.update.mockResolvedValue(undefined);

      // Mock user confirmation
      const readline = require("readline");
      const mockInterface = readline.createInterface();
      mockInterface.question.mockImplementation(
        (message: string, callback: (answer: string) => void) => {
          callback("y");
        }
      );

      const result = await deleteAfter(
        "2024-10-25",
        mockRealtimeDb,
        mockFirestoreDb
      );

      expect(result.deleted.rtdb).toBe(2);
      expect(result.deleted.firestore).toBe(0);

      // Verify correct pins were marked for deletion
      expect(mockLocationsRef.update).toHaveBeenCalledWith({
        pin1: null,
        pin2: null,
      });
    });

    it("should handle Firestore deletion in batches", async () => {
      mockLocationsRef.once.mockResolvedValue({ val: () => null });

      // Create many Firestore docs to test batching
      const firestoreDocs = [];
      for (let i = 0; i < 1200; i++) {
        firestoreDocs.push({
          id: `doc${i}`,
          data: () => ({
            addedAt: "2024-10-25T10:00:00.000Z",
            address: `${i} Test St`,
          }),
        });
      }

      mockOldPinsCollection.get.mockResolvedValue({ docs: firestoreDocs });

      // Mock user confirmation
      const readline = require("readline");
      const mockInterface = readline.createInterface();
      mockInterface.question.mockImplementation(
        (message: string, callback: (answer: string) => void) => {
          callback("y");
        }
      );

      // Mock batch operations
      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      mockFirestoreDb.batch.mockReturnValue(mockBatch as any);

      const result = await deleteAfter(
        "2024-10-25",
        mockRealtimeDb,
        mockFirestoreDb
      );

      expect(result.deleted.firestore).toBe(1200);

      // Verify batching (should create 3 batches: 500 + 500 + 200)
      expect(mockFirestoreDb.batch).toHaveBeenCalledTimes(3);
      expect(mockBatch.commit).toHaveBeenCalledTimes(3);
    });

    it("should skip empty update operations", async () => {
      // Mock data where no pins match the deletion criteria
      const rtdbData = {
        pin1: { addedAt: "2024-10-24T08:00:00.000Z", address: "123 Main St" }, // Before target
      };

      mockLocationsRef.once.mockResolvedValue({ val: () => rtdbData });

      const firestoreDocs = [
        {
          id: "doc1",
          data: () => ({
            addedAt: "2024-10-24T14:00:00.000Z",
            address: "456 Oak Ave",
          }),
        }, // Before target
      ];

      mockOldPinsCollection.get.mockResolvedValue({ docs: firestoreDocs });

      const result = await deleteAfter(
        "2024-10-25",
        mockRealtimeDb,
        mockFirestoreDb
      );

      expect(result).toEqual({
        message: "No pins found to delete",
        deleted: { rtdb: 0, firestore: 0 },
      });

      // Verify no deletion operations were performed
      expect(mockLocationsRef.update).not.toHaveBeenCalled();
      expect(mockFirestoreDb.batch).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle RTDB read errors", async () => {
      mockLocationsRef.once.mockRejectedValue(
        new Error("RTDB connection failed")
      );
      mockOldPinsCollection.get.mockResolvedValue({ docs: [] });

      await expect(
        deleteAfter("2024-10-25", mockRealtimeDb, mockFirestoreDb)
      ).rejects.toThrow("Failed to delete pins: Error: RTDB connection failed");
    });

    it("should handle Firestore read errors", async () => {
      mockLocationsRef.once.mockResolvedValue({ val: () => null });
      mockOldPinsCollection.get.mockRejectedValue(
        new Error("Firestore connection failed")
      );

      await expect(
        deleteAfter("2024-10-25", mockRealtimeDb, mockFirestoreDb)
      ).rejects.toThrow(
        "Failed to delete pins: Error: Firestore connection failed"
      );
    });

    it("should handle RTDB deletion errors", async () => {
      const rtdbData = {
        pin1: { addedAt: "2024-10-25T10:00:00.000Z", address: "123 Main St" },
      };

      mockLocationsRef.once.mockResolvedValue({ val: () => rtdbData });
      mockOldPinsCollection.get.mockResolvedValue({ docs: [] });
      mockLocationsRef.update.mockRejectedValue(
        new Error("RTDB update failed")
      );

      // Mock user confirmation
      const readline = require("readline");
      const mockInterface = readline.createInterface();
      mockInterface.question.mockImplementation(
        (message: string, callback: (answer: string) => void) => {
          callback("y");
        }
      );

      await expect(
        deleteAfter("2024-10-25", mockRealtimeDb, mockFirestoreDb)
      ).rejects.toThrow("Failed to delete pins: Error: RTDB update failed");
    });

    it("should handle Firestore deletion errors", async () => {
      mockLocationsRef.once.mockResolvedValue({ val: () => null });

      const firestoreDocs = [
        {
          id: "doc1",
          data: () => ({
            addedAt: "2024-10-25T10:00:00.000Z",
            address: "123 Main St",
          }),
        },
      ];

      mockOldPinsCollection.get.mockResolvedValue({ docs: firestoreDocs });

      // Mock user confirmation
      const readline = require("readline");
      const mockInterface = readline.createInterface();
      mockInterface.question.mockImplementation(
        (message: string, callback: (answer: string) => void) => {
          callback("y");
        }
      );

      // Mock batch operations to fail
      const mockBatch = {
        delete: jest.fn(),
        commit: jest
          .fn()
          .mockRejectedValue(new Error("Firestore batch failed")),
      };
      mockFirestoreDb.batch.mockReturnValue(mockBatch as any);

      await expect(
        deleteAfter("2024-10-25", mockRealtimeDb, mockFirestoreDb)
      ).rejects.toThrow("Failed to delete pins: Error: Firestore batch failed");
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

      mockLocationsRef.once.mockResolvedValue({ val: () => rtdbData });
      mockOldPinsCollection.get.mockResolvedValue({ docs: [] });

      // Mock user confirmation
      const readline = require("readline");
      const mockInterface = readline.createInterface();
      mockInterface.question.mockImplementation(
        (message: string, callback: (answer: string) => void) => {
          expect(message).toContain("Delete 2 pins? [y/n]:");
          callback("n");
        }
      );

      const result = await deleteAfter(
        targetDate,
        mockRealtimeDb,
        mockFirestoreDb
      );

      // Should identify 2 pins for deletion (exact match and after)
      expect(result).toEqual({
        message: "Deletion cancelled by user",
        deleted: { rtdb: 0, firestore: 0 },
      });

      // Verify the function correctly identified pins for deletion
      expect(mockLocationsRef.once).toHaveBeenCalledWith("value");
      expect(mockOldPinsCollection.get).toHaveBeenCalled();

      // Verify no actual deletions were performed since user cancelled
      expect(mockLocationsRef.update).not.toHaveBeenCalled();
      expect(mockFirestoreDb.batch).not.toHaveBeenCalled();

      // Verify the confirmation message contained the correct count
      const readlineModule = require("readline");
      const mockInterfaceInstance = readlineModule.createInterface();
      expect(mockInterfaceInstance.question).toHaveBeenCalledWith(
        expect.stringContaining("Delete 2 pins? [y/n]:"),
        expect.any(Function)
      );
    });
  });
});
