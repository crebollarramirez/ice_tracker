import { migrateRealtimeDatabase } from "../../migrations";

// Mock Firebase Admin SDK before importing the migration module
jest.mock("firebase-admin", () => {
  const mockSet = jest.fn().mockResolvedValue(true);
  const mockUpdate = jest.fn().mockResolvedValue(true);
  const mockRemove = jest.fn().mockResolvedValue(true);
  const mockOnce = jest.fn();

  const mockRef = jest.fn((path: string) => ({
    once: mockOnce,
    set: mockSet,
    update: mockUpdate,
    remove: mockRemove,
  }));

  const mockDatabase = jest.fn(() => ({
    ref: mockRef,
  }));

  const mockApp = {
    delete: jest.fn().mockResolvedValue(true),
  };

  return {
    initializeApp: jest.fn().mockReturnValue(mockApp),
    database: mockDatabase,
    app: jest.fn().mockReturnValue(mockApp),
  };
});

// Mock dotenv
jest.mock("dotenv", () => ({
  config: jest.fn(),
}));

// Mock console methods to reduce noise in tests
const originalConsole = console;
beforeEach(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    warn: jest.fn(),
    error: originalConsole.error, // Keep error for debugging
  } as any;
});

afterEach(() => {
  global.console = originalConsole;
  jest.clearAllMocks();
});

