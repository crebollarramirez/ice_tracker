import { Collections } from "../../database/Collection";

// Mock firebase-functions/logger
jest.mock("firebase-functions/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock firebase-admin
jest.mock("firebase-admin", () => ({
  firestore: {
    FieldValue: {
      serverTimestamp: jest.fn(() => ({ _methodName: "serverTimestamp" })),
    },
  },
}));

describe("Collections - Integration Tests", () => {
  let collections: Collections;
  let mockFirestoreDb: any;
  let mockCollection: any;
  let mockDoc: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    // Restore any spies
    jest.restoreAllMocks();

    // Create mock Firestore objects
    mockDoc = {
      set: jest.fn().mockResolvedValue(undefined),
    };

    mockCollection = {
      add: jest.fn().mockResolvedValue({ id: "mock-doc-id" }),
      doc: jest.fn().mockReturnValue(mockDoc),
    };

    mockFirestoreDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
    };

    // Initialize Collections with mocked Firestore
    collections = new Collections(mockFirestoreDb as any);
  });

  describe("logVerification", () => {
    it("should successfully log verification action", async () => {
      // Arrange
      const reportData = {
        reportId: "test-report-123",
        verifierUid: "verifier-uid-456",
        verifierEmail: "verifier@example.com",
        reportAddress: "123 Test Street",
      };

      // Mock Date.prototype.toISOString to return a consistent value
      const mockDate = "2025-11-18T10:00:00.000Z";
      jest.spyOn(Date.prototype, "toISOString").mockReturnValue(mockDate);

      // Act
      await collections.logVerification(reportData);

      // Assert
      expect(mockFirestoreDb.collection).toHaveBeenCalledWith(
        "verificationLogs"
      );
      expect(mockCollection.add).toHaveBeenCalledWith({
        reportId: reportData.reportId,
        verifierUid: reportData.verifierUid,
        verifiedAt: mockDate,
      });

      // Restore the original implementation
      (Date.prototype.toISOString as jest.Mock).mockRestore();
    });

    it("should handle null verifier email", async () => {
      // Arrange
      const reportData = {
        reportId: "test-report-123",
        verifierUid: "verifier-uid-456",
        verifierEmail: "",
        reportAddress: "123 Test Street",
      };

      // Mock Date.prototype.toISOString to return a consistent value
      const mockDate = "2025-11-18T10:00:00.000Z";
      jest.spyOn(Date.prototype, "toISOString").mockReturnValue(mockDate);

      // Act
      await collections.logVerification(reportData);

      // Assert
      expect(mockCollection.add).toHaveBeenCalledWith({
        reportId: reportData.reportId,
        verifierUid: reportData.verifierUid,
        verifiedAt: mockDate,
      });

      // Restore the original implementation
      (Date.prototype.toISOString as jest.Mock).mockRestore();
    });

    it("should throw error when Firestore operation fails", async () => {
      // Arrange
      const reportData = {
        reportId: "test-report-123",
        verifierUid: "verifier-uid-456",
        verifierEmail: "verifier@example.com",
        reportAddress: "123 Test Street",
      };
      const firestoreError = new Error("Firestore write failed");
      mockCollection.add.mockRejectedValueOnce(firestoreError);

      // Act & Assert
      await expect(collections.logVerification(reportData)).rejects.toThrow(
        "Firestore write failed"
      );
    });
  });

  describe("logDenial", () => {
    const baseReportData = {
      verifierUid: "verifier-uid-456",
      verifierEmail: "verifier@example.com",
      reportAddress: "123 Test Street",
      imagePath: "reports/pending/test-report.jpg",
      reason: "Duplicate report",
    };

    it("should successfully log denial action with derived image name", async () => {
      const mockDate = "2025-11-18T10:00:00.000Z";
      jest.spyOn(Date.prototype, "toISOString").mockReturnValue(mockDate);

      await collections.logDenial(baseReportData as any);

      expect(mockFirestoreDb.collection).toHaveBeenCalledWith("deniedLogs");
      expect(mockCollection.add).toHaveBeenCalledWith({
        ...baseReportData,
        deniedAt: mockDate,
        imageName: "test-report.jpg",
      });

      (Date.prototype.toISOString as jest.Mock).mockRestore();
    });

    it("should fall back to default image name when path lacks filename", async () => {
      const mockDate = "2025-11-18T11:00:00.000Z";
      jest.spyOn(Date.prototype, "toISOString").mockReturnValue(mockDate);
      const noNameReport = {
        ...baseReportData,
        imagePath: "",
      };

      await collections.logDenial(noNameReport as any);

      expect(mockCollection.add).toHaveBeenCalledWith({
        ...noNameReport,
        deniedAt: mockDate,
        imageName: "image",
      });

      (Date.prototype.toISOString as jest.Mock).mockRestore();
    });

    it("should throw and log error when Firestore add fails", async () => {
      const logger = require("firebase-functions/logger");
      const firestoreError = new Error("Firestore write failed");
      mockCollection.add.mockRejectedValueOnce(firestoreError);

      await expect(
        collections.logDenial(baseReportData as any)
      ).rejects.toThrow("Firestore write failed");

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to create denial log:",
        expect.objectContaining({
          verifierUid: baseReportData.verifierUid,
        })
      );
    });
  });


  describe("Integration with logging", () => {
    it("should log appropriate messages during successful operations", async () => {
      // Arrange
      const logger = require("firebase-functions/logger");
      const reportData = {
        reportId: "test-report-123",
        verifierUid: "verifier-uid-456",
        verifierEmail: "verifier@example.com",
        reportAddress: "123 Test Street",
      };

      // Act
      await collections.logVerification(reportData);

      // Assert
      expect(logger.info).toHaveBeenCalledWith("Created verification log:", {
        reportId: reportData.reportId,
        verifierUid: reportData.verifierUid,
      });
    });

    it("should log errors appropriately", async () => {
      // Arrange
      const logger = require("firebase-functions/logger");
      const reportData = {
        reportId: "test-report-123",
        verifierUid: "verifier-uid-456",
        verifierEmail: "verifier@example.com",
        reportAddress: "123 Test Street",
      };
      const error = new Error("Firestore error");
      mockCollection.add.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(collections.logVerification(reportData)).rejects.toThrow(
        "Firestore error"
      );
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to create verification log:",
        {
          reportId: reportData.reportId,
          error: error,
          verifierUid: reportData.verifierUid,
        }
      );
    });
  });
});
