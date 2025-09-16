// Mock Firebase Admin SDK before importing the migration module
jest.mock("firebase-admin", () => {
  const batchSetCalls: Array<[any, any]> = [];
  const batchDeleteCalls: Array<any> = [];

  const mockBatchSet = jest.fn((docRef: any, data: any) => {
    batchSetCalls.push([docRef, data]);
  });

  const mockBatchDelete = jest.fn((docRef: any) => {
    batchDeleteCalls.push(docRef);
  });

  const mockCommit = jest.fn().mockResolvedValue(true);
  const mockGet = jest.fn();

  const mockDoc = jest.fn((docId: string) => ({
    id: docId,
    _path: { segments: ["old-pins", docId] },
  }));

  const mockBatch = jest.fn(() => ({
    set: mockBatchSet,
    delete: mockBatchDelete,
    commit: mockCommit,
    _setCalls: batchSetCalls,
    _deleteCalls: batchDeleteCalls,
  }));

  const mockCollection = jest.fn((collectionName: string) => ({
    get: mockGet,
    doc: mockDoc,
  }));

  const mockFirestore = jest.fn(() => ({
    collection: mockCollection,
    batch: mockBatch,
  }));

  const mockApp = {
    delete: jest.fn().mockResolvedValue(true),
  };

  return {
    initializeApp: jest.fn().mockReturnValue(mockApp),
    firestore: mockFirestore,
    app: jest.fn().mockReturnValue(mockApp),
  };
});

// Mock dotenv
jest.mock("dotenv", () => ({
  config: jest.fn(),
}));

