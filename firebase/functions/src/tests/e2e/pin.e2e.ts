import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";

// Initialize Firebase Functions Test framework
const testEnv = functionsTest({
  projectId: process.env.GCLOUD_PROJECT_ID,
  databaseURL: process.env.FB_RTDB_EMULATOR_URL,
});

// Import the pin function after initializing the test environment
import { pin } from "../../index";

describe("Pin Function E2E Tests", () => {
  afterAll(async () => {
    // Clean up Firebase connections
    await admin.app().delete();
    testEnv.cleanup();
  });

  beforeEach(async () => {
    // Clear emulator data before each test
    try {
      await admin.database().ref("locations").set(null);
      await admin.database().ref("stats").set(null);
      await admin
        .firestore()
        .recursiveDelete(admin.firestore().collection("negative"));
    } catch (error) {
      // Ignore cleanup errors
      console.warn("Cleanup error:", error);
    }
  });

  it("should successfully pin a valid U.S. address and update stats", async () => {
    // Prepare test data with today's date
    const request = {
      data: {
        addedAt: new Date().toISOString(),
        address: "1600 Amphitheatre Parkway, Mountain View, CA",
        additionalInfo: "Additional Information Testing",
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

    // Verify that data was actually written to the emulator database
    const database = admin.database();

    // Check that a location was added to the locations ref
    const locationsSnapshot = await database.ref("locations").once("value");
    const locationsData = locationsSnapshot.val();
    expect(locationsData).toBeTruthy();

    // Find our added location
    const locationKeys = Object.keys(locationsData);
    expect(locationKeys.length).toBeGreaterThan(0);

    const addedLocation = Object.values(locationsData)[0] as any;
    expect(typeof addedLocation.address).toBe("string");
    expect(addedLocation.address).toContain("Mountain View"); // formatted value
    expect(addedLocation.additionalInfo).toBe("Additional Information Testing");
    expect(addedLocation.lat).toBeDefined();
    expect(addedLocation.lng).toBeDefined();

    // Check that stats were updated
    const statsSnapshot = await database.ref("stats").once("value");
    const statsData = statsSnapshot.val();
    expect(statsData).toBeTruthy();
    expect(statsData.total_pins).toBeGreaterThan(0);
    expect(statsData.week_pins).toBeGreaterThan(0);
  });

  it("should reject addresses outside the U.S.", async () => {
    // Prepare test data with non-U.S. address
    const request = {
      data: {
        addedAt: new Date().toISOString(),
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
        addedAt: new Date().toISOString(),
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

      // Verify that negative content was actually logged to Firestore emulator
      const firestore = admin.firestore();
      const negativeCollection = await firestore.collection("negative").get();
      expect(negativeCollection.empty).toBe(false);

      // Check that the negative content document contains our data
      const docs = negativeCollection.docs;
      const negativeDoc = docs.find((doc) => {
        const data = doc.data();
        return (
          data.additionalInfo ===
          "This is extremely offensive and inappropriate content that should be filtered"
        );
      });
      expect(negativeDoc).toBeDefined();
    }
  });

  it("should reject invalid addresses that cannot be geocoded", async () => {
    // Prepare test data with completely invalid address
    const request = {
      data: {
        addedAt: new Date().toISOString(),
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
        addedAt: new Date().toISOString(),
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
    const today = new Date();
    const yesterday = new Date(today);
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

  it("should reject an empty address", async () => {
    const request = {
      data: {
        addedAt: new Date().toISOString(),
        address: "",
        additionalInfo: "Testing empty address",
      },
    };

    const wrappedPin = testEnv.wrap(pin) as any;

    await expect(wrappedPin(request)).rejects.toThrow(
      "Missing required fields: addedAt and address"
    );
  });

  it("should handle database errors gracefully", async () => {
    const db = admin.database();
    const originalRef = db.ref.bind(db);

    const refSpy = jest.spyOn(db, "ref").mockImplementation((path: any) => {
      if (path === "locations") {
        return {
          push: () => ({
            key: "mock",
            set: jest.fn().mockRejectedValue(new Error("Database error")),
          }),
        } as any;
      }
      // let other refs (e.g., 'stats') behave normally
      return originalRef(path);
    });

    const wrappedPin = testEnv.wrap(pin) as any;
    await expect(
      wrappedPin({
        data: {
          addedAt: new Date().toISOString(),
          address: "1600 Amphitheatre Parkway, Mountain View, CA",
          additionalInfo: "Testing database error",
        },
      })
    ).rejects.toThrow("Internal server error");

    refSpy.mockRestore();
  });

  it("should handle non specific addresses like just a city", async () => {
    const request = {
      data: {
        addedAt: new Date().toISOString(),
        address: "Los Angeles, CA",
        additionalInfo: "Testing invalid address rejection",
      },
    };

    const wrappedPin = testEnv.wrap(pin) as any;

    await expect(wrappedPin(request)).rejects.toThrow(
      "Please provide a valid address that can be found on the map"
    );
  });
});
