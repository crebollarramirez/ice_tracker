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
  const mockOnce = jest.fn().mockResolvedValue({
    exists: () => false,
    val: () => null,
  });
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
    // Handle specific location paths (locations/addressKey pattern)
    if (typeof path === "string" && path.startsWith("locations/")) {
      return {
        once: mockOnce,
        set: mockSet,
      };
    }
    // Default fallback
    return {
      once: mockOnce,
      set: mockSet,
      push: mockPush,
      transaction: mockTransaction,
    };
  });
  const mockAdd = jest.fn().mockResolvedValue({ id: "mock-doc-id" });
  const mockCollectionTracker = jest.fn(); // Track collection calls

  // Mock Firestore for rate limiting
  const mockGet = jest.fn().mockResolvedValue({
    exists: false,
    data: () => ({}),
  });
  const mockTxSet = jest.fn();
  const mockDoc = jest.fn(() => ({ get: mockGet, set: mockTxSet }));
  const mockFirestoreCollection = jest.fn(() => ({
    add: mockAdd,
    doc: mockDoc,
  }));
  const mockRunTransaction = jest.fn(async (callback) => {
    const mockTx = {
      get: mockGet,
      set: mockTxSet,
    };
    return await callback(mockTx);
  });

  return {
    initializeApp: jest.fn(),
    database: jest.fn(() => ({ ref: mockRef })),
    firestore: Object.assign(
      jest.fn(() => ({
        collection: (name: string) => {
          if (name === "rate_daily_ip") {
            return mockFirestoreCollection();
          }
          // Track negative collection calls
          if (name === "negative") {
            mockCollectionTracker(name);
          }
          return { add: mockAdd };
        },
        runTransaction: mockRunTransaction,
      })),
      {
        FieldValue: {
          serverTimestamp: jest.fn(() => ({ serverTimestamp: true })),
        },
        Timestamp: {
          fromMillis: jest.fn((millis: number) => ({
            _seconds: Math.floor(millis / 1000),
            _nanoseconds: (millis % 1000) * 1000000,
          })),
        },
        __mockCollectionTracker: mockCollectionTracker, // Expose for testing
      }
    ),
  };
});

const testEnv = functionsTest({ projectId: "iceinmyarea" });
const wrappedPin = testEnv.wrap(pin) as (
  req: any,
  context?: any
) => Promise<any>;

