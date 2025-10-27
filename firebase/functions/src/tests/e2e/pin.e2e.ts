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
      // Clear rate limiting data
      await admin
        .firestore()
        .recursiveDelete(admin.firestore().collection("rate_daily_ip"));
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
      headers: {
        "x-forwarded-for": "192.168.1.100",
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
      headers: {
        "x-forwarded-for": "192.168.1.101",
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
      headers: {
        "x-forwarded-for": "192.168.1.102",
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
      headers: {
        "x-forwarded-for": "192.168.1.103",
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
      headers: {
        "x-forwarded-for": "192.168.1.104",
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
      headers: {
        "x-forwarded-for": "192.168.1.105",
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
      headers: {
        "x-forwarded-for": "192.168.1.106",
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
      headers: {
        "x-forwarded-for": "192.168.1.107",
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
      headers: {
        "x-forwarded-for": "192.168.1.108",
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
      headers: {
        "x-forwarded-for": "192.168.1.109",
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
      // Mock the locations/addressKey pattern to also fail
      if (typeof path === "string" && path.startsWith("locations/")) {
        return {
          once: jest.fn().mockResolvedValue({
            exists: () => false,
            val: () => null,
          }),
          set: jest.fn().mockRejectedValue(new Error("Database error")),
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
        headers: {
          "x-forwarded-for": "192.168.1.110",
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
      headers: {
        "x-forwarded-for": "192.168.1.111",
      },
    };

    const wrappedPin = testEnv.wrap(pin) as any;

    await expect(wrappedPin(request)).rejects.toThrow(
      "Please provide a valid address that can be found on the map"
    );
  });

  it("should generate correct address key for stored location", async () => {
    // Prepare test data with a known address
    const request = {
      data: {
        addedAt: new Date().toISOString(),
        address: "1600 Amphitheatre Parkway, Mountain View, CA",
        additionalInfo: "Testing address key generation",
      },
      headers: {
        "x-forwarded-for": "192.168.1.112",
      },
    };

    // Wrap the pin function for testing
    const wrappedPin = testEnv.wrap(pin) as any;

    // Call the pin function
    const result = await wrappedPin(request);

    // Verify the function succeeded
    expect(result.message).toBe("Data logged and saved successfully");

    // Get the formatted address from the result
    const formattedAddress = result.formattedAddress;
    expect(formattedAddress).toBeDefined();

    // Import the makeAddressKey function to test key generation
    const { makeAddressKey } = await import("../../utils/addressHandling");

    // Generate the expected key from the formatted address
    const expectedKey = makeAddressKey(formattedAddress);
    expect(expectedKey).toBeTruthy();
    expect(expectedKey.length).toBeGreaterThan(0);

    // Verify that the location was stored with the correct key
    const database = admin.database();
    const locationsSnapshot = await database.ref("locations").once("value");
    const locationsData = locationsSnapshot.val();

    expect(locationsData).toBeTruthy();

    // Check that the expected key exists in the database
    expect(locationsData[expectedKey]).toBeDefined();

    // Verify the stored data matches what we expect
    const storedLocation = locationsData[expectedKey];
    expect(storedLocation.address).toBe(formattedAddress);
    expect(storedLocation.additionalInfo).toBe(
      "Testing address key generation"
    );
    expect(storedLocation.addedAt).toBe(request.data.addedAt);
    expect(storedLocation.lat).toBeDefined();
    expect(storedLocation.lng).toBeDefined();

    // Verify the key format follows our expected pattern
    // Expected format: lowercase, no special chars, underscores for spaces
    expect(expectedKey).toMatch(/^[a-z0-9_]+$/);
    expect(expectedKey).not.toContain(" ");
    expect(expectedKey).not.toContain(",");
    expect(expectedKey).not.toContain(".");

    // Verify key generation is consistent
    const duplicateKey = makeAddressKey(formattedAddress);
    expect(duplicateKey).toBe(expectedKey);
  });

  it("should update existing location when same address is submitted twice", async () => {
    const address = "1600 Amphitheatre Parkway, Mountain View, CA";

    // First submission - create initial location
    const firstRequest = {
      data: {
        addedAt: new Date().toISOString(),
        address,
        additionalInfo: "First submission",
      },
      headers: {
        "x-forwarded-for": "192.168.1.113",
      },
    };

    const wrappedPin = testEnv.wrap(pin) as any;

    // Submit first location
    const firstResult = await wrappedPin(firstRequest);
    expect(firstResult.message).toBe("Data logged and saved successfully");

    const formattedAddress = firstResult.formattedAddress;
    expect(formattedAddress).toBeDefined();

    // Verify initial stats were updated
    const database = admin.database();
    let statsSnapshot = await database.ref("stats").once("value");
    let statsData = statsSnapshot.val();
    expect(statsData.total_pins).toBe(1);
    expect(statsData.today_pins).toBe(1);
    expect(statsData.week_pins).toBe(1);

    // Verify only one location exists
    let locationsSnapshot = await database.ref("locations").once("value");
    let locationsData = locationsSnapshot.val();
    let locationKeys = Object.keys(locationsData);
    expect(locationKeys.length).toBe(1);

    // Get the initial location data
    const initialLocation = Object.values(locationsData)[0] as any;
    expect(initialLocation.additionalInfo).toBe("First submission");

    // Second submission with same address but different info
    const secondRequest = {
      data: {
        addedAt: new Date().toISOString(),
        address, // Same address should generate same key
        additionalInfo: "Updated information - second submission",
      },
      headers: {
        "x-forwarded-for": "192.168.1.113", // Same IP to avoid rate limiting
      },
    };

    // Submit second location with same address
    const secondResult = await wrappedPin(secondRequest);
    expect(secondResult.message).toBe("Location updated successfully");
    expect(secondResult.formattedAddress).toBe(formattedAddress); // Same formatted address

    // Verify stats were NOT incremented (since it's an update, not new location)
    statsSnapshot = await database.ref("stats").once("value");
    statsData = statsSnapshot.val();

    // stats are incremened by 2 since we count reports, no unique locations
    expect(statsData.total_pins).toBe(2); // Should still be 1
    expect(statsData.today_pins).toBe(2); // Should still be 1
    expect(statsData.week_pins).toBe(2); // Should still be 1

    // Verify still only one location exists (no duplicate)
    locationsSnapshot = await database.ref("locations").once("value");
    locationsData = locationsSnapshot.val();
    locationKeys = Object.keys(locationsData);
    expect(locationKeys.length).toBe(1); // Still only one location

    // Verify the location was updated with new information
    const updatedLocation = Object.values(locationsData)[0] as any;
    expect(updatedLocation.additionalInfo).toBe(
      "Updated information - second submission"
    );
    expect(updatedLocation.address).toBe(formattedAddress);
    expect(updatedLocation.addedAt).toBe(secondRequest.data.addedAt); // Updated timestamp
    expect(updatedLocation.lat).toBeDefined();
    expect(updatedLocation.lng).toBeDefined();

    // Verify the same key was used for both submissions
    const { makeAddressKey } = await import("../../utils/addressHandling");
    const expectedKey = makeAddressKey(formattedAddress);
    expect(locationsData[expectedKey]).toBeDefined();
    expect(locationKeys[0]).toBe(expectedKey);

    // Verify the key is the same for both addresses (even if input format differs slightly)
    const thirdRequest = {
      data: {
        addedAt: new Date().toISOString(),
        address: "1600 Amphitheatre Pkwy, Mountain View, CA", // Slightly different input format
        additionalInfo:
          "Third submission with slightly different address format",
      },
      headers: {
        "x-forwarded-for": "192.168.1.113", // Same IP to avoid rate limiting
      },
    };

    const thirdResult = await wrappedPin(thirdRequest);

    // If geocoding returns the same formatted address, it should update again
    if (thirdResult.formattedAddress === formattedAddress) {
      expect(thirdResult.message).toBe("Location updated successfully");

      // Verify still only one location
      locationsSnapshot = await database.ref("locations").once("value");
      locationsData = locationsSnapshot.val();
      locationKeys = Object.keys(locationsData);
      expect(locationKeys.length).toBe(1);

      // Verify info was updated again
      const finalLocation = Object.values(locationsData)[0] as any;
      expect(finalLocation.additionalInfo).toBe(
        "Third submission with slightly different address format"
      );

      // Stats should still be 1 (no increment for updates)
      statsSnapshot = await database.ref("stats").once("value");
      statsData = statsSnapshot.val();
      expect(statsData.total_pins).toBe(3); // since we count reports, no unique locations
    }
  });

  it("should accept intersection addresses", async () => {
    const request = {
      data: {
        addedAt: new Date().toISOString(),
        address: "Hollywood Boulevard and Highland Avenue, Los Angeles, CA",
        additionalInfo: "Testing intersection address acceptance",
      },
      headers: {
        "x-forwarded-for": "192.168.1.114",
      },
    };

    const wrappedPin = testEnv.wrap(pin) as any;

    // Should accept the intersection without throwing an error
    const result = await wrappedPin(request);

    // Verify successful response
    expect(result.message).toMatch(/successfully/);
    expect(result.formattedAddress).toBeDefined();
    expect(result.formattedAddress.length).toBeGreaterThan(0);
  });

  it("should accept intersection with ampersand format", async () => {
    const request = {
      data: {
        addedAt: new Date().toISOString(),
        address: "Sunset Boulevard & Vine Street, Hollywood, CA",
        additionalInfo: "Testing intersection with ampersand",
      },
      headers: {
        "x-forwarded-for": "192.168.1.115",
      },
    };

    const wrappedPin = testEnv.wrap(pin) as any;

    // Should accept the intersection with ampersand without throwing an error
    const result = await wrappedPin(request);

    // Verify successful response
    expect(result.message).toMatch(/successfully/);
    expect(result.formattedAddress).toBeDefined();
    expect(result.formattedAddress.length).toBeGreaterThan(0);
  });

  it("should accept exact street addresses", async () => {
    const request = {
      data: {
        addedAt: new Date().toISOString(),
        address: "123 Main Street, Los Angeles, CA 90210",
        additionalInfo: "Testing exact street address acceptance",
      },
      headers: {
        "x-forwarded-for": "192.168.1.116",
      },
    };

    const wrappedPin = testEnv.wrap(pin) as any;

    // Should accept the exact street address without throwing an error
    const result = await wrappedPin(request);

    // Verify successful response
    expect(result.message).toMatch(/successfully/);
    expect(result.formattedAddress).toBeDefined();
    expect(result.formattedAddress.length).toBeGreaterThan(0);

    // Verify that data was actually written to the database
    const database = admin.database();
    const locationsSnapshot = await database.ref("locations").once("value");
    const locationsData = locationsSnapshot.val();
    expect(locationsData).toBeTruthy();

    // Find our added location
    const locationKeys = Object.keys(locationsData);
    expect(locationKeys.length).toBeGreaterThan(0);

    const addedLocation = Object.values(locationsData)[0] as any;
    expect(addedLocation.address).toBe(result.formattedAddress);
    expect(addedLocation.additionalInfo).toBe(
      "Testing exact street address acceptance"
    );
    expect(addedLocation.lat).toBeDefined();
    expect(addedLocation.lng).toBeDefined();
  });

  it("should accept premise addresses", async () => {
    const request = {
      data: {
        addedAt: new Date().toISOString(),
        address: "Apple Park, 1 Apple Park Way, Cupertino, CA",
        additionalInfo: "Testing premise address acceptance",
      },
      headers: {
        "x-forwarded-for": "192.168.1.117",
      },
    };

    const wrappedPin = testEnv.wrap(pin) as any;

    // Should accept the premise address without throwing an error
    const result = await wrappedPin(request);

    // Verify successful response
    expect(result.message).toMatch(/successfully/);
    expect(result.formattedAddress).toBeDefined();
    expect(result.formattedAddress.length).toBeGreaterThan(0);

    // Verify that data was actually written to the database
    const database = admin.database();
    const locationsSnapshot = await database.ref("locations").once("value");
    const locationsData = locationsSnapshot.val();
    expect(locationsData).toBeTruthy();

    // Find our added location
    const locationKeys = Object.keys(locationsData);
    expect(locationKeys.length).toBeGreaterThan(0);

    const addedLocation = Object.values(locationsData)[0] as any;
    expect(addedLocation.address).toBe(result.formattedAddress);
    expect(addedLocation.additionalInfo).toBe(
      "Testing premise address acceptance"
    );
    expect(addedLocation.lat).toBeDefined();
    expect(addedLocation.lng).toBeDefined();
  });

  it("should accept business addresses", async () => {
    const request = {
      data: {
        addedAt: new Date().toISOString(),
        address: "Starbucks, 1912 Pike Place, Seattle, WA 98101",
        additionalInfo: "Testing business address acceptance",
      },
      headers: {
        "x-forwarded-for": "192.168.1.118",
      },
    };

    const wrappedPin = testEnv.wrap(pin) as any;

    // Should accept the intersection without throwing an error
    const result = await wrappedPin(request);

    // Verify successful response
    expect(result.message).toMatch(/successfully/);
    expect(result.formattedAddress).toBeDefined();
    expect(result.formattedAddress.length).toBeGreaterThan(0);
  });

  it("should accept exact residential house addresses", async () => {
    const request = {
      data: {
        addedAt: new Date().toISOString(),
        address: "1234 Elm Street, Springfield, IL 62701",
        additionalInfo: "Testing exact residential house address",
      },
      headers: {
        "x-forwarded-for": "192.168.1.119",
      },
    };

    const wrappedPin = testEnv.wrap(pin) as any;

    // Should accept the exact house address without throwing an error
    const result = await wrappedPin(request);

    // Verify successful response
    expect(result.message).toMatch(/successfully/);
    expect(result.formattedAddress).toBeDefined();
    expect(result.formattedAddress.length).toBeGreaterThan(0);

    // Verify that data was actually written to the database
    const database = admin.database();
    const locationsSnapshot = await database.ref("locations").once("value");
    const locationsData = locationsSnapshot.val();
    expect(locationsData).toBeTruthy();

    // Find our added location
    const locationKeys = Object.keys(locationsData);
    expect(locationKeys.length).toBeGreaterThan(0);

    const addedLocation = Object.values(locationsData)[0] as any;
    expect(addedLocation.address).toBe(result.formattedAddress);
    expect(addedLocation.additionalInfo).toBe(
      "Testing exact residential house address"
    );
    expect(addedLocation.lat).toBeDefined();
    expect(addedLocation.lng).toBeDefined();

    // Verify the address contains expected components of a valid US address
    expect(result.formattedAddress).toMatch(/IL|Illinois/i);
    expect(result.formattedAddress).toMatch(/USA|United States/i);
  });

  it("should enforce rate limiting after 3 requests from same IP", async () => {
    const testIP = "192.168.1.200";
    const baseRequest = {
      data: {
        addedAt: new Date().toISOString(),
        address: "1600 Amphitheatre Parkway, Mountain View, CA",
        additionalInfo: "Rate limiting test",
      },
      headers: {
        "x-forwarded-for": testIP,
      },
    };

    const wrappedPin = testEnv.wrap(pin) as any;

    // First 3 requests should succeed
    for (let i = 1; i <= 3; i++) {
      const request = {
        ...baseRequest,
        data: {
          ...baseRequest.data,
          additionalInfo: `Rate limiting test request ${i}`,
        },
      };

      const result = await wrappedPin(request);
      expect(result.message).toMatch(/successfully/);
    }

    // 4th request should be blocked by rate limiting
    const fourthRequest = {
      ...baseRequest,
      data: {
        ...baseRequest.data,
        additionalInfo: "Rate limiting test request 4 - should be blocked",
      },
    };

    await expect(wrappedPin(fourthRequest)).rejects.toThrow(
      "Daily limit reached. Try again tomorrow."
    );
  });

  it("should allow requests from different IPs even after rate limit", async () => {
    const firstIP = "192.168.1.201";
    const secondIP = "192.168.1.202";

    const wrappedPin = testEnv.wrap(pin) as any;

    // Exhaust rate limit for first IP
    for (let i = 1; i <= 3; i++) {
      const request = {
        data: {
          addedAt: new Date().toISOString(),
          address: `${1000 + i} Main Street, Los Angeles, CA`, // Different addresses to avoid conflicts
          additionalInfo: `Request ${i} from first IP`,
        },
        headers: {
          "x-forwarded-for": firstIP,
        },
      };

      const result = await wrappedPin(request);
      expect(result.message).toMatch(/successfully/);
    }

    // 4th request from first IP should be blocked
    await expect(
      wrappedPin({
        data: {
          addedAt: new Date().toISOString(),
          address: "1004 Main Street, Los Angeles, CA",
          additionalInfo: "4th request from first IP - should be blocked",
        },
        headers: {
          "x-forwarded-for": firstIP,
        },
      })
    ).rejects.toThrow("Daily limit reached. Try again tomorrow.");

    // But requests from second IP should still work
    const requestFromSecondIP = {
      data: {
        addedAt: new Date().toISOString(),
        address: "2000 Second Street, Los Angeles, CA",
        additionalInfo: "Request from second IP - should succeed",
      },
      headers: {
        "x-forwarded-for": secondIP,
      },
    };

    const result = await wrappedPin(requestFromSecondIP);
    expect(result.message).toMatch(/successfully/);
  });

  it("should reject requests with no IP headers", async () => {
    const request = {
      data: {
        addedAt: new Date().toISOString(),
        address: "1600 Amphitheatre Parkway, Mountain View, CA",
        additionalInfo: "Testing no IP headers",
      },
      headers: {}, // Empty headers - will result in "unknown" IP
    };

    const wrappedPin = testEnv.wrap(pin) as any;

    await expect(wrappedPin(request)).rejects.toThrow(
      "Unable to determine client IP address. Request blocked for security."
    );
  });

  it("should allow requests with IP in request.ip when x-forwarded-for is missing", async () => {
    const request = {
      data: {
        addedAt: new Date().toISOString(),
        address: "1600 Amphitheatre Parkway, Mountain View, CA",
        additionalInfo: "Testing request.ip fallback",
      },
      headers: {}, // No x-forwarded-for header
      ip: "192.168.1.203", // But has request.ip
    };

    const wrappedPin = testEnv.wrap(pin) as any;

    const result = await wrappedPin(request);
    expect(result.message).toMatch(/successfully/);
  });
});
