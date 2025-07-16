/**
 * Simple integration test for the pin HTTP function
 * Tests the complete end-to-end flow without Firebase emulators
 */

import * as admin from "firebase-admin";

// Mock the external services before importing the function
const mockGeocode = jest.fn();
const mockIsNegative = jest.fn();

jest.mock("../../src/utils/geocodingService", () => ({
  GoogleGeocodingService: jest.fn().mockImplementation(() => ({
    geocodeAddress: mockGeocode,
  })),
}));

jest.mock("../../src/utils/aiFilter", () => ({
  OpenAIService: jest.fn().mockImplementation(() => ({
    isNegative: mockIsNegative,
  })),
}));

// Mock Firebase Admin to avoid conflicts
const mockDatabaseSet = jest.fn().mockResolvedValue(undefined);
const mockDatabasePush = jest.fn(() => ({
  set: mockDatabaseSet,
  key: "mock-key-123",
}));
const mockDatabaseRef = jest.fn(() => ({
  push: mockDatabasePush,
}));

const mockFirestoreAdd = jest.fn().mockResolvedValue({ id: "mock-doc-id" });
const mockFirestoreCollection = jest.fn(() => ({
  add: mockFirestoreAdd,
}));

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  database: jest.fn(() => ({
    ref: mockDatabaseRef,
  })),
  firestore: jest.fn(() => ({
    collection: mockFirestoreCollection,
  })),
}));

import { pin } from "../../src/index";