describe("migrateRealtimeDatabase Integration Tests", () => {
  let mockAdmin: any;
  let mockDatabase: any;
  let mockRef: any;
  let mockOnce: any;
  let mockRealtimeDb: any;

  beforeEach(() => {
    // Get the mocked admin module
    mockAdmin = require("firebase-admin");
    mockDatabase = mockAdmin.database();
    mockRef = mockDatabase.ref;
    mockOnce = mockRef().once;

    // Create a mock realtimeDb instance to pass to the function
    mockRealtimeDb = {
      ref: mockRef,
    };
  });

  it("should successfully migrate RTDB data with duplicates and consolidate them", async () => {
    // Mock data with duplicates (exact same address)
    const mockRtdbData = {
      "random-key-1": {
        addedAt: "2025-09-16T10:00:00.000Z",
        additionalInfo: "Ice on sidewalk",
        address: "123 Main St",
        lat: 40.7128,
        lng: -74.006,
      },
      "random-key-2": {
        addedAt: "2025-09-16T11:00:00.000Z",
        additionalInfo: "Slippery area",
        address: "123 Main St", // Exact duplicate
        lat: 40.7128,
        lng: -74.006,
      },
      "random-key-3": {
        addedAt: "2025-09-16T12:00:00.000Z",
        additionalInfo: "Icy patch",
        address: "456 Oak Avenue",
        lat: 40.7589,
        lng: -73.9851,
      },
      "random-key-4": {
        addedAt: "2025-09-16T13:00:00.000Z",
        additionalInfo: "Frozen puddle",
        address: "456 Oak Avenue", // Exact duplicate
        lat: 40.7589,
        lng: -73.9851,
      },
    };

    // Mock the database response
    mockOnce.mockResolvedValueOnce({
      val: () => mockRtdbData,
    });

    // Import and execute the migration function

    // Execute the migration
    await migrateRealtimeDatabase(mockRealtimeDb);

    // Verify that the database was queried
    expect(mockRef).toHaveBeenCalledWith("locations");
    expect(mockOnce).toHaveBeenCalledWith("value");

    // Verify that old data was removed
    expect(mockRef().remove).toHaveBeenCalled();

    // Verify that new consolidated data was written
    expect(mockRef().update).toHaveBeenCalled();

    // Get the data that was written
    const updateCall = (mockRef().update as jest.MockedFunction<any>).mock
      .calls[0][0];

    // Verify the structure of the consolidated data
    expect(Object.keys(updateCall)).toHaveLength(2); // Should have 2 unique addresses

    // Verify the first consolidated address (123 Main St exact duplicates)
    expect(updateCall["123_main_st"]).toBeDefined();
    expect(updateCall["123_main_st"].address).toBe("123 Main St");
    expect(updateCall["123_main_st"].reported).toBe(2); // Two reports for this address
    expect(updateCall["123_main_st"].lat).toBe(40.7128);
    expect(updateCall["123_main_st"].lng).toBe(-74.006);

    // Verify the second consolidated address (456 Oak Avenue exact duplicates)
    expect(updateCall["456_oak_avenue"]).toBeDefined();
    expect(updateCall["456_oak_avenue"].address).toBe("456 Oak Avenue");
    expect(updateCall["456_oak_avenue"].reported).toBe(2); // Two reports for this address
    expect(updateCall["456_oak_avenue"].lat).toBe(40.7589);
    expect(updateCall["456_oak_avenue"].lng).toBe(-73.9851);
  });

  it("should handle empty database gracefully", async () => {
    // Mock empty database response
    mockOnce.mockResolvedValueOnce({
      val: () => null,
    });

    // Import and execute the migration function
    const { migrateRealtimeDatabase } = await import("../../migrations");

    // Execute the migration
    await migrateRealtimeDatabase(mockRealtimeDb);

    // Verify that the database was queried
    expect(mockRef).toHaveBeenCalledWith("locations");
    expect(mockOnce).toHaveBeenCalledWith("value");

    // Verify that no update operations were performed for empty data
    expect(mockRef().remove).not.toHaveBeenCalled();
    expect(mockRef().update).not.toHaveBeenCalled();
  });

  it("should handle database errors gracefully", async () => {
    // Mock database error
    const dbError = new Error("Database connection failed");
    mockOnce.mockRejectedValueOnce(dbError);

    // Import and execute the migration function
    const { migrateRealtimeDatabase } = await import("../../migrations");

    // Execute the migration and expect it to throw
    await expect(migrateRealtimeDatabase(mockRealtimeDb)).rejects.toThrow(
      "Database connection failed"
    );

    // Verify that the database was queried
    expect(mockRef).toHaveBeenCalledWith("locations");
    expect(mockOnce).toHaveBeenCalledWith("value");
  });

  it("should create proper address keys using makeAddressKey function", async () => {
    // Mock data with various address formats
    const mockRtdbData = {
      "key-1": {
        addedAt: "2025-09-16T10:00:00.000Z",
        additionalInfo: "Test",
        address: "Main St & Oak Ave", // Special characters
        lat: 40.7128,
        lng: -74.006,
      },
      "key-2": {
        addedAt: "2025-09-16T11:00:00.000Z",
        additionalInfo: "Test",
        address: "  123  Main  Street  ", // Extra spaces
        lat: 40.7589,
        lng: -73.9851,
      },
      "key-3": {
        addedAt: "2025-09-16T12:00:00.000Z",
        additionalInfo: "Test",
        address: "Pine-Road-North", // Hyphens
        lat: 40.7831,
        lng: -73.9712,
      },
    };

    // Mock the database response
    mockOnce.mockResolvedValueOnce({
      val: () => mockRtdbData,
    });

    // Import and execute the migration function
    const { migrateRealtimeDatabase } = await import("../../migrations");

    // Execute the migration
    await migrateRealtimeDatabase(mockRealtimeDb);

    // Get the data that was written
    const updateCall = (mockRef().update as jest.MockedFunction<any>).mock
      .calls[0][0];

    // Verify the keys were properly formatted
    const expectedKeys = [
      "main_st_oak_ave", // Special chars removed, spaces to underscores
      "123_main_street", // Extra spaces normalized
      "pine_road_north", // Hyphens converted to underscores
    ];

    expectedKeys.forEach((key) => {
      expect(updateCall[key]).toBeDefined();
      expect(updateCall[key].reported).toBe(1);
    });
  });

  it("should consolidate duplicate addresses with different formatting using makeAddressKey", async () => {
    // Mock data with same address in different formats that should consolidate
    const mockRtdbData = {
      "key-1": {
        addedAt: "2025-09-16T10:00:00.000Z",
        additionalInfo: "Ice reported here",
        address: "123 Main Street",
        lat: 40.7128,
        lng: -74.006,
      },
      "key-2": {
        addedAt: "2025-09-16T11:00:00.000Z",
        additionalInfo: "Slippery sidewalk",
        address: "123 Main Street",
        lat: 40.7128,
        lng: -74.006,
      },
      "key-3": {
        addedAt: "2025-09-16T12:00:00.000Z",
        additionalInfo: "Icy conditions",
        address: "123 Main Street", 
        lat: 40.7128,
        lng: -74.006,
      },
      "key-4": {
        addedAt: "2025-09-16T13:00:00.000Z",
        additionalInfo: "Different location",
        address: "456 Oak Avenue", // Completely different address
        lat: 40.7589,
        lng: -73.9851,
      },
      "key-5": {
        addedAt: "2025-09-16T14:00:00.000Z",
        additionalInfo: "Another report",
        address: "456 Oak Avenue", // Same address with extra spaces
        lat: 40.7589,
        lng: -73.9851,
      },
    };

    // Mock the database response
    mockOnce.mockResolvedValueOnce({
      val: () => mockRtdbData,
    });

    // Import and execute the migration function
    const { migrateRealtimeDatabase } = await import("../../migrations");

    // Execute the migration
    await migrateRealtimeDatabase(mockRealtimeDb);

    // Get the data that was written
    const updateCall = (mockRef().update as jest.MockedFunction<any>).mock
      .calls[0][0];

    // Should have only 2 unique addresses after consolidation
    expect(Object.keys(updateCall)).toHaveLength(2);

    // Verify the first consolidated address (123 Main Street variations)
    expect(updateCall["123_main_street"]).toBeDefined();
    expect(updateCall["123_main_street"].address).toBe("123 Main Street"); // Should use the first occurrence
    expect(updateCall["123_main_street"].reported).toBe(3); // Three variations consolidated
    expect(updateCall["123_main_street"].lat).toBe(40.7128);
    expect(updateCall["123_main_street"].lng).toBe(-74.006);

    // Verify the second consolidated address (456 Oak Avenue variations)
    expect(updateCall["456_oak_avenue"]).toBeDefined();
    expect(updateCall["456_oak_avenue"].address).toBe("456 Oak Avenue"); // Should use the first occurrence
    expect(updateCall["456_oak_avenue"].reported).toBe(2); // Two variations consolidated
    expect(updateCall["456_oak_avenue"].lat).toBe(40.7589);
    expect(updateCall["456_oak_avenue"].lng).toBe(-73.9851);

    // Verify that the expected keys exist and no others
    const expectedKeys = ["123_main_street", "456_oak_avenue"];
    expectedKeys.forEach((key) => {
      expect(updateCall[key]).toBeDefined();
    });
  });

  it("should keep the most recent duplicate address based on addedAt date", async () => {
    // Mock data with duplicate addresses where most recent should be kept
    const mockRtdbData = {
      "key-1": {
        addedAt: "2025-09-16T10:00:00.000Z", // Oldest
        additionalInfo: "First report - should be overwritten",
        address: "789 Pine Street",
        lat: 40.7,
        lng: -74.0,
      },
      "key-2": {
        addedAt: "2025-09-16T15:30:00.000Z", // Most recent - should be kept
        additionalInfo: "Latest report - should be kept",
        address: "789 Pine Street", // Same address
        lat: 40.7001, // Slightly different coordinates
        lng: -74.0001,
      },
      "key-3": {
        addedAt: "2025-09-16T12:15:00.000Z", // Middle date
        additionalInfo: "Middle report - should be overwritten",
        address: "789 Pine Street", // Same address
        lat: 40.7002,
        lng: -74.0002,
      },
      "key-4": {
        addedAt: "2025-09-16T08:00:00.000Z", // Different address, should be preserved
        additionalInfo: "Different location",
        address: "321 Elm Drive",
        lat: 40.8,
        lng: -74.1,
      },
      "key-5": {
        addedAt: "2025-09-16T14:00:00.000Z", // Another duplicate of Pine Street, but older than key-2
        additionalInfo: "Another report - should be overwritten",
        address: "789 Pine Street",
        lat: 40.7003,
        lng: -74.0003,
      },
    };

    // Mock the database response
    mockOnce.mockResolvedValueOnce({
      val: () => mockRtdbData,
    });

    // Import and execute the migration function
    const { migrateRealtimeDatabase } = await import("../../migrations");

    // Execute the migration
    await migrateRealtimeDatabase(mockRealtimeDb);

    // Get the data that was written
    const updateCall = (mockRef().update as jest.MockedFunction<any>).mock
      .calls[0][0];

    // Should have only 2 unique addresses after consolidation
    expect(Object.keys(updateCall)).toHaveLength(2);

    // Verify the Pine Street address kept the most recent data
    expect(updateCall["789_pine_street"]).toBeDefined();
    expect(updateCall["789_pine_street"].address).toBe("789 Pine Street");
    expect(updateCall["789_pine_street"].reported).toBe(4); // Four reports for this address
    expect(updateCall["789_pine_street"].addedAt).toBe(
      "2025-09-16T15:30:00.000Z"
    ); // Most recent date
    expect(updateCall["789_pine_street"].additionalInfo).toBe(
      "Latest report - should be kept"
    ); // Most recent info
    expect(updateCall["789_pine_street"].lat).toBe(40.7001); // Most recent coordinates
    expect(updateCall["789_pine_street"].lng).toBe(-74.0001);

    // Verify the Elm Drive address is preserved (no duplicates)
    expect(updateCall["321_elm_drive"]).toBeDefined();
    expect(updateCall["321_elm_drive"].address).toBe("321 Elm Drive");
    expect(updateCall["321_elm_drive"].reported).toBe(1); // Only one report for this address
    expect(updateCall["321_elm_drive"].addedAt).toBe(
      "2025-09-16T08:00:00.000Z"
    );
    expect(updateCall["321_elm_drive"].additionalInfo).toBe(
      "Different location"
    );
    expect(updateCall["321_elm_drive"].lat).toBe(40.8);
    expect(updateCall["321_elm_drive"].lng).toBe(-74.1);
  });
});