describe("pin – integration", () => {
  const FIXED_DATE = new Date("2025-07-26T00:00:00.000Z").getTime();

  // Helper function to create properly formatted request objects
  const createRequest = (data: any) => ({
    ...data,
    headers: { "x-forwarded-for": "192.168.1.1" },
    ip: "127.0.0.1",
  });

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
    const request = createRequest({
      data: {
        addedAt: "2025-07-26T00:00:00.000Z", // Must match mocked date
        address: "123 Main St",
        additionalInfo: "Nice",
      },
    });

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

    const request = createRequest({
      data: {
        addedAt: "2025-07-26T00:00:00.000Z", // Must match mocked date
        address: "123 Main St",
        additionalInfo: "This is offensive content",
      },
    });

    const context = { auth: { uid: "test-user-id" } };

    // Expect the function to throw an HttpsError
    await expect(wrappedPin(request, context)).rejects.toThrow(
      "Please avoid using negative or abusive language in the additional info"
    );

    // Verify that the negative content was attempted to be logged to Firestore
    // We can access the mocked Firestore functions to verify they were called
    const mockFirestore = require("firebase-admin").firestore;
    expect(mockFirestore.__mockCollectionTracker).toHaveBeenCalledWith(
      "negative"
    );

    // Reset the mock back to default for other tests
    __mockIsNegative.mockResolvedValue(false);
  });

  it("should reject invalid addresses", async () => {
    // Get the geocoding mock function that was exported
    const { __mockGeocodeAddress } = require("../../utils/geocodingService");

    // Configure the geocoding service to return null (address not found)
    __mockGeocodeAddress.mockResolvedValueOnce(null);

    const request = createRequest({
      data: {
        addedAt: "2025-07-26T00:00:00.000Z", // Must match mocked date
        address: "Invalid Address That Cannot Be Found",
        additionalInfo: "Nice place",
      },
    });

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
    const request = createRequest({
      data: {
        // Missing addedAt field
        address: "123 Main St",
        additionalInfo: "Nice place",
      },
    });

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
      // Handle specific location paths (locations/addressKey pattern)
      if (typeof path === "string" && path.startsWith("locations/")) {
        return {
          once: jest.fn().mockResolvedValue({
            exists: () => false,
            val: () => null,
          }),
          set: jest.fn().mockResolvedValue(true),
        };
      }
      // Default fallback - never return empty object
      return {
        once: jest.fn().mockResolvedValue({
          exists: () => false,
          val: () => null,
        }),
        set: jest.fn().mockResolvedValue(true),
        push: jest.fn(() => ({
          key: "mock-location-id",
          set: jest.fn().mockResolvedValue(true),
        })),
        transaction: jest.fn(),
      };
    });

    const request = createRequest({
      data: {
        addedAt: "2025-07-26T00:00:00.000Z", // Use mocked date to test today_pins increment
        address: "123 Main St",
        additionalInfo: "Nice place",
      },
    });

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
    const request = createRequest({
      data: {
        addedAt: "ERROR FORMAT", // Invalid date format
        address: "123 Main St",
        additionalInfo: "Nice place",
      },
    });

    const context = { auth: { uid: "test-user-id" } };

    await expect(wrappedPin(request, context)).rejects.toThrow(
      "Invalid date format for addedAt. Must be ISO 8601 format."
    );
  });

  it("should throw an error if addedAt is not today", async () => {
    // Use a date that's not today (relative to our mocked date of 2025-07-26)
    const notTodayDate = "2025-07-27T00:00:00.000Z"; // Tomorrow from mocked perspective

    const request = createRequest({
      data: {
        addedAt: notTodayDate,
        address: "123 Main St",
        additionalInfo: "Nice place",
      },
    });

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

    const request = createRequest({
      data: {
        addedAt: "2025-07-26T00:00:00.000Z", // Must match mocked date
        address: "New York", // Too generic
        additionalInfo: "Nice place",
      },
    });

    const context = { auth: { uid: "test-user-id" } };
    await expect(wrappedPin(request, context)).rejects.toThrow(
      "Please provide a valid address that can be found on the map"
    );
  });

  it("should throw an error when daily rate limit is exceeded", async () => {
    // Get the Firebase Admin SDK mock and configure it to simulate rate limit exceeded
    const admin = require("firebase-admin");
    const mockFirestore = admin.firestore();
    const mockRunTransaction = mockFirestore.runTransaction;

    // Mock the transaction to simulate existing record at limit
    mockRunTransaction.mockImplementationOnce(async (callback: any) => {
      // The callback should return true when at limit (rate limit exceeded)
      return true; // Force the enforceDailyQuotaByIp to return true (exceeded)
    });

    const request = createRequest({
      data: {
        addedAt: "2025-07-26T00:00:00.000Z",
        address: "123 Main St",
        additionalInfo: "Nice place",
      },
    });

    const context = { auth: { uid: "test-user-id" } };

    await expect(wrappedPin(request, context)).rejects.toThrow(
      "Daily limit reached. Try again tomorrow."
    );
  });

  it("should propagate rate limiting errors (like unknown IP)", async () => {
    // Don't use createRequest helper here because we need empty headers
    const request = {
      data: {
        addedAt: "2025-07-26T00:00:00.000Z",
        address: "123 Main St",
        additionalInfo: "Nice place",
      },
      headers: {}, // Empty headers - will result in "unknown" IP
      // No ip property either, so clientIp will return "unknown"
    };

    const context = { auth: { uid: "test-user-id" } };

    await expect(wrappedPin(request, context)).rejects.toThrow(
      "Unable to determine client IP address. Request blocked for security."
    );
  });
});
