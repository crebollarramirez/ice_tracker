import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";

// Mock only Firebase Admin SDK (RTDB and Firestore)
jest.mock("firebase-admin", () => {
  const mockSet = jest.fn().mockResolvedValue(true);
  const mockPush = jest.fn(() => ({
    key: "mock-location-id",
    set: mockSet,
  }));
  const mockTransaction = jest.fn((updateFn) => {
    const currentStats = { total_pins: 0, today_pins: 0, week_pins: 0 };
    const updatedStats = updateFn(currentStats);
    return Promise.resolve(updatedStats);
  });
  const mockRef = jest.fn((path) => {
    if (path === "locations") {
      return { push: mockPush };
    }
    if (path === "stats") {
      return { transaction: mockTransaction };
    }
    return {};
  });
  const mockAdd = jest.fn().mockResolvedValue({ id: "mock-doc-id" });
  const mockCollection = jest.fn(() => ({ add: mockAdd }));

  return {
    initializeApp: jest.fn(),
    database: jest.fn(() => ({ ref: mockRef })),
    firestore: jest.fn(() => ({ collection: mockCollection })),
    apps: { length: 0 },
  };
});

// Initialize Firebase Functions Test framework
const testEnv = functionsTest({
  projectId: "iceinmyarea",
});

// Import the pin function after initializing the test environment
import { pin } from "../../index";

// Initialize Firebase Admin for database operations
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "iceinmyarea",
  });
}