// Mock console methods to reduce noise in tests
beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  // Keep console.error for debugging
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("migrateFirestore Integration Tests", () => {
  let mockAdmin: any;
  let mockFirestore: any;
  let mockCollection: any;
  let mockGet: any;
  let mockBatch: any;
  let mockCommit: any;
  let batchInstance: any;

  beforeEach(() => {
    // Get the mocked admin module
    mockAdmin = require("firebase-admin");
    mockFirestore = mockAdmin.firestore();
    mockCollection = mockFirestore.collection;
    mockGet = mockCollection().get;
    mockBatch = mockFirestore.batch;
    batchInstance = mockBatch();
    mockCommit = batchInstance.commit;

    // Clear batch calls before each test
    batchInstance._setCalls.length = 0;
    batchInstance._deleteCalls.length = 0;
  });

  it("should successfully migrate Firestore data with duplicates and consolidate them", async () => {
    // Mock data with duplicates (exact same address)
    const mockFirestoreData = [
      {
        id: "doc-1",
        data: () => ({
          addedAt: "2025-09-16T10:00:00.000Z",
          additionalInfo: "Ice on sidewalk",
          address: "123 Main St",
          lat: 40.7128,
          lng: -74.006,
        }),
      },
      {
        id: "doc-2",
        data: () => ({
          addedAt: "2025-09-16T11:00:00.000Z",
          additionalInfo: "Slippery area",
          address: "123 Main St", // Exact duplicate
          lat: 40.7128,
          lng: -74.006,
        }),
      },
      {
        id: "doc-3",
        data: () => ({
          addedAt: "2025-09-16T12:00:00.000Z",
          additionalInfo: "Icy patch",
          address: "456 Oak Avenue",
          lat: 40.7589,
          lng: -73.9851,
        }),
      },
      {
        id: "doc-4",
        data: () => ({
          addedAt: "2025-09-16T13:00:00.000Z",
          additionalInfo: "Frozen puddle",
          address: "456 Oak Avenue", // Exact duplicate
          lat: 40.7589,
          lng: -73.9851,
        }),
      },
    ];

    // Mock the Firestore response
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: mockFirestoreData,
    });

    // Import and execute the migration function
    const { migrateFirestore } = await import("../../migrations");

    // Execute the migration
    await migrateFirestore();

    // Verify that the collection was queried
    expect(mockCollection).toHaveBeenCalledWith("old-pins");
    expect(mockGet).toHaveBeenCalled();

    // Verify that batch operations were performed
    expect(mockBatch).toHaveBeenCalled();
    expect(mockCommit).toHaveBeenCalled();

    // Get the batch set calls to verify the consolidated data
    const setBatchCalls = batchInstance._setCalls;

    // Should have 2 unique addresses consolidated
    expect(setBatchCalls).toHaveLength(2);

    // Verify the data structure by examining the set calls
    const consolidatedData: { [key: string]: any } = {};
    setBatchCalls.forEach(([docRef, data]: [any, any]) => {
      // Extract the document ID from the set call
      const docId = docRef.id;
      consolidatedData[docId] = data;
    });

    // Verify the first consolidated address (123 Main St exact duplicates)
    expect(consolidatedData["123_main_st"]).toBeDefined();
    expect(consolidatedData["123_main_st"].address).toBe("123 Main St");
    expect(consolidatedData["123_main_st"].reported).toBe(2); // Two reports for this address
    expect(consolidatedData["123_main_st"].lat).toBe(40.7128);
    expect(consolidatedData["123_main_st"].lng).toBe(-74.006);

    // Verify the second consolidated address (456 Oak Avenue exact duplicates)
    expect(consolidatedData["456_oak_avenue"]).toBeDefined();
    expect(consolidatedData["456_oak_avenue"].address).toBe("456 Oak Avenue");
    expect(consolidatedData["456_oak_avenue"].reported).toBe(2); // Two reports for this address
    expect(consolidatedData["456_oak_avenue"].lat).toBe(40.7589);
    expect(consolidatedData["456_oak_avenue"].lng).toBe(-73.9851);
  });

  it("should handle empty collection gracefully", async () => {
    // Mock empty collection response
    mockGet.mockResolvedValueOnce({
      empty: true,
      docs: [],
    });

    // Import and execute the migration function
    const { migrateFirestore } = await import("../../migrations");

    // Execute the migration
    await migrateFirestore();

    // Verify that the collection was queried
    expect(mockCollection).toHaveBeenCalledWith("old-pins");
    expect(mockGet).toHaveBeenCalled();

    // Verify that no batch operations were performed for empty data
    expect(batchInstance._setCalls).toHaveLength(0);
    expect(batchInstance._deleteCalls).toHaveLength(0);
  });

  it("should handle Firestore errors gracefully", async () => {
    // Mock Firestore error
    const firestoreError = new Error("Firestore connection failed");
    mockGet.mockRejectedValueOnce(firestoreError);

    // Import and execute the migration function
    const { migrateFirestore } = await import("../../migrations");

    // Execute the migration and expect it to throw
    await expect(migrateFirestore()).rejects.toThrow(
      "Firestore connection failed"
    );

    // Verify that the collection was queried
    expect(mockCollection).toHaveBeenCalledWith("old-pins");
    expect(mockGet).toHaveBeenCalled();
  });

  it("should create proper address keys using makeAddressKey function", async () => {
    // Mock data with various address formats
    const mockFirestoreData = [
      {
        id: "doc-1",
        data: () => ({
          addedAt: "2025-09-16T10:00:00.000Z",
          additionalInfo: "Test",
          address: "Main St & Oak Ave", // Special characters
          lat: 40.7128,
          lng: -74.006,
        }),
      },
      {
        id: "doc-2",
        data: () => ({
          addedAt: "2025-09-16T11:00:00.000Z",
          additionalInfo: "Test",
          address: "  123  Main  Street  ", // Extra spaces
          lat: 40.7589,
          lng: -73.9851,
        }),
      },
      {
        id: "doc-3",
        data: () => ({
          addedAt: "2025-09-16T12:00:00.000Z",
          additionalInfo: "Test",
          address: "Pine-Road-North", // Hyphens
          lat: 40.7831,
          lng: -73.9712,
        }),
      },
    ];

    // Mock the Firestore response
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: mockFirestoreData,
    });

    // Import and execute the migration function
    const { migrateFirestore } = await import("../../migrations");

    // Execute the migration
    await migrateFirestore();

    // Get the batch set calls to verify the keys
    const setBatchCalls = batchInstance._setCalls;

    // Verify the keys were properly formatted
    const expectedKeys = [
      "main_st_oak_ave", // Special chars removed, spaces to underscores
      "123_main_street", // Extra spaces normalized
      "pine_road_north", // Hyphens converted to underscores
    ];

    const consolidatedData: { [key: string]: any } = {};
    setBatchCalls.forEach(([docRef, data]: [any, any]) => {
      const docId = docRef.id;
      consolidatedData[docId] = data;
    });

    expectedKeys.forEach((key) => {
      expect(consolidatedData[key]).toBeDefined();
      expect(consolidatedData[key].reported).toBe(1);
    });
  });

  it("should consolidate duplicate addresses with different formatting using makeAddressKey", async () => {
    // Mock data with same address in different formats that should consolidate
    const mockFirestoreData = [
      {
        id: "doc-1",
        data: () => ({
          addedAt: "2025-09-16T10:00:00.000Z",
          additionalInfo: "Ice reported here",
          address: "123 Main Street",
          lat: 40.7128,
          lng: -74.006,
        }),
      },
      {
        id: "doc-2",
        data: () => ({
          addedAt: "2025-09-16T11:00:00.000Z",
          additionalInfo: "Slippery sidewalk",
          address: "123 Main Street",
          lat: 40.7128,
          lng: -74.006,
        }),
      },
      {
        id: "doc-3",
        data: () => ({
          addedAt: "2025-09-16T12:00:00.000Z",
          additionalInfo: "Icy conditions",
          address: "123 Main Street",
          lat: 40.7128,
          lng: -74.006,
        }),
      },
      {
        id: "doc-4",
        data: () => ({
          addedAt: "2025-09-16T13:00:00.000Z",
          additionalInfo: "Different location",
          address: "456 Oak Avenue", // Completely different address
          lat: 40.7589,
          lng: -73.9851,
        }),
      },
      {
        id: "doc-5",
        data: () => ({
          addedAt: "2025-09-16T14:00:00.000Z",
          additionalInfo: "Another report",
          address: "456 Oak Avenue", // Same address
          lat: 40.7589,
          lng: -73.9851,
        }),
      },
    ];

    // Mock the Firestore response
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: mockFirestoreData,
    });

    // Import and execute the migration function
    const { migrateFirestore } = await import("../../migrations");

    // Execute the migration
    await migrateFirestore();

    // Get the batch set calls to verify the consolidated data
    const setBatchCalls = batchInstance._setCalls;

    // Should have only 2 unique addresses after consolidation
    expect(setBatchCalls).toHaveLength(2);

    const consolidatedData: { [key: string]: any } = {};
    setBatchCalls.forEach(([docRef, data]: [any, any]) => {
      const docId = docRef.id;
      consolidatedData[docId] = data;
    });

    // Verify the first consolidated address (123 Main Street variations)
    expect(consolidatedData["123_main_street"]).toBeDefined();
    expect(consolidatedData["123_main_street"].address).toBe("123 Main Street"); // Should use the first occurrence
    expect(consolidatedData["123_main_street"].reported).toBe(3); // Three variations consolidated
    expect(consolidatedData["123_main_street"].lat).toBe(40.7128);
    expect(consolidatedData["123_main_street"].lng).toBe(-74.006);

    // Verify the second consolidated address (456 Oak Avenue variations)
    expect(consolidatedData["456_oak_avenue"]).toBeDefined();
    expect(consolidatedData["456_oak_avenue"].address).toBe("456 Oak Avenue"); // Should use the first occurrence
    expect(consolidatedData["456_oak_avenue"].reported).toBe(2); // Two variations consolidated
    expect(consolidatedData["456_oak_avenue"].lat).toBe(40.7589);
    expect(consolidatedData["456_oak_avenue"].lng).toBe(-73.9851);

    // Verify that the expected keys exist and no others
    const expectedKeys = ["123_main_street", "456_oak_avenue"];
    expectedKeys.forEach((key) => {
      expect(consolidatedData[key]).toBeDefined();
    });
  });

  it("should keep the most recent duplicate address based on addedAt date", async () => {
    // Mock data with duplicate addresses where most recent should be kept
    const mockFirestoreData = [
      {
        id: "doc-1",
        data: () => ({
          addedAt: "2025-09-16T10:00:00.000Z", // Oldest
          additionalInfo: "First report - should be overwritten",
          address: "789 Pine Street",
          lat: 40.7,
          lng: -74.0,
        }),
      },
      {
        id: "doc-2",
        data: () => ({
          addedAt: "2025-09-16T15:30:00.000Z", // Most recent - should be kept
          additionalInfo: "Latest report - should be kept",
          address: "789 Pine Street", // Same address
          lat: 40.7001, // Slightly different coordinates
          lng: -74.0001,
        }),
      },
      {
        id: "doc-3",
        data: () => ({
          addedAt: "2025-09-16T12:15:00.000Z", // Middle date
          additionalInfo: "Middle report - should be overwritten",
          address: "789 Pine Street", // Same address
          lat: 40.7002,
          lng: -74.0002,
        }),
      },
      {
        id: "doc-4",
        data: () => ({
          addedAt: "2025-09-16T08:00:00.000Z", // Different address, should be preserved
          additionalInfo: "Different location",
          address: "321 Elm Drive",
          lat: 40.8,
          lng: -74.1,
        }),
      },
      {
        id: "doc-5",
        data: () => ({
          addedAt: "2025-09-16T14:00:00.000Z", // Another duplicate of Pine Street, but older than doc-2
          additionalInfo: "Another report - should be overwritten",
          address: "789 Pine Street",
          lat: 40.7003,
          lng: -74.0003,
        }),
      },
    ];

    // Mock the Firestore response
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: mockFirestoreData,
    });

    // Import and execute the migration function
    const { migrateFirestore } = await import("../../migrations");

    // Execute the migration
    await migrateFirestore();

    // Get the batch set calls to verify the consolidated data
    const setBatchCalls = batchInstance._setCalls;

    // Should have only 2 unique addresses after consolidation
    expect(setBatchCalls).toHaveLength(2);

    const consolidatedData: { [key: string]: any } = {};
    setBatchCalls.forEach(([docRef, data]: [any, any]) => {
      const docId = docRef.id;
      consolidatedData[docId] = data;
    });

    // Verify the Pine Street address kept the most recent data
    expect(consolidatedData["789_pine_street"]).toBeDefined();
    expect(consolidatedData["789_pine_street"].address).toBe("789 Pine Street");
    expect(consolidatedData["789_pine_street"].reported).toBe(4); // Four reports for this address
    expect(consolidatedData["789_pine_street"].addedAt).toBe(
      "2025-09-16T15:30:00.000Z"
    ); // Most recent date
    expect(consolidatedData["789_pine_street"].additionalInfo).toBe(
      "Latest report - should be kept"
    ); // Most recent info
    expect(consolidatedData["789_pine_street"].lat).toBe(40.7001); // Most recent coordinates
    expect(consolidatedData["789_pine_street"].lng).toBe(-74.0001);

    // Verify the Elm Drive address is preserved (no duplicates)
    expect(consolidatedData["321_elm_drive"]).toBeDefined();
    expect(consolidatedData["321_elm_drive"].address).toBe("321 Elm Drive");
    expect(consolidatedData["321_elm_drive"].reported).toBe(1); // Only one report for this address
    expect(consolidatedData["321_elm_drive"].addedAt).toBe(
      "2025-09-16T08:00:00.000Z"
    );
    expect(consolidatedData["321_elm_drive"].additionalInfo).toBe(
      "Different location"
    );
    expect(consolidatedData["321_elm_drive"].lat).toBe(40.8);
    expect(consolidatedData["321_elm_drive"].lng).toBe(-74.1);
  });
});
