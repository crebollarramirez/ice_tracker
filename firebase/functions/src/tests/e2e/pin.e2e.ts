import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";
import { makeAddressKey } from "../../utils/addressHandling";
import { GoogleGeocodingService } from "../../utils/geocodingService";

const testEnv = functionsTest({
  projectId: process.env.GCLOUD_PROJECT_ID,
  databaseURL: process.env.FB_RTDB_EMULATOR_URL,
});

const { pin } = require("../../index");

const BASE_IMAGE_PATH = "reports/pending/test-user/1732345678000.jpg";

jest.setTimeout(30000);

describe("pin function - e2e", () => {
  const wrappedPin = testEnv.wrap(pin) as any;

  afterAll(async () => {
    await admin.app().delete();
    testEnv.cleanup();
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await admin.database().ref("pending").set(null);
  });

  const buildRequest = (overrides = {}) => ({
    data: {
      addedAt: new Date().toISOString(),
      address: "1600 Amphitheatre Parkway, Mountain View, CA",
      additionalInfo: "Test submission",
      imagePath: BASE_IMAGE_PATH,
      ...overrides,
    },
  });

  it("stores a new pending report", async () => {
    const request = buildRequest();
    const result = await wrappedPin(request);

    expect(result).toEqual({
      message: "Data logged and saved successfully",
      formattedAddress: "Google Building 41, 1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
    });

    const key = makeAddressKey(result.formattedAddress);
    const snapshot = await admin.database().ref(`pending/${key}`).once("value");
    const stored = snapshot.val();

    expect(stored).toMatchObject({
      addedAt: request.data.addedAt,
      address: result.formattedAddress,
      additionalInfo: "Test submission",
      lat: 37.4224544,
      lng: -122.0881659,
      reported: 1,
      imagePath: BASE_IMAGE_PATH,
    });
  });

  it("increments reported count when the same address is submitted twice", async () => {
    const request = buildRequest({ additionalInfo: "first" });
    await wrappedPin(request);

    const secondRequest = buildRequest({ additionalInfo: "second" });
    const secondResult = await wrappedPin(secondRequest);

    expect(secondResult.message).toBe("Location updated successfully");

    const key = makeAddressKey(secondResult.formattedAddress);
    const snapshot = await admin.database().ref(`pending/${key}`).once("value");
    const stored = snapshot.val();

    expect(stored.additionalInfo).toBe("second");
    expect(stored.reported).toBe(2);
  });

  it("requires imagePath", async () => {
    await expect(
      wrappedPin(
        buildRequest({
          imagePath: "",
        })
      )
    ).rejects.toThrow("Missing required field: imagePath");
  });

  it("requires additionalInfo", async () => {
    await expect(
      wrappedPin(
        buildRequest({
          additionalInfo: "",
        })
      )
    ).rejects.toThrow("Missing required fields: additionalInfo");
  });

  it("validates ISO 8601 dates", async () => {
    await expect(
      wrappedPin(
        buildRequest({
          addedAt: "08/10/2025",
        })
      )
    ).rejects.toThrow(
      "Invalid date format for addedAt. Must be ISO 8601 format."
    );
  });

  it("requires addedAt to be today's date (UTC)", async () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    await expect(
      wrappedPin(
        buildRequest({
          addedAt: yesterday.toISOString(),
        })
      )
    ).rejects.toThrow(
      "Invalid date format for addedAt. Must be today's date in ISO 8601 format."
    );
  });

  it("rejects invalid addresses when geocoding fails", async () => {
    const spy = jest
      .spyOn(GoogleGeocodingService.prototype, "geocodeAddress")
      .mockResolvedValueOnce(null);

    await expect(wrappedPin(buildRequest())).rejects.toThrow(
      "Please provide a valid address that can be found on the map"
    );

    spy.mockRestore();
  });

  it("returns internal error when database write fails", async () => {
    const db = admin.database();
    const originalRef = db.ref.bind(db);
    const testAddress = "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA";
    const key = makeAddressKey(testAddress);

    // Mock geocoding to return a predictable formatted address
    const geocodingSpy = jest
      .spyOn(GoogleGeocodingService.prototype, "geocodeAddress")
      .mockResolvedValueOnce({
        formattedAddress: testAddress,
        lat: 37.4216724,
        lng: -122.0856444,
      });

    const refSpy = jest.spyOn(db, "ref").mockImplementation((path: any) => {
      if (path === `pending/${key}`) {
        return {
          once: jest.fn().mockResolvedValue({
            exists: () => false,
            val: () => null,
          }),
          set: jest.fn().mockRejectedValue(new Error("Database error")),
        } as any;
      }
      return originalRef(path);
    });

    await expect(wrappedPin(buildRequest())).rejects.toThrow(
      "Internal server error"
    );

    refSpy.mockRestore();
    geocodingSpy.mockRestore();
  });
});