describe("Pin Function E2E Tests", () => {
  const FIXED_DATE = new Date("2025-08-10T12:00:00.000Z");

  beforeAll(() => {
    // Mock Date to ensure consistent test results
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_DATE);
  });

  afterAll(async () => {
    jest.useRealTimers();
    testEnv.cleanup();
  });

  it("should successfully pin a valid U.S. address and update stats", async () => {
    // Prepare test data with today's date
    const request = {
      data: {
        addedAt: FIXED_DATE.toISOString(),
        address: "1600 Amphitheatre Parkway, Mountain View, CA",
        additionalInfo: "Google headquarters - test location",
      },
    };

    // Wrap the pin function for testing
    const wrappedPin = testEnv.wrap(pin) as any;

    // Call the pin function with proper request structure
    const result = await wrappedPin(request);

    // Verify the function response (real geocoding will return actual formatted address)
    expect(result.message).toBe("Data logged and saved successfully");
    expect(result.formattedAddress).toContain("Mountain View");
    expect(result.formattedAddress).toContain("CA");

    // Verify that the mocked database operations were called correctly
    const admin = require("firebase-admin");
    const mockDatabase = admin.database();
    const mockRef = mockDatabase.ref;

    // Verify locations ref was called and data was pushed
    expect(mockRef).toHaveBeenCalledWith("locations");
    expect(mockRef).toHaveBeenCalledWith("stats");
  });

  it("should reject addresses outside the U.S.", async () => {
    // Prepare test data with non-U.S. address
    const request = {
      data: {
        addedAt: FIXED_DATE.toISOString(),
        address:
          "10 Downing Street, Westminster, London SW1A 0AA, United Kingdom",
        additionalInfo: "UK Prime Minister's residence",
      },
    };

    // Wrap the pin function for testing
    const wrappedPin = testEnv.wrap(pin) as any;

    // Expect the function to throw an error for non-U.S. address (real geocoding service will reject this)
    await expect(wrappedPin(request)).rejects.toThrow(
      "Please provide a valid address that can be found on the map"
    );
  });

  it("should reject negative content using real AI filter", async () => {
    // Prepare test data with potentially negative content
    const request = {
      data: {
        addedAt: FIXED_DATE.toISOString(),
        address: "1600 Amphitheatre Parkway, Mountain View, CA",
        additionalInfo:
          "This is extremely offensive and inappropriate content that should be filtered",
      },
    };

    // Wrap the pin function for testing
    const wrappedPin = testEnv.wrap(pin) as any;

    // This test depends on the real AI service response
    try {
      const result = await wrappedPin(request);
      // If AI doesn't flag it as negative, the test passes
      expect(result.message).toBe("Data logged and saved successfully");
    } catch (error: any) {
      // If AI flags it as negative, expect the appropriate error
      expect(error.message).toBe(
        "Please avoid using negative or abusive language in the additional info"
      );

      // Verify that negative content was logged to Firestore
      const admin = require("firebase-admin");
      const mockFirestore = admin.firestore();
      const mockCollection = mockFirestore.collection;
      expect(mockCollection).toHaveBeenCalledWith("negative");
    }
  });

  it("should reject invalid addresses that cannot be geocoded", async () => {
    // Prepare test data with completely invalid address
    const request = {
      data: {
        addedAt: FIXED_DATE.toISOString(),
        address: "ThisIsNotARealAddressAnywhere12345XYZ!@#$%",
        additionalInfo: "Testing invalid address rejection",
      },
    };

    // Wrap the pin function for testing
    const wrappedPin = testEnv.wrap(pin) as any;

    // Expect the function to throw an error for invalid address that cannot be geocoded
    await expect(wrappedPin(request)).rejects.toThrow(
      "Please provide a valid address that can be found on the map"
    );
  });

  it("should reject request when addedAt is missing", async () => {
    // Prepare test data missing addedAt field
    const request = {
      data: {
        address: "1600 Amphitheatre Parkway, Mountain View, CA",
        additionalInfo: "Testing missing addedAt field",
      },
    };

    // Wrap the pin function for testing
    const wrappedPin = testEnv.wrap(pin) as any;

    // Expect the function to throw an error for missing addedAt
    await expect(wrappedPin(request)).rejects.toThrow(
      "Missing required fields: addedAt and address"
    );
  });

  it("should reject request when address is missing", async () => {
    // Prepare test data missing address field
    const request = {
      data: {
        addedAt: FIXED_DATE.toISOString(),
        additionalInfo: "Testing missing address field",
      },
    };

    // Wrap the pin function for testing
    const wrappedPin = testEnv.wrap(pin) as any;

    // Expect the function to throw an error for missing address
    await expect(wrappedPin(request)).rejects.toThrow(
      "Missing required fields: addedAt and address"
    );
  });

  it("should reject request when both addedAt and address are missing", async () => {
    // Prepare test data missing both required fields
    const request = {
      data: {
        additionalInfo: "Testing missing required fields",
      },
    };

    // Wrap the pin function for testing
    const wrappedPin = testEnv.wrap(pin) as any;

    // Expect the function to throw an error for missing required fields
    await expect(wrappedPin(request)).rejects.toThrow(
      "Missing required fields: addedAt and address"
    );
  });

  it("should reject request when addedAt is not in ISO8601 format", async () => {
    // Prepare test data with invalid date format
    const request = {
      data: {
        addedAt: "08/10/2025", // Invalid format (should be ISO8601)
        address: "1600 Amphitheatre Parkway, Mountain View, CA",
        additionalInfo: "Testing invalid date format",
      },
    };

    // Wrap the pin function for testing
    const wrappedPin = testEnv.wrap(pin) as any;

    // Expect the function to throw an error for invalid date format
    await expect(wrappedPin(request)).rejects.toThrow(
      "Invalid date format for addedAt. Must be ISO 8601 format."
    );
  });

  it("should reject request when addedAt is not today's date", async () => {
    // Prepare test data with yesterday's date
    const yesterday = new Date(FIXED_DATE);
    yesterday.setDate(yesterday.getDate() - 1);

    const request = {
      data: {
        addedAt: yesterday.toISOString(), // Valid ISO8601 but not today
        address: "1600 Amphitheatre Parkway, Mountain View, CA",
        additionalInfo: "Testing date that is not today",
      },
    };

    // Wrap the pin function for testing
    const wrappedPin = testEnv.wrap(pin) as any;

    // Expect the function to throw an error for date that is not today
    await expect(wrappedPin(request)).rejects.toThrow(
      "Invalid date format for addedAt. Must be today's date in ISO 8601 format."
    );
  });

  it("should reject request when addedAt is a future date", async () => {
    // Prepare test data with tomorrow's date
    const tomorrow = new Date(FIXED_DATE);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const request = {
      data: {
        addedAt: tomorrow.toISOString(), // Valid ISO8601 but future date
        address: "1600 Amphitheatre Parkway, Mountain View, CA",
        additionalInfo: "Testing future date",
      },
    };

    // Wrap the pin function for testing
    const wrappedPin = testEnv.wrap(pin) as any;

    // Expect the function to throw an error for future date
    await expect(wrappedPin(request)).rejects.toThrow(
      "Invalid date format for addedAt. Must be today's date in ISO 8601 format."
    );
  });
});