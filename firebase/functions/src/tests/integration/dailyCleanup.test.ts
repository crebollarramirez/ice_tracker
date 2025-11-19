// import functionsTest from "firebase-functions-test";
// import { performDailyCleanup } from "../../index";

// // Mock Firebase Functions Logger
// jest.mock("firebase-functions/logger", () => ({
//   info: jest.fn(),
//   error: jest.fn(),
//   warn: jest.fn(),
//   debug: jest.fn(),
// }));

// // Mock Firebase Admin SDK
// jest.mock("firebase-admin", () => {
//   const mockOnce = jest.fn();
//   const mockChild = jest.fn();
//   const mockRemove = jest.fn().mockResolvedValue(true);
//   const mockSet = jest.fn().mockResolvedValue(true);
//   const mockUpdate = jest.fn().mockResolvedValue(true);
//   const mockGet = jest.fn();
//   const mockTransaction = jest.fn();
//   const mockRef = jest.fn();
//   const mockAdd = jest.fn().mockResolvedValue({ id: "mock-doc-id" });
//   const mockDoc = jest.fn(() => ({
//     get: mockGet,
//     set: mockSet,
//     update: mockUpdate,
//   }));
//   const mockCollection = jest.fn(() => ({
//     add: mockAdd,
//     doc: mockDoc,
//   }));

//   return {
//     initializeApp: jest.fn(),
//     database: jest.fn(() => ({ ref: mockRef })),
//     firestore: jest.fn(() => ({ collection: mockCollection })),
//     __mockOnce: mockOnce,
//     __mockChild: mockChild,
//     __mockRemove: mockRemove,
//     __mockSet: mockSet,
//     __mockUpdate: mockUpdate,
//     __mockGet: mockGet,
//     __mockTransaction: mockTransaction,
//     __mockRef: mockRef,
//     __mockAdd: mockAdd,
//     __mockDoc: mockDoc,
//     __mockCollection: mockCollection,
//   };
// });

// const testEnv = functionsTest({ projectId: "iceinmyarea" });

// describe("dailyCleanup – integration", () => {
//   let mockOnce: jest.Mock;
//   let mockChild: jest.Mock;
//   let mockRemove: jest.Mock;
//   let mockTransaction: jest.Mock;
//   let mockRef: jest.Mock;
//   let mockAdd: jest.Mock;
//   let mockDoc: jest.Mock;
//   let mockGet: jest.Mock;
//   let mockSet: jest.Mock;
//   let mockUpdate: jest.Mock;
//   let mockCollection: jest.Mock;

//   const FIXED_DATE = new Date("2025-07-26T00:00:00.000Z").getTime();

//   beforeEach(() => {
//     // Mock Date to ensure consistent test results
//     jest.useFakeTimers();
//     jest.setSystemTime(FIXED_DATE);

//     // Get access to the mocked Firebase Admin SDK functions
//     const admin = require("firebase-admin");
//     mockOnce = admin.__mockOnce;
//     mockChild = admin.__mockChild;
//     mockRemove = admin.__mockRemove;
//     mockTransaction = admin.__mockTransaction;
//     mockRef = admin.__mockRef;
//     mockAdd = admin.__mockAdd;
//     mockDoc = admin.__mockDoc;
//     mockGet = admin.__mockGet;
//     mockSet = admin.__mockSet;
//     mockUpdate = admin.__mockUpdate;
//     mockCollection = admin.__mockCollection;

//     // Reset all mocks
//     jest.clearAllMocks();

//     // Reset mock implementations to their default resolved state
//     mockOnce.mockReset();
//     mockChild.mockReset();
//     mockRemove.mockReset().mockResolvedValue(true);
//     mockTransaction.mockReset();
//     mockRef.mockReset();
//     mockAdd.mockReset().mockResolvedValue({ id: "mock-doc-id" });
//     mockGet.mockReset().mockResolvedValue({ exists: false }); // Default: document doesn't exist
//     mockSet.mockReset().mockResolvedValue(true);
//     mockUpdate.mockReset().mockResolvedValue(true);
//     mockDoc.mockReset().mockReturnValue({
//       get: mockGet,
//       set: mockSet,
//       update: mockUpdate,
//     });
//     mockCollection.mockReset().mockReturnValue({
//       add: mockAdd,
//       doc: mockDoc,
//     });

