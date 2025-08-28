import functionsTest from "firebase-functions-test";
import { pin } from "../../index";

// Mock the AI Filter Service
jest.mock("../../utils/aiFilter", () => {
  const mockIsNegative = jest.fn().mockResolvedValue(false);
  return {
    OpenAIService: jest.fn().mockImplementation(() => ({
      isNegative: mockIsNegative,
    })),
    __mockIsNegative: mockIsNegative, // Export for access in tests
  };
});

// Mock the Geocoding Service
jest.mock("../../utils/geocodingService", () => {
  const mockGeocodeAddress = jest.fn().mockResolvedValue({
    formattedAddress: "123 Main St, New York, NY",
    lat: 40.7128,
    lng: -74.006,
  });
  return {
    GoogleGeocodingService: jest.fn().mockImplementation(() => ({
      geocodeAddress: mockGeocodeAddress,
    })),
    __mockGeocodeAddress: mockGeocodeAddress, // Export for access in tests
  };
});

// Mock Firebase Admin SDK
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
  };
});

const testEnv = functionsTest({ projectId: "iceinmyarea" });
const wrappedPin = testEnv.wrap(pin) as (
  req: any,
  context?: any
) => Promise<any>;

describe("pin – integration", () => {
  const FIXED_DATE = new Date("2025-07-26T00:00:00.000Z").getTime();

  beforeEach(() => {
    // Mock Date to ensure consistent test results
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_DATE);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => testEnv.cleanup());

  it("writes to RTDB & returns formatted address", async () => {
    // Wrap the data in the expected structure
    const request = {
      data: {
        addedAt: "2025-07-26T00:00:00.000Z", // Must match mocked date
        address: "123 Main St",
        additionalInfo: "Nice",
      },
    };

    const context = { auth: { uid: "test-user-id" } };

    // Pass the request object to the wrapped function
    const res = await wrappedPin(request, context);

    expect(res).toEqual({
      message: "Data logged and saved successfully",
      formattedAddress: "123 Main St, New York, NY",
    });
  });

  it("should reject negative content and log to Firestore", async () => {
    // Get the mock function that was exported
    const { __mockIsNegative } = require("../../utils/aiFilter");

    // Configure the AI Filter to return true (negative content detected)
    __mockIsNegative.mockResolvedValueOnce(true);

    const request = {
      data: {
        addedAt: "2025-07-26T00:00:00.000Z", // Must match mocked date
        address: "123 Main St",
        additionalInfo: "This is offensive content",
      },
    };

    const context = { auth: { uid: "test-user-id" } };

    // Expect the function to throw an HttpsError
    await expect(wrappedPin(request, context)).rejects.toThrow(
      "Please avoid using negative or abusive language in the additional info"
    );

    // Verify that the negative content was attempted to be logged to Firestore
    // We can access the mocked Firestore functions to verify they were called
    const mockFirestore = require("firebase-admin").firestore();
    const mockCollection = mockFirestore.collection;
    expect(mockCollection).toHaveBeenCalledWith("negative");

    // Reset the mock back to default for other tests
    __mockIsNegative.mockResolvedValue(false);
  });

  it("should reject invalid addresses", async () => {
    // Get the geocoding mock function that was exported
    const { __mockGeocodeAddress } = require("../../utils/geocodingService");

    // Configure the geocoding service to return null (address not found)
    __mockGeocodeAddress.mockResolvedValueOnce(null);

    const request = {
      data: {
        addedAt: "2025-07-26T00:00:00.000Z", // Must match mocked date
        address: "Invalid Address That Cannot Be Found",
        additionalInfo: "Nice place",
      },
    };

    const context = { auth: { uid: "test-user-id" } };

    // Expect the function to throw an HttpsError for address not found
    await expect(wrappedPin(request, context)).rejects.toThrow(
      "Please provide a valid address that can be found on the map"
    );

    // Reset the mock back to default for other tests
    __mockGeocodeAddress.mockResolvedValue({
      formattedAddress: "123 Main St, New York, NY",
      lat: 40.7128,
      lng: -74.006,
    });
  });

  it("should reject requests with missing required fields", async () => {
    const request = {
      data: {
        // Missing addedAt field
        address: "123 Main St",
        additionalInfo: "Nice place",
      },
    };

    const context = { auth: { uid: "test-user-id" } };

    // Expect the function to throw an HttpsError for missing required fields
    await expect(wrappedPin(request, context)).rejects.toThrow(
      "Missing required fields: addedAt and address"
    );
  });

  it("should increment stats in RTDB when a pin is added", async () => {
    // Get access to the mocked Firebase Admin SDK functions
    const admin = require("firebase-admin");
    const mockDatabase = admin.database();
    const mockRef = mockDatabase.ref;
    const mockTransaction = jest.fn((updateFn) => {
      const currentStats = { total_pins: 5, today_pins: 2, week_pins: 4 };
      const updatedStats = updateFn(currentStats);
      return Promise.resolve(updatedStats);
    });

    // Override the transaction mock for this specific test
    mockRef.mockImplementation((path: string) => {
      if (path === "locations") {
        return {
          push: jest.fn(() => ({
            key: "mock-location-id",
            set: jest.fn().mockResolvedValue(true),
          })),
        };
      }
      if (path === "stats") {
        return { transaction: mockTransaction };
      }
      return {};
    });

    const request = {
      data: {
        addedAt: "2025-07-26T00:00:00.000Z", // Use mocked date to test today_pins increment
        address: "123 Main St",
        additionalInfo: "Nice place",
      },
    };

    const context = { auth: { uid: "test-user-id" } };

    // Call the pin function
    const res = await wrappedPin(request, context);

    // Verify the function succeeded
    expect(res).toEqual({
      message: "Data logged and saved successfully",
      formattedAddress: "123 Main St, New York, NY",
    });

    // Verify that the stats reference was accessed
    expect(mockRef).toHaveBeenCalledWith("stats");

    // Verify that the transaction function was called
    expect(mockTransaction).toHaveBeenCalled();

    // Verify that the transaction function updates the stats correctly
    const transactionCallback = mockTransaction.mock.calls[0][0];
    const mockCurrentStats = { total_pins: 5, today_pins: 2, week_pins: 4 };
    const updatedStats = transactionCallback(mockCurrentStats);

    // Check that stats were incremented correctly
    expect(updatedStats.total_pins).toBe(6); // Should increment by 1
    expect(updatedStats.today_pins).toBe(3); // Should increment by 1 since it's today's date
    expect(updatedStats.week_pins).toBe(5); // Should increment by 1 for the week
  });

  it("should handle invalid data format for addedAt", async () => {
    const request = {
      data: {
        addedAt: "ERROR FORMAT", // Invalid date format
        address: "123 Main St",
        additionalInfo: "Nice place",
      },
    };

    const context = { auth: { uid: "test-user-id" } };

    await expect(wrappedPin(request, context)).rejects.toThrow(
      "Invalid date format for addedAt. Must be ISO 8601 format."
    );
  });

  it("should throw an error if addedAt is not today", async () => {
    // Use a date that's not today (relative to our mocked date of 2025-07-26)
    const notTodayDate = "2025-07-27T00:00:00.000Z"; // Tomorrow from mocked perspective

    const request = {
      data: {
        addedAt: notTodayDate,
        address: "123 Main St",
        additionalInfo: "Nice place",
      },
    };

    const context = { auth: { uid: "test-user-id" } };

    await expect(wrappedPin(request, context)).rejects.toThrow(
      "Invalid date format for addedAt. Must be today's date in ISO 8601 format."
    );
  });

  it("should throw an error if the address is not specific (like a city)", async () => {
    // Get the geocoding mock function that was exported
    const { __mockGeocodeAddress } = require("../../utils/geocodingService");

    // Configure the geocoding service to return null (address not found)
    __mockGeocodeAddress.mockResolvedValueOnce(null);

    const request = {
      data: {
        addedAt: "2025-07-26T00:00:00.000Z", // Must match mocked date
        address: "New York", // Too generic
        additionalInfo: "Nice place",
      },
    };

    const context = { auth: { uid: "test-user-id" } };
    await expect(wrappedPin(request, context)).rejects.toThrow(
      "Please provide a valid address that can be found on the map"
    );
  });
});