describe("Pin Function Simple Integration Test", () => {
  // Helper function to create mock request and response objects
  function createMockRequestResponse(method = "POST", body = {}) {
    const req = {
      method,
      body,
      headers: {},
      url: "/",
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      statusCode: 200,
      _sent: false,
      _data: null,
    };

    // Mock response methods to capture data
    res.send.mockImplementation((data) => {
      res._sent = true;
      res._data = data;
      return res;
    });

    res.json.mockImplementation((data) => {
      res._sent = true;
      res._data = data;
      return res;
    });

    res.status.mockImplementation((code) => {
      res.statusCode = code;
      return res;
    });

    return { req, res };
  }

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Set up default successful mocks
    mockGeocode.mockResolvedValue({
      lat: 37.4219999,
      lng: -122.0840575,
      formattedAddress: "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
    });

    mockIsNegative.mockResolvedValue(false);

    // Reset database mocks
    mockDatabaseSet.mockClear().mockResolvedValue(undefined);
    mockDatabasePush.mockClear();
    mockDatabaseRef.mockClear();
    mockFirestoreAdd.mockClear().mockResolvedValue({ id: "mock-doc-id" });
    mockFirestoreCollection.mockClear();
  });

  describe("POST /pin - End-to-End Tests", () => {
    it("should successfully create a pin with valid data", async () => {
      const { req, res } = createMockRequestResponse("POST", {
        addedAt: "2025-07-15T12:00:00.000Z",
        address: "1600 Amphitheatre Parkway, Mountain View, CA",
        additionalInfo: "2 ice cream trucks spotted, good visibility",
      });

      await pin(req as any, res as any);

      // Verify HTTP response
      expect(res.statusCode).toBe(200);
      expect(res._data).toEqual({
        message: "Data logged and saved successfully",
        formattedAddress:
          "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
      });

      // Verify external services were called with sanitized inputs
      expect(mockGeocode).toHaveBeenCalledWith(
        "1600 Amphitheatre Parkway, Mountain View, CA"
      );
      expect(mockIsNegative).toHaveBeenCalledWith(
        "2 ice cream trucks spotted, good visibility"
      );

      // Verify database operations were called
      expect(admin.database).toHaveBeenCalled();
      expect(mockDatabaseRef).toHaveBeenCalledWith("locations");
      expect(mockDatabasePush).toHaveBeenCalled();
      expect(mockDatabaseSet).toHaveBeenCalledWith({
        addedAt: "2025-07-15T12:00:00.000Z",
        address: "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
        additionalInfo: "2 ice cream trucks spotted, good visibility",
        lat: 37.4219999,
        lng: -122.0840575,
      });
    });

    it("should reject requests with missing required fields", async () => {
      const { req, res } = createMockRequestResponse("POST", {
        additionalInfo: "Some info",
        // Missing addedAt and address
      });

      await pin(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res._data).toBe("Missing required fields: addedAt and address");

      // Verify external services were NOT called
      expect(mockGeocode).not.toHaveBeenCalled();
      expect(mockIsNegative).not.toHaveBeenCalled();
    });

    it("should reject non-POST requests", async () => {
      const { req, res } = createMockRequestResponse("GET");

      await pin(req as any, res as any);

      expect(res.statusCode).toBe(405);
      expect(res._data).toBe("Method Not Allowed");
    });

    it("should handle negative content detection", async () => {
      // Mock AI service to detect negative content
      mockIsNegative.mockResolvedValue(true);

      const { req, res } = createMockRequestResponse("POST", {
        addedAt: "2025-07-15T12:00:00.000Z",
        address: "123 Main Street",
        additionalInfo: "This place is terrible and should be shut down!",
      });

      await pin(req as any, res as any);

      expect(res.statusCode).toBe(422);
      expect(res._data).toEqual({
        error: "Negative content detected",
        message:
          "Please avoid using negative or abusive language in the additional info",
      });

      // Verify AI service was called with sanitized content
      expect(mockIsNegative).toHaveBeenCalledWith(
        "This place is terrible and should be shut down!"
      );

      // Verify negative content was logged to Firestore
      expect(admin.firestore).toHaveBeenCalled();
      expect(mockFirestoreCollection).toHaveBeenCalledWith("negative");
      expect(mockFirestoreAdd).toHaveBeenCalledWith({
        addedAt: "2025-07-15T12:00:00.000Z",
        address: "123 Main Street",
        additionalInfo: "This place is terrible and should be shut down!",
        timestamp: expect.any(String),
      });

      // Note: geocoding is NOT called when negative content is detected
      expect(mockGeocode).not.toHaveBeenCalled();
    });

    it("should handle geocoding failures", async () => {
      // Mock geocoding to fail
      mockGeocode.mockResolvedValue(null);

      const { req, res } = createMockRequestResponse("POST", {
        addedAt: "2025-07-15T12:00:00.000Z",
        address: "Invalid Address 12345 Nonexistent Street",
        additionalInfo: "Some info",
      });

      await pin(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res._data).toEqual({
        error: "Could not geocode the provided address",
        message: "Please provide a valid address that can be found on the map",
      });

      // Verify AI service was called first (before geocoding)
      expect(mockIsNegative).toHaveBeenCalledWith("Some info");
      // Then geocoding was attempted
      expect(mockGeocode).toHaveBeenCalledWith(
        "Invalid Address 12345 Nonexistent Street"
      );
    });

    it("should sanitize HTML inputs", async () => {
      const { req, res } = createMockRequestResponse("POST", {
        addedAt: "2025-07-15T12:00:00.000Z",
        address: "123 <script>alert('xss')</script> Main St",
        additionalInfo: "<div>2 ice cream trucks</div>",
      });

      await pin(req as any, res as any);

      expect(res.statusCode).toBe(200);

      // Verify inputs were sanitized (HTML tags removed, dangerous chars removed)
      expect(mockGeocode).toHaveBeenCalledWith("123 alert(xss) Main St");
      expect(mockIsNegative).toHaveBeenCalledWith("2 ice cream trucks");
    });

    it("should handle empty additionalInfo", async () => {
      const { req, res } = createMockRequestResponse("POST", {
        addedAt: "2025-07-15T12:00:00.000Z",
        address: "123 Main Street",
        additionalInfo: "",
      });

      await pin(req as any, res as any);

      expect(res.statusCode).toBe(200);

      // Verify geocoding was called
      expect(mockGeocode).toHaveBeenCalledWith("123 Main Street");
      // AI service is still called even with empty content
      expect(mockIsNegative).toHaveBeenCalledWith("");
    });

    
    it("should preserve allowed characters like ampersands", async () => {
      const { req, res } = createMockRequestResponse("POST", {
        addedAt: "2025-07-15T12:00:00.000Z",
        address: '123 Main St & "First" Ave',
        additionalInfo: 'Some "good" info',
      });

      await pin(req as any, res as any);

      expect(res.statusCode).toBe(200);

      // Verify ampersands are preserved but quotes are removed
      expect(mockGeocode).toHaveBeenCalledWith("123 Main St & First Ave");
      expect(mockIsNegative).toHaveBeenCalledWith("Some good info");
    });

    it("should handle database write failures", async () => {
      // Mock database to throw an error
      mockDatabaseSet.mockRejectedValue(
        new Error("Database connection failed")
      );

      const { req, res } = createMockRequestResponse("POST", {
        addedAt: "2025-07-15T12:00:00.000Z",
        address: "123 Main Street",
        additionalInfo: "Some info",
      });

      await pin(req as any, res as any);

      expect(res.statusCode).toBe(500);
      expect(res._data).toBe("Internal server error");

      // Verify that external services were still called before the database error
      expect(mockIsNegative).toHaveBeenCalledWith("Some info");
      expect(mockGeocode).toHaveBeenCalledWith("123 Main Street");

      // Verify database operations were attempted
      expect(mockDatabaseRef).toHaveBeenCalledWith("locations");
      expect(mockDatabasePush).toHaveBeenCalled();
      expect(mockDatabaseSet).toHaveBeenCalled();
    });

    it("should handle Firestore write failures for negative content", async () => {
      // Mock AI service to detect negative content
      mockIsNegative.mockResolvedValue(true);
      // Mock Firestore to fail
      mockFirestoreAdd.mockRejectedValue(
        new Error("Firestore connection failed")
      );

      const { req, res } = createMockRequestResponse("POST", {
        addedAt: "2025-07-15T12:00:00.000Z",
        address: "123 Main Street",
        additionalInfo: "This is terrible!",
      });

      await pin(req as any, res as any);

      // Should still return the negative content error even if Firestore logging fails
      expect(res.statusCode).toBe(422);
      expect(res._data).toEqual({
        error: "Negative content detected",
        message:
          "Please avoid using negative or abusive language in the additional info",
      });

      // Verify Firestore operations were attempted
      expect(mockFirestoreCollection).toHaveBeenCalledWith("negative");
      expect(mockFirestoreAdd).toHaveBeenCalledWith({
        addedAt: "2025-07-15T12:00:00.000Z",
        address: "123 Main Street",
        additionalInfo: "This is terrible!",
        timestamp: expect.any(String),
      });
    });

    it("should validate complete data structure in database write", async () => {
      // Reset database mocks to successful state
      mockDatabaseSet.mockResolvedValue(undefined);

      const { req, res } = createMockRequestResponse("POST", {
        addedAt: "2025-07-15T12:00:00.000Z",
        address: "456 Oak Street",
        additionalInfo: "Ice cream van with music playing",
      });

      await pin(req as any, res as any);

      expect(res.statusCode).toBe(200);

      // Verify the complete data structure written to database
      expect(mockDatabaseSet).toHaveBeenCalledWith({
        addedAt: "2025-07-15T12:00:00.000Z",
        address: "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA", // Formatted address from geocoding
        additionalInfo: "Ice cream van with music playing",
        lat: 37.4219999,
        lng: -122.0840575,
      });

      // Verify the data structure has all required fields
      const writtenData = mockDatabaseSet.mock.calls[0][0];
      expect(writtenData).toHaveProperty("addedAt");
      expect(writtenData).toHaveProperty("address");
      expect(writtenData).toHaveProperty("additionalInfo");
      expect(writtenData).toHaveProperty("lat");
      expect(writtenData).toHaveProperty("lng");
      expect(typeof writtenData.lat).toBe("number");
      expect(typeof writtenData.lng).toBe("number");
    });
  });
});