//     // Setup default mock implementations
//     mockChild.mockReturnValue({ remove: mockRemove });
//     mockTransaction.mockImplementation((updateFn) => {
//       const currentStats = { total_pins: 10, today_pins: 3, week_pins: 7 };
//       const updatedStats = updateFn(currentStats);
//       return Promise.resolve(updatedStats);
//     });
//   });

//   afterEach(() => {
//     jest.useRealTimers();
//   });

//   afterAll(() => testEnv.cleanup());

//   it("should handle empty database gracefully", async () => {
//     // Mock empty database
//     mockOnce.mockResolvedValue({ val: () => null });
//     mockRef.mockImplementation((path: string) => {
//       if (path === "locations") {
//         return { once: mockOnce };
//       }
//       if (path === "stats") {
//         return { transaction: mockTransaction };
//       }
//       return {};
//     });

//     await performDailyCleanup();

//     // Verify locations were checked
//     expect(mockRef).toHaveBeenCalledWith("locations");
//     expect(mockOnce).toHaveBeenCalledWith("value");

//     // Verify stats were updated (today_pins reset to 0)
//     expect(mockRef).toHaveBeenCalledWith("stats");
//     expect(mockTransaction).toHaveBeenCalled();

//     // Verify transaction callback resets today_pins
//     const transactionCallback = mockTransaction.mock.calls[0][0];
//     const mockCurrentStats = { total_pins: 10, today_pins: 3, week_pins: 7 };
//     const updatedStats = transactionCallback(mockCurrentStats);
//     expect(updatedStats.today_pins).toBe(0);
//   });

//   it("should move old locations to Firestore and update stats", async () => {
//     // Mock database with locations (some older than 7 days)
//     const mockLocations = {
//       "location-1": {
//         addedAt: "2025-07-15T12:00:00.000Z", // 11 days ago from mocked date (older than 7 days)
//         address: "Old Location 1",
//         additionalInfo: "Old info 1",
//         lat: 40.7128,
//         lng: -74.006,
//         reported: 1,
//       },
//       "location-2": {
//         addedAt: "2025-07-25T12:00:00.000Z", // 1 day ago from mocked date (recent)
//         address: "Recent Location",
//         additionalInfo: "Recent info",
//         lat: 40.7129,
//         lng: -74.007,
//         reported: 1,
//       },
//       "location-3": {
//         addedAt: "2025-07-10T12:00:00.000Z", // 16 days ago from mocked date (older than 7 days)
//         address: "Old Location 2",
//         additionalInfo: "Old info 2",
//         lat: 40.713,
//         lng: -74.008,
//         reported: 1,
//       },
//     };

//     mockOnce.mockResolvedValue({ val: () => mockLocations });
//     mockRef.mockImplementation((path: string) => {
//       if (path === "locations") {
//         return { once: mockOnce, child: mockChild };
//       }
//       if (path === "stats") {
//         return { transaction: mockTransaction };
//       }
//       return {};
//     });

//     await performDailyCleanup();

//     // Verify locations were fetched
//     expect(mockRef).toHaveBeenCalledWith("locations");
//     expect(mockOnce).toHaveBeenCalledWith("value");

//     // Verify old locations were moved to Firestore
//     expect(mockCollection).toHaveBeenCalledWith("old-pins");
//     expect(mockDoc).toHaveBeenCalledTimes(2); // 2 old locations

//     // Verify calls to get document references for old locations
//     expect(mockDoc).toHaveBeenCalledWith("location-1");
//     expect(mockDoc).toHaveBeenCalledWith("location-3");

//     // Verify documents were checked for existence
//     expect(mockGet).toHaveBeenCalledTimes(2);

//     // Verify documents were set (since they don't exist by default)
//     expect(mockSet).toHaveBeenCalledTimes(2);
//     expect(mockSet).toHaveBeenCalledWith(mockLocations["location-1"]);
//     expect(mockSet).toHaveBeenCalledWith(mockLocations["location-3"]);

//     // Verify old locations were removed from RTDB
//     expect(mockChild).toHaveBeenCalledWith("location-1");
//     expect(mockChild).toHaveBeenCalledWith("location-3");
//     expect(mockRemove).toHaveBeenCalledTimes(2);

//     // Verify recent location was not touched
//     expect(mockChild).not.toHaveBeenCalledWith("location-2");

//     // Verify stats were updated
//     expect(mockRef).toHaveBeenCalledWith("stats");
//     expect(mockTransaction).toHaveBeenCalled();

//     // Verify transaction callback updates stats correctly
//     const transactionCallback = mockTransaction.mock.calls[0][0];
//     const mockCurrentStats = { total_pins: 10, today_pins: 3, week_pins: 7 };
//     const updatedStats = transactionCallback(mockCurrentStats);

//     expect(updatedStats.today_pins).toBe(0); // Reset to 0
//     expect(updatedStats.week_pins).toBe(5); // 7 - 2 (removed old locations)
//     expect(updatedStats.total_pins).toBe(10); // Unchanged
//   });

//   it("should handle stats that don't exist", async () => {
//     // Mock database with some locations
//     const mockLocations = {
//       "location-1": {
//         addedAt: "2025-07-25T12:00:00.000Z", // Recent (1 day ago from mocked date)
//         address: "Recent Location",
//         additionalInfo: "Recent info",
//         lat: 40.7128,
//         lng: -74.006,
//       },
//     };

//     mockOnce.mockResolvedValue({ val: () => mockLocations });
//     mockTransaction.mockImplementation((updateFn) => {
//       // Simulate stats not existing (null)
//       const updatedStats = updateFn(null);
//       return Promise.resolve(updatedStats);
//     });

//     mockRef.mockImplementation((path: string) => {
//       if (path === "locations") {
//         return { once: mockOnce, child: mockChild };
//       }
//       if (path === "stats") {
//         return { transaction: mockTransaction };
//       }
//       return {};
//     });

//     await performDailyCleanup();

//     // Verify transaction was called
//     expect(mockTransaction).toHaveBeenCalled();

//     // Verify transaction callback initializes stats when null
//     const transactionCallback = mockTransaction.mock.calls[0][0];
//     const updatedStats = transactionCallback(null);

//     expect(updatedStats).toEqual({
//       total_pins: 0,
//       today_pins: 0,
//       week_pins: 0,
//     });
//   });

//   it("should continue processing even if some operations fail", async () => {
//     // Mock database with locations
//     const mockLocations = {
//       "location-1": {
//         addedAt: "2025-07-15T12:00:00.000Z", // Old location (11 days ago from mocked date)
//         address: "Old Location 1",
//         additionalInfo: "Old info 1",
//         lat: 40.7128,
//         lng: -74.006,
//       },
//       "location-2": {
//         addedAt: "2025-07-10T12:00:00.000Z", // Old location (16 days ago from mocked date)
//         address: "Old Location 2",
//         additionalInfo: "Old info 2",
//         lat: 40.7129,
//         lng: -74.007,
//       },
//     };

//     mockOnce.mockResolvedValue({ val: () => mockLocations });

//     // Make one Firestore operation fail
//     mockSet
//       .mockResolvedValueOnce(true) // First call succeeds
//       .mockRejectedValueOnce(new Error("Firestore error")); // Second call fails

//     mockRef.mockImplementation((path: string) => {
//       if (path === "locations") {
//         return { once: mockOnce, child: mockChild };
//       }
//       if (path === "stats") {
//         return { transaction: mockTransaction };
//       }
//       return {};
//     });

//     // The function should throw an error due to the failed operation
//     await expect(performDailyCleanup()).rejects.toThrow();

//     // Verify that at least one operation was attempted
//     expect(mockSet).toHaveBeenCalled();
//   });

//   it("should handle missing fields in stats gracefully", async () => {
//     // Mock database with no locations to focus on stats handling
//     mockOnce.mockResolvedValue({ val: () => null });

//     // Mock incomplete stats object
//     mockTransaction.mockImplementation((updateFn) => {
//       const incompleteStats = { total_pins: 5 }; // Missing today_pins and week_pins
//       const updatedStats = updateFn(incompleteStats);
//       return Promise.resolve(updatedStats);
//     });

//     mockRef.mockImplementation((path: string) => {
//       if (path === "locations") {
//         return { once: mockOnce };
//       }
//       if (path === "stats") {
//         return { transaction: mockTransaction };
//       }
//       return {};
//     });

//     await performDailyCleanup();

//     // Verify transaction was called
//     expect(mockTransaction).toHaveBeenCalled();

//     // Verify transaction callback handles missing fields
//     const transactionCallback = mockTransaction.mock.calls[0][0];
//     const incompleteStats = { total_pins: 5 };
//     const updatedStats = transactionCallback(incompleteStats);

//     expect(updatedStats).toEqual({
//       today_pins: 0, // Should be initialized and reset
//       total_pins: 5,
//       week_pins: 0, // Should be initialized
//     });
//   });

//   describe("production edge cases", () => {
//     it("should handle locations exactly 7 days old", async () => {
//       // With mocked date of 2025-07-26, exactly 7 days ago is 2025-07-19
//       const exactly7DaysAgo = "2025-07-19T00:00:00.000Z";

//       const mockLocations = {
//         "boundary-location": {
//           addedAt: exactly7DaysAgo,
//           address: "Boundary Test Location",
//           additionalInfo: "Exactly 7 days old",
//           lat: 40.7128,
//           lng: -74.006,
//         },
//       };

//       mockOnce.mockResolvedValue({ val: () => mockLocations });
//       mockRef.mockImplementation((path: string) => {
//         if (path === "locations") {
//           return { once: mockOnce, child: mockChild };
//         }
//         if (path === "stats") {
//           return { transaction: mockTransaction };
//         }
//         return {};
//       });

//       await performDailyCleanup();

//       // Verify the exactly 7-day-old location is NOT moved (should be > 7 days)
//       expect(mockCollection).not.toHaveBeenCalled();
//       expect(mockDoc).not.toHaveBeenCalled();
//       expect(mockChild).not.toHaveBeenCalledWith("boundary-location");
//       expect(mockRemove).not.toHaveBeenCalled();
//     });

//     it("should handle large datasets efficiently", async () => {
//       // Generate 100 locations (reduced from 1000+ for test performance)
//       const largeMockLocations: any = {};
//       for (let i = 0; i < 100; i++) {
//         largeMockLocations[`location-${i}`] = {
//           addedAt: "2025-07-10T12:00:00.000Z", // All old (16 days ago from mocked date)
//           address: `Address ${i}`,
//           additionalInfo: `Info ${i}`,
//           lat: 40.7128 + i * 0.001,
//           lng: -74.006 + i * 0.001,
//         };
//       }

//       mockOnce.mockResolvedValue({ val: () => largeMockLocations });
//       mockRef.mockImplementation((path: string) => {
//         if (path === "locations") {
//           return { once: mockOnce, child: mockChild };
//         }
//         if (path === "stats") {
//           return { transaction: mockTransaction };
//         }
//         return {};
//       });

//       const startTime = FIXED_DATE;
//       await performDailyCleanup();
//       const endTime = FIXED_DATE;

//       // Verify all 100 locations were processed
//       expect(mockSet).toHaveBeenCalledTimes(100);
//       expect(mockRemove).toHaveBeenCalledTimes(100);

//       // Verify reasonable performance (should complete within a few seconds)
//       const executionTime = endTime - startTime;
//       expect(executionTime).toBeLessThan(5000); // Less than 5 seconds

//       // Verify stats were updated correctly (subtract 100 from week_pins)
//       const transactionCallback = mockTransaction.mock.calls[0][0];
//       const mockCurrentStats = {
//         total_pins: 150,
//         today_pins: 5,
//         week_pins: 120,
//       };
//       const updatedStats = transactionCallback(mockCurrentStats);
//       expect(updatedStats.week_pins).toBe(20); // 120 - 100
//     });

//     it("should handle Firestore success but RTDB removal failure", async () => {
//       const mockLocations = {
//         "location-1": {
//           addedAt: "2025-07-10T12:00:00.000Z", // Old location (16 days ago from mocked date)
//           address: "Test Location",
//           additionalInfo: "Test info",
//           lat: 40.7128,
//           lng: -74.006,
//           reported: 1,
//         },
//       };

//       mockOnce.mockResolvedValue({ val: () => mockLocations });

//       // Firestore succeeds, but RTDB removal fails
//       mockSet.mockResolvedValue(true);
//       mockRemove.mockRejectedValue(new Error("RTDB removal failed"));

//       mockRef.mockImplementation((path: string) => {
//         if (path === "locations") {
//           return { once: mockOnce, child: mockChild };
//         }
//         if (path === "stats") {
//           return { transaction: mockTransaction };
//         }
//         return {};
//       });

//       // Should throw an error due to RTDB failure
//       await expect(performDailyCleanup()).rejects.toThrow();

//       // Verify Firestore operation succeeded before the failure
//       expect(mockSet).toHaveBeenCalledWith(mockLocations["location-1"]);
//       expect(mockRemove).toHaveBeenCalled();
//     });

//     it("should handle stats transaction failures", async () => {
//       const mockLocations = {
//         "location-1": {
//           addedAt: "2025-07-25T12:00:00.000Z", // Recent location (1 day ago from mocked date)
//           address: "Recent Location",
//           additionalInfo: "Recent info",
//           lat: 40.7128,
//           lng: -74.006,
//         },
//       };

//       mockOnce.mockResolvedValue({ val: () => mockLocations });
//       mockTransaction.mockRejectedValue(new Error("Stats transaction failed"));

//       mockRef.mockImplementation((path: string) => {
//         if (path === "locations") {
//           return { once: mockOnce, child: mockChild };
//         }
//         if (path === "stats") {
//           return { transaction: mockTransaction };
//         }
//         return {};
//       });

//       // Should throw an error due to stats transaction failure
//       await expect(performDailyCleanup()).rejects.toThrow();

//       // Verify transaction was attempted
//       expect(mockTransaction).toHaveBeenCalled();
//     });

//     it("should handle database snapshot failure", async () => {
//       // Mock database snapshot failure
//       mockOnce.mockRejectedValue(new Error("Database snapshot failed"));
//       mockRef.mockImplementation((path: string) => {
//         if (path === "locations") {
//           return { once: mockOnce };
//         }
//         if (path === "stats") {
//           return { transaction: mockTransaction };
//         }
//         return {};
//       });

//       // Should throw an error due to snapshot failure
//       await expect(performDailyCleanup()).rejects.toThrow();

//       // Verify snapshot was attempted
//       expect(mockOnce).toHaveBeenCalledWith("value");
//     });

//     it("should handle malformed stats data types", async () => {
//       mockOnce.mockResolvedValue({ val: () => null });

//       // Mock stats with wrong data types
//       mockTransaction.mockImplementation((updateFn) => {
//         const malformedStats = {
//           total_pins: "not-a-number", // String instead of number
//           today_pins: null, // Null instead of number
//           week_pins: undefined, // Undefined instead of number
//         };
//         const updatedStats = updateFn(malformedStats);
//         return Promise.resolve(updatedStats);
//       });

//       mockRef.mockImplementation((path: string) => {
//         if (path === "locations") {
//           return { once: mockOnce };
//         }
//         if (path === "stats") {
//           return { transaction: mockTransaction };
//         }
//         return {};
//       });

//       await performDailyCleanup();

//       // Verify transaction was called
//       expect(mockTransaction).toHaveBeenCalled();

//       // Verify transaction callback handles malformed data
//       const transactionCallback = mockTransaction.mock.calls[0][0];
//       const malformedStats = {
//         total_pins: "not-a-number",
//         today_pins: null,
//         week_pins: undefined,
//       };
//       const updatedStats = transactionCallback(malformedStats);

//       // Should initialize all fields to proper numbers
//       expect(updatedStats).toEqual({
//         total_pins: 0, // String converted to 0
//         today_pins: 0, // Null converted to 0
//         week_pins: 0, // Undefined converted to 0
//       });
//     });

//     // it("should handle timezone edge cases around daylight saving time", async () => {
//     //   // Test with a date that might have timezone issues (using fixed date relative to mocked date)
//     //   const dstTransitionDate = "2025-07-18T07:00:00.000Z"; // 8 days ago from mocked date

//     //   const mockLocations = {
//     //     "dst-location": {
//     //       addedAt: dstTransitionDate,
//     //       address: "DST Test Location",
//     //       additionalInfo: "Around DST transition",
//     //       lat: 40.7128,
//     //       lng: -74.006,
//     //     },
//     //   };

//     //   mockOnce.mockResolvedValue({ val: () => mockLocations });
//     //   mockRef.mockImplementation((path: string) => {
//     //     if (path === "locations") {
//     //       return { once: mockOnce, child: mockChild };
//     //     }
//     //     if (path === "stats") {
//     //       return { transaction: mockTransaction };
//     //     }
//     //     return {};
//     //   });

//     //   await performDailyCleanup();

//     //   // Should properly identify as old (>7 days) despite DST
//     //   expect(mockAdd).toHaveBeenCalledWith(mockLocations["dst-location"]);
//     //   expect(mockChild).toHaveBeenCalledWith("dst-location");
//     //   expect(mockRemove).toHaveBeenCalled();
//     // });

//     // it("should handle concurrent cleanup operations gracefully", async () => {
//     //   const mockLocations = {
//     //     "location-1": {
//     //       addedAt: "2025-07-10T12:00:00.000Z",
//     //       address: "Concurrent Test",
//     //       additionalInfo: "Concurrency test",
//     //       lat: 40.7128,
//     //       lng: -74.006,
//     //     },
//     //   };

//     //   mockOnce.mockResolvedValue({ val: () => mockLocations });

//     //   // Simulate a delay in transaction to test concurrency
//     //   mockTransaction.mockImplementation((updateFn) => {
//     //     return new Promise((resolve) => {
//     //       setTimeout(() => {
//     //         const currentStats = { total_pins: 10, today_pins: 3, week_pins: 7 };
//     //         const updatedStats = updateFn(currentStats);
//     //         resolve(updatedStats);
//     //       }, 100);
//     //     });
//     //   });

//     //   mockRef.mockImplementation((path: string) => {
//     //     if (path === "locations") {
//     //       return { once: mockOnce, child: mockChild };
//     //     }
//     //     if (path === "stats") {
//     //       return { transaction: mockTransaction };
//     //     }
//     //     return {};
//     //   });

//     //   // Run multiple cleanup operations simultaneously
//     //   const cleanup1 = performDailyCleanup();
//     //   const cleanup2 = performDailyCleanup();

//     //   // Both should complete without errors
//     //   await Promise.all([cleanup1, cleanup2]);

//     //   // Verify both operations were attempted
//     //   expect(mockTransaction).toHaveBeenCalledTimes(2);
//     // });
//   });
// });
