import { ImageStorage } from "../../database/ImageStorage";
import { Bucket, File } from "@google-cloud/storage";

// Mock firebase-functions/logger
jest.mock("firebase-functions/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock crypto for UUID generation
jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "mock-uuid-token-12345"),
}));

describe("ImageStorage - Integration Tests", () => {
  let imageStorage: ImageStorage;
  let mockBucket: jest.Mocked<Bucket>;
  let mockFile: jest.Mocked<File>;
  let mockSourceFile: jest.Mocked<File>;
  let mockDestinationFile: jest.Mocked<File>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock File objects
    mockFile = {
      name: "test-file.jpg",
      exists: jest.fn().mockResolvedValue([true]),
      copy: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      getMetadata: jest.fn().mockResolvedValue([{ metadata: {} }]),
      setMetadata: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockSourceFile = {
      name: "source-file.jpg",
      exists: jest.fn().mockResolvedValue([true]),
      copy: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      getMetadata: jest.fn().mockResolvedValue([{ metadata: {} }]),
      setMetadata: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockDestinationFile = {
      name: "destination-file.jpg",
      exists: jest.fn().mockResolvedValue([true]),
      copy: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      getMetadata: jest.fn().mockResolvedValue([{ metadata: {} }]),
      setMetadata: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Create mock Bucket
    mockBucket = {
      name: "test-bucket.appspot.com",
      file: jest.fn(),
    } as any;

    // Configure bucket.file() to return appropriate mock files
    mockBucket.file.mockImplementation((path: string) => {
      if (path.includes("source") || path === "reports/pending/test.jpg") {
        return mockSourceFile;
      } else if (
        path.includes("destination") ||
        path === "reports/verified/test/test.jpg"
      ) {
        return mockDestinationFile;
      }
      return mockFile;
    });

    // Initialize ImageStorage with mocked bucket
    imageStorage = new ImageStorage(mockBucket);
  });

  describe("fileExists", () => {
    it("should return true when file exists", async () => {
      // Arrange
      (mockFile.exists as jest.Mock).mockResolvedValueOnce([true]);
      mockBucket.file.mockReturnValue(mockFile);

      // Act
      const result = await imageStorage.fileExists("test-file.jpg");

      // Assert
      expect(result).toBe(true);
      expect(mockBucket.file).toHaveBeenCalledWith("test-file.jpg");
      expect(mockFile.exists).toHaveBeenCalled();
    });

    it("should return false when file does not exist", async () => {
      // Arrange
      (mockFile.exists as jest.Mock).mockResolvedValueOnce([false]);
      mockBucket.file.mockReturnValue(mockFile);

      // Act
      const result = await imageStorage.fileExists("nonexistent-file.jpg");

      // Assert
      expect(result).toBe(false);
      expect(mockBucket.file).toHaveBeenCalledWith("nonexistent-file.jpg");
      expect(mockFile.exists).toHaveBeenCalled();
    });

    it("should return false and log error when exists() throws", async () => {
      // Arrange
      const error = new Error("Storage error");
      (mockFile.exists as jest.Mock).mockRejectedValueOnce(error);
      mockBucket.file.mockReturnValue(mockFile);
      const logger = require("firebase-functions/logger");

      // Act
      const result = await imageStorage.fileExists("error-file.jpg");

      // Assert
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        "Error checking file existence:",
        {
          filePath: "error-file.jpg",
          error,
        }
      );
    });
  });

  describe("copyFile", () => {
    it("should successfully copy file from source to destination", async () => {
      // Arrange
      const sourcePath = "source/test.jpg";
      const destinationPath = "destination/test.jpg";
      (mockSourceFile.copy as jest.Mock).mockResolvedValueOnce(undefined);
      const logger = require("firebase-functions/logger");

      // Act
      const result = await imageStorage.copyFile(sourcePath, destinationPath);

      // Assert
      expect(result).toBe(mockDestinationFile);
      expect(mockBucket.file).toHaveBeenCalledWith(sourcePath);
      expect(mockBucket.file).toHaveBeenCalledWith(destinationPath);
      expect(mockSourceFile.copy).toHaveBeenCalledWith(mockDestinationFile);
      expect(logger.info).toHaveBeenCalledWith("File copied successfully:", {
        source: sourcePath,
        destination: destinationPath,
      });
    });

    it("should throw error when copy operation fails", async () => {
      // Arrange
      const sourcePath = "source/test.jpg";
      const destinationPath = "destination/test.jpg";
      const error = new Error("Copy failed");
      (mockSourceFile.copy as jest.Mock).mockRejectedValueOnce(error);

      // Act & Assert
      await expect(
        imageStorage.copyFile(sourcePath, destinationPath)
      ).rejects.toThrow("Copy failed");
      expect(mockSourceFile.copy).toHaveBeenCalledWith(mockDestinationFile);
    });
  });

  describe("deleteFile", () => {
    it("should successfully delete file", async () => {
      // Arrange
      const filePath = "test-file.jpg";
      (mockFile.delete as jest.Mock).mockResolvedValueOnce(undefined);
      mockBucket.file.mockReturnValue(mockFile);
      const logger = require("firebase-functions/logger");

      // Act
      await imageStorage.deleteFile(filePath);

      // Assert
      expect(mockBucket.file).toHaveBeenCalledWith(filePath);
      expect(mockFile.delete).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith("File deleted successfully:", {
        filePath,
      });
    });

    it("should log error and rethrow when delete fails", async () => {
      // Arrange
      const filePath = "test-file.jpg";
      const error = new Error("Delete failed");
      (mockFile.delete as jest.Mock).mockRejectedValueOnce(error);
      mockBucket.file.mockReturnValue(mockFile);
      const logger = require("firebase-functions/logger");

      // Act & Assert
      await expect(imageStorage.deleteFile(filePath)).rejects.toThrow(
        "Delete failed"
      );
      expect(logger.error).toHaveBeenCalledWith("Error deleting file:", {
        filePath,
        error,
      });
    });
  });

  describe("getOrCreateDownloadToken", () => {
    it("should return existing download token when present", async () => {
      // Arrange
      const existingToken = "existing-token-123";
      (mockFile.getMetadata as jest.Mock).mockResolvedValueOnce([
        {
          metadata: {
            firebaseStorageDownloadTokens: existingToken,
          },
        },
      ]);

      // Act
      const result = await imageStorage.getOrCreateDownloadToken(mockFile);

      // Assert
      expect(result).toBe(existingToken);
      expect(mockFile.getMetadata).toHaveBeenCalled();
      expect(mockFile.setMetadata).not.toHaveBeenCalled();
    });

    it("should generate and set new token when none exists", async () => {
      // Arrange
      const expectedToken = "mock-uuid-token-12345";
      (mockFile.getMetadata as jest.Mock).mockResolvedValueOnce([
        { metadata: {} },
      ]);
      (mockFile.setMetadata as jest.Mock).mockResolvedValueOnce(undefined);
      const logger = require("firebase-functions/logger");

      // Act
      const result = await imageStorage.getOrCreateDownloadToken(mockFile);

      // Assert
      expect(result).toBe(expectedToken);
      expect(mockFile.setMetadata).toHaveBeenCalledWith({
        metadata: {
          firebaseStorageDownloadTokens: expectedToken,
        },
      });
      expect(logger.info).toHaveBeenCalledWith(
        "Generated new download token for file:",
        {
          filePath: mockFile.name,
          token: expectedToken,
        }
      );
    });

    it("should generate new token when firebaseStorageDownloadTokens is null", async () => {
      // Arrange
      const expectedToken = "mock-uuid-token-12345";
      (mockFile.getMetadata as jest.Mock).mockResolvedValueOnce([
        {
          metadata: {
            firebaseStorageDownloadTokens: null,
          },
        },
      ]);
      (mockFile.setMetadata as jest.Mock).mockResolvedValueOnce(undefined);

      // Act
      const result = await imageStorage.getOrCreateDownloadToken(mockFile);

      // Assert
      expect(result).toBe(expectedToken);
      expect(mockFile.setMetadata).toHaveBeenCalledWith({
        metadata: {
          firebaseStorageDownloadTokens: expectedToken,
        },
      });
    });

    it("should generate new token when metadata is undefined", async () => {
      // Arrange
      const expectedToken = "mock-uuid-token-12345";
      (mockFile.getMetadata as jest.Mock).mockResolvedValueOnce([{}]);
      (mockFile.setMetadata as jest.Mock).mockResolvedValueOnce(undefined);

      // Act
      const result = await imageStorage.getOrCreateDownloadToken(mockFile);

      // Assert
      expect(result).toBe(expectedToken);
      expect(mockFile.setMetadata).toHaveBeenCalledWith({
        metadata: {
          firebaseStorageDownloadTokens: expectedToken,
        },
      });
    });
  });

  describe("constructDownloadUrl", () => {
    it("should construct proper Firebase Storage download URL", () => {
      // Arrange
      const filePath = "reports/verified/test/image.jpg";
      const downloadToken = "test-token-123";
      const expectedUrl = `https://firebasestorage.googleapis.com/v0/b/test-bucket.appspot.com/o/reports%2Fverified%2Ftest%2Fimage.jpg?alt=media&token=test-token-123`;

      // Act
      const result = imageStorage.constructDownloadUrl(filePath, downloadToken);

      // Assert
      expect(result).toBe(expectedUrl);
    });

    it("should properly encode special characters in file path", () => {
      // Arrange
      const filePath = "reports/test file & special chars.jpg";
      const downloadToken = "token-123";
      const expectedUrl = `https://firebasestorage.googleapis.com/v0/b/test-bucket.appspot.com/o/reports%2Ftest%20file%20%26%20special%20chars.jpg?alt=media&token=token-123`;

      // Act
      const result = imageStorage.constructDownloadUrl(filePath, downloadToken);

      // Assert
      expect(result).toBe(expectedUrl);
    });
  });

  describe("getBucketName", () => {
    it("should return the bucket name", () => {
      // Act
      const result = imageStorage.getBucketName();

      // Assert
      expect(result).toBe("test-bucket.appspot.com");
    });
  });

  describe("moveImageAndGenerateUrl", () => {
    const sourcePath = "reports/pending/test.jpg";
    const destinationPath = "reports/verified/test/test.jpg";

    it("should successfully move image and generate URL", async () => {
      // Arrange
      const expectedToken = "mock-uuid-token-12345";
      const expectedUrl = `https://firebasestorage.googleapis.com/v0/b/test-bucket.appspot.com/o/reports%2Fverified%2Ftest%2Ftest.jpg?alt=media&token=${expectedToken}`;

      // Mock file existence check
      (mockSourceFile.exists as jest.Mock).mockResolvedValueOnce([true]);

      // Mock copy operation
      (mockSourceFile.copy as jest.Mock).mockResolvedValueOnce(undefined);

      // Mock token generation
      (mockDestinationFile.getMetadata as jest.Mock).mockResolvedValueOnce([
        { metadata: {} },
      ]);
      (mockDestinationFile.setMetadata as jest.Mock).mockResolvedValueOnce(
        undefined
      );

      // Mock delete operation
      (mockSourceFile.delete as jest.Mock).mockResolvedValueOnce(undefined);

      // Act
      const result = await imageStorage.moveImageAndGenerateUrl(
        sourcePath,
        destinationPath
      );

      // Assert
      expect(result.imageUrl).toBe(expectedUrl);
      expect(result.file).toBe(mockDestinationFile);

      // Verify all operations were called in correct order
      expect(mockSourceFile.exists).toHaveBeenCalled();
      expect(mockSourceFile.copy).toHaveBeenCalledWith(mockDestinationFile);
      expect(mockDestinationFile.getMetadata).toHaveBeenCalled();
      expect(mockDestinationFile.setMetadata).toHaveBeenCalled();
      expect(mockSourceFile.delete).toHaveBeenCalled();
    });

    it("should throw error when source file does not exist", async () => {
      // Arrange
      (mockSourceFile.exists as jest.Mock).mockResolvedValueOnce([false]);

      // Act & Assert
      await expect(
        imageStorage.moveImageAndGenerateUrl(sourcePath, destinationPath)
      ).rejects.toThrow(`Source file not found: ${sourcePath}`);

      // Verify no other operations were called
      expect(mockSourceFile.copy).not.toHaveBeenCalled();
      expect(mockSourceFile.delete).not.toHaveBeenCalled();
    });

    it("should handle error during copy operation", async () => {
      // Arrange
      (mockSourceFile.exists as jest.Mock).mockResolvedValueOnce([true]);
      (mockSourceFile.copy as jest.Mock).mockRejectedValueOnce(
        new Error("Copy failed")
      );

      // Act & Assert
      await expect(
        imageStorage.moveImageAndGenerateUrl(sourcePath, destinationPath)
      ).rejects.toThrow("Copy failed");

      // Verify delete was not called since copy failed
      expect(mockSourceFile.delete).not.toHaveBeenCalled();
    });

    it("should handle error during token generation", async () => {
      // Arrange
      (mockSourceFile.exists as jest.Mock).mockResolvedValueOnce([true]);
      (mockSourceFile.copy as jest.Mock).mockResolvedValueOnce(undefined);
      (mockDestinationFile.getMetadata as jest.Mock).mockRejectedValueOnce(
        new Error("Metadata failed")
      );

      // Act & Assert
      await expect(
        imageStorage.moveImageAndGenerateUrl(sourcePath, destinationPath)
      ).rejects.toThrow("Metadata failed");

      // Verify delete was not called since token generation failed
      expect(mockSourceFile.delete).not.toHaveBeenCalled();
    });

    it("should handle error during delete operation", async () => {
      // Arrange
      (mockSourceFile.exists as jest.Mock).mockResolvedValueOnce([true]);
      (mockSourceFile.copy as jest.Mock).mockResolvedValueOnce(undefined);
      (mockDestinationFile.getMetadata as jest.Mock).mockResolvedValueOnce([
        { metadata: {} },
      ]);
      (mockDestinationFile.setMetadata as jest.Mock).mockResolvedValueOnce(
        undefined
      );
      (mockSourceFile.delete as jest.Mock).mockRejectedValueOnce(
        new Error("Delete failed")
      );

      // Act & Assert
      await expect(
        imageStorage.moveImageAndGenerateUrl(sourcePath, destinationPath)
      ).rejects.toThrow("Delete failed");

      // Verify that copy and token generation succeeded before delete failed
      expect(mockSourceFile.copy).toHaveBeenCalled();
      expect(mockDestinationFile.setMetadata).toHaveBeenCalled();
    });

    it("should work with existing download token", async () => {
      // Arrange
      const existingToken = "existing-token-456";
      const expectedUrl = `https://firebasestorage.googleapis.com/v0/b/test-bucket.appspot.com/o/reports%2Fverified%2Ftest%2Ftest.jpg?alt=media&token=${existingToken}`;

      (mockSourceFile.exists as jest.Mock).mockResolvedValueOnce([true]);
      (mockSourceFile.copy as jest.Mock).mockResolvedValueOnce(undefined);
      (mockDestinationFile.getMetadata as jest.Mock).mockResolvedValueOnce([
        {
          metadata: {
            firebaseStorageDownloadTokens: existingToken,
          },
        },
      ]);
      (mockSourceFile.delete as jest.Mock).mockResolvedValueOnce(undefined);

      // Act
      const result = await imageStorage.moveImageAndGenerateUrl(
        sourcePath,
        destinationPath
      );

      // Assert
      expect(result.imageUrl).toBe(expectedUrl);
      expect(result.file).toBe(mockDestinationFile);

      // Verify setMetadata was not called since token already existed
      expect(mockDestinationFile.setMetadata).not.toHaveBeenCalled();
    });
  });

  describe("moveImageToVerified", () => {
    const reportId = "test-report-123";
    const mockReport = {
      imagePath: "reports/pending/original-image.jpg",
      address: "123 Test Street",
      lat: 40.7128,
      lng: -74.006,
    };

    beforeEach(() => {
      // Reset file mocks for each test
      jest.clearAllMocks();

      // Configure bucket.file() to return appropriate mock files for moveImageToVerified
      mockBucket.file.mockImplementation((path: string) => {
        if (path === mockReport.imagePath || path.includes("pending")) {
          return mockSourceFile;
        } else if (path.includes("verified")) {
          return mockDestinationFile;
        }
        return mockFile;
      });

      // Set up default successful mocks
      (mockSourceFile.exists as jest.Mock).mockResolvedValue([true]);
      (mockSourceFile.copy as jest.Mock).mockResolvedValue(undefined);
      (mockSourceFile.delete as jest.Mock).mockResolvedValue(undefined);
      (mockDestinationFile.getMetadata as jest.Mock).mockResolvedValue([
        { metadata: {} },
      ]);
      (mockDestinationFile.setMetadata as jest.Mock).mockResolvedValue(
        undefined
      );
    });

    it("should successfully move image to verified location and return URL", async () => {
      // Arrange
      const expectedToken = "mock-uuid-token-12345";
      const expectedUrl = `https://firebasestorage.googleapis.com/v0/b/test-bucket.appspot.com/o/reports%2Fverified%2F${reportId}%2Foriginal-image.jpg?alt=media&token=${expectedToken}`;

      // Act
      const result = await imageStorage.moveImageToVerified(
        mockReport,
        reportId
      );

      // Assert
      expect(result.imageUrl).toBe(expectedUrl);

      // Verify the correct paths were used
      expect(mockBucket.file).toHaveBeenCalledWith(mockReport.imagePath);
      expect(mockBucket.file).toHaveBeenCalledWith(
        `reports/verified/${reportId}/original-image.jpg`
      );

      // Verify the complete workflow was executed
      expect(mockSourceFile.exists).toHaveBeenCalled();
      expect(mockSourceFile.copy).toHaveBeenCalledWith(mockDestinationFile);
      expect(mockDestinationFile.setMetadata).toHaveBeenCalled();
      expect(mockSourceFile.delete).toHaveBeenCalled();
    });

    it("should handle image paths with different file extensions", async () => {
      // Arrange
      const reportWithPng = {
        ...mockReport,
        imagePath: "reports/pending/test-image.png",
      };
      const expectedUrl = `https://firebasestorage.googleapis.com/v0/b/test-bucket.appspot.com/o/reports%2Fverified%2F${reportId}%2Ftest-image.png?alt=media&token=mock-uuid-token-12345`;

      // Act
      const result = await imageStorage.moveImageToVerified(
        reportWithPng,
        reportId
      );

      // Assert
      expect(result.imageUrl).toBe(expectedUrl);
      expect(mockBucket.file).toHaveBeenCalledWith(
        `reports/verified/${reportId}/test-image.png`
      );
    });

    it("should handle image paths with nested directories", async () => {
      // Arrange
      const reportWithNestedPath = {
        ...mockReport,
        imagePath: "reports/pending/subfolder/nested-image.jpg",
      };
      const expectedUrl = `https://firebasestorage.googleapis.com/v0/b/test-bucket.appspot.com/o/reports%2Fverified%2F${reportId}%2Fnested-image.jpg?alt=media&token=mock-uuid-token-12345`;

      // Act
      const result = await imageStorage.moveImageToVerified(
        reportWithNestedPath,
        reportId
      );

      // Assert
      expect(result.imageUrl).toBe(expectedUrl);
      expect(mockBucket.file).toHaveBeenCalledWith(
        `reports/verified/${reportId}/nested-image.jpg`
      );
    });

    it("should use default filename when imagePath has no filename", async () => {
      // Arrange
      const reportWithInvalidPath = {
        ...mockReport,
        imagePath: "reports/pending/",
      };
      const expectedUrl = `https://firebasestorage.googleapis.com/v0/b/test-bucket.appspot.com/o/reports%2Fverified%2F${reportId}%2Fimage?alt=media&token=mock-uuid-token-12345`;

      // Act
      const result = await imageStorage.moveImageToVerified(
        reportWithInvalidPath,
        reportId
      );

      // Assert
      expect(result.imageUrl).toBe(expectedUrl);
      expect(mockBucket.file).toHaveBeenCalledWith(
        `reports/verified/${reportId}/image`
      );
    });

    it("should handle empty imagePath gracefully", async () => {
      // Arrange
      const reportWithEmptyPath = {
        ...mockReport,
        imagePath: "",
      };
      const expectedUrl = `https://firebasestorage.googleapis.com/v0/b/test-bucket.appspot.com/o/reports%2Fverified%2F${reportId}%2Fimage?alt=media&token=mock-uuid-token-12345`;

      // Act
      const result = await imageStorage.moveImageToVerified(
        reportWithEmptyPath,
        reportId
      );

      // Assert
      expect(result.imageUrl).toBe(expectedUrl);
      expect(mockBucket.file).toHaveBeenCalledWith(
        `reports/verified/${reportId}/image`
      );
    });

    it("should work with existing download token", async () => {
      // Arrange - Reset mocks and set up existing token
      jest.clearAllMocks();
      mockBucket.file.mockImplementation((path: string) => {
        if (path === mockReport.imagePath) return mockSourceFile;
        if (path.includes("verified")) return mockDestinationFile;
        return mockFile;
      });

      const existingToken = "existing-token-789";
      (mockSourceFile.exists as jest.Mock).mockResolvedValueOnce([true]);
      (mockSourceFile.copy as jest.Mock).mockResolvedValueOnce(undefined);
      (mockSourceFile.delete as jest.Mock).mockResolvedValueOnce(undefined);
      (mockDestinationFile.getMetadata as jest.Mock).mockResolvedValueOnce([
        {
          metadata: {
            firebaseStorageDownloadTokens: existingToken,
          },
        },
      ]);
      const expectedUrl = `https://firebasestorage.googleapis.com/v0/b/test-bucket.appspot.com/o/reports%2Fverified%2F${reportId}%2Foriginal-image.jpg?alt=media&token=${existingToken}`;

      // Act
      const result = await imageStorage.moveImageToVerified(
        mockReport,
        reportId
      );

      // Assert
      expect(result.imageUrl).toBe(expectedUrl);
      expect(mockDestinationFile.setMetadata).not.toHaveBeenCalled();
    });

    it("should propagate error when source file does not exist", async () => {
      // Arrange - Reset mocks and set failure condition
      jest.clearAllMocks();
      mockBucket.file.mockImplementation((path: string) => {
        if (path === mockReport.imagePath) return mockSourceFile;
        if (path.includes("verified")) return mockDestinationFile;
        return mockFile;
      });
      (mockSourceFile.exists as jest.Mock).mockResolvedValueOnce([false]);

      // Act & Assert
      await expect(
        imageStorage.moveImageToVerified(mockReport, reportId)
      ).rejects.toThrow(`Source file not found: ${mockReport.imagePath}`);

      // Verify no other operations were attempted
      expect(mockSourceFile.copy).not.toHaveBeenCalled();
      expect(mockSourceFile.delete).not.toHaveBeenCalled();
    });

    it("should propagate error when copy operation fails", async () => {
      // Arrange - Reset mocks and set failure condition
      jest.clearAllMocks();
      mockBucket.file.mockImplementation((path: string) => {
        if (path === mockReport.imagePath) return mockSourceFile;
        if (path.includes("verified")) return mockDestinationFile;
        return mockFile;
      });
      (mockSourceFile.exists as jest.Mock).mockResolvedValueOnce([true]);
      const copyError = new Error("Failed to copy file to verified location");
      (mockSourceFile.copy as jest.Mock).mockRejectedValueOnce(copyError);

      // Act & Assert
      await expect(
        imageStorage.moveImageToVerified(mockReport, reportId)
      ).rejects.toThrow("Failed to copy file to verified location");

      // Verify delete was not called since copy failed
      expect(mockSourceFile.delete).not.toHaveBeenCalled();
    });

    it("should propagate error when token generation fails", async () => {
      // Arrange - Reset mocks and set failure condition
      jest.clearAllMocks();
      mockBucket.file.mockImplementation((path: string) => {
        if (path === mockReport.imagePath) return mockSourceFile;
        if (path.includes("verified")) return mockDestinationFile;
        return mockFile;
      });
      (mockSourceFile.exists as jest.Mock).mockResolvedValueOnce([true]);
      (mockSourceFile.copy as jest.Mock).mockResolvedValueOnce(undefined);
      const tokenError = new Error("Failed to generate download token");
      (mockDestinationFile.getMetadata as jest.Mock).mockRejectedValueOnce(
        tokenError
      );

      // Act & Assert
      await expect(
        imageStorage.moveImageToVerified(mockReport, reportId)
      ).rejects.toThrow("Failed to generate download token");
    });

    it("should propagate error when metadata update fails", async () => {
      // Arrange - Reset mocks and set failure condition
      jest.clearAllMocks();
      mockBucket.file.mockImplementation((path: string) => {
        if (path === mockReport.imagePath) return mockSourceFile;
        if (path.includes("verified")) return mockDestinationFile;
        return mockFile;
      });
      (mockSourceFile.exists as jest.Mock).mockResolvedValueOnce([true]);
      (mockSourceFile.copy as jest.Mock).mockResolvedValueOnce(undefined);
      (mockDestinationFile.getMetadata as jest.Mock).mockResolvedValueOnce([
        { metadata: {} },
      ]);
      const metadataError = new Error("Failed to update metadata");
      (mockDestinationFile.setMetadata as jest.Mock).mockRejectedValueOnce(
        metadataError
      );

      // Act & Assert
      await expect(
        imageStorage.moveImageToVerified(mockReport, reportId)
      ).rejects.toThrow("Failed to update metadata");
    });

    it("should propagate error when delete operation fails", async () => {
      // Arrange - Reset mocks and set failure condition
      jest.clearAllMocks();
      mockBucket.file.mockImplementation((path: string) => {
        if (path === mockReport.imagePath) return mockSourceFile;
        if (path.includes("verified")) return mockDestinationFile;
        return mockFile;
      });
      (mockSourceFile.exists as jest.Mock).mockResolvedValueOnce([true]);
      (mockSourceFile.copy as jest.Mock).mockResolvedValueOnce(undefined);
      (mockDestinationFile.getMetadata as jest.Mock).mockResolvedValueOnce([
        { metadata: {} },
      ]);
      (mockDestinationFile.setMetadata as jest.Mock).mockResolvedValueOnce(
        undefined
      );
      const deleteError = new Error("Failed to delete source file");
      (mockSourceFile.delete as jest.Mock).mockRejectedValueOnce(deleteError);

      // Act & Assert
      await expect(
        imageStorage.moveImageToVerified(mockReport, reportId)
      ).rejects.toThrow("Failed to delete source file");

      // Verify that copy and token generation succeeded before delete failed
      expect(mockSourceFile.copy).toHaveBeenCalled();
      expect(mockDestinationFile.setMetadata).toHaveBeenCalled();
    });

    it("should handle special characters in reportId", async () => {
      // Arrange
      const specialReportId = "test-report-with-special-chars_123!@#";
      const expectedUrl = `https://firebasestorage.googleapis.com/v0/b/test-bucket.appspot.com/o/reports%2Fverified%2F${encodeURIComponent(
        specialReportId
      )}%2Foriginal-image.jpg?alt=media&token=mock-uuid-token-12345`;

      // Act
      const result = await imageStorage.moveImageToVerified(
        mockReport,
        specialReportId
      );

      // Assert
      expect(result.imageUrl).toBe(expectedUrl);
      expect(mockBucket.file).toHaveBeenCalledWith(
        `reports/verified/${specialReportId}/original-image.jpg`
      );
    });

    it("should handle special characters in filename", async () => {
      // Arrange
      const reportWithSpecialChars = {
        ...mockReport,
        imagePath: "reports/pending/image with spaces & symbols.jpg",
      };
      const expectedUrl = `https://firebasestorage.googleapis.com/v0/b/test-bucket.appspot.com/o/reports%2Fverified%2F${reportId}%2Fimage%20with%20spaces%20%26%20symbols.jpg?alt=media&token=mock-uuid-token-12345`;

      // Act
      const result = await imageStorage.moveImageToVerified(
        reportWithSpecialChars,
        reportId
      );

      // Assert
      expect(result.imageUrl).toBe(expectedUrl);
      expect(mockBucket.file).toHaveBeenCalledWith(
        `reports/verified/${reportId}/image with spaces & symbols.jpg`
      );
    });

    it("should maintain original file extension", async () => {
      // Test cases for different file extensions
      const testCases = [
        { ext: "jpg", expected: "jpg" },
        { ext: "jpeg", expected: "jpeg" },
        { ext: "png", expected: "png" },
        { ext: "gif", expected: "gif" },
        { ext: "webp", expected: "webp" },
        { ext: "bmp", expected: "bmp" },
      ];

      for (const testCase of testCases) {
        // Arrange
        const reportWithExtension = {
          ...mockReport,
          imagePath: `reports/pending/test-image.${testCase.ext}`,
        };

        // Act
        await imageStorage.moveImageToVerified(reportWithExtension, reportId);

        // Assert
        expect(mockBucket.file).toHaveBeenCalledWith(
          `reports/verified/${reportId}/test-image.${testCase.expected}`
        );
      }
    });

    it("should handle concurrent calls with different report IDs", async () => {
      // Arrange
      const reportId1 = "report-1";
      const reportId2 = "report-2";
      const report1 = {
        ...mockReport,
        imagePath: "reports/pending/image1.jpg",
      };
      const report2 = {
        ...mockReport,
        imagePath: "reports/pending/image2.jpg",
      };

      // Act - Make concurrent calls
      const [result1, result2] = await Promise.all([
        imageStorage.moveImageToVerified(report1, reportId1),
        imageStorage.moveImageToVerified(report2, reportId2),
      ]);

      // Assert
      expect(result1.imageUrl).toContain(reportId1);
      expect(result2.imageUrl).toContain(reportId2);
      expect(result1.imageUrl).toContain("image1.jpg");
      expect(result2.imageUrl).toContain("image2.jpg");
    });

    it("should validate that the method uses moveImageAndGenerateUrl internally", async () => {
      // Arrange
      const moveImageAndGenerateUrlSpy = jest.spyOn(
        imageStorage,
        "moveImageAndGenerateUrl"
      );

      // Act
      await imageStorage.moveImageToVerified(mockReport, reportId);

      // Assert
      expect(moveImageAndGenerateUrlSpy).toHaveBeenCalledWith(
        mockReport.imagePath,
        `reports/verified/${reportId}/original-image.jpg`
      );

      moveImageAndGenerateUrlSpy.mockRestore();
    });
  });

  describe("moveImageToDenied", () => {
    const report = {
      imagePath: "reports/pending/user-upload.jpg",
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockBucket.file.mockImplementation((path: string) => {
        if (path === report.imagePath) {
          return mockSourceFile;
        }
        if (path.includes("denied")) {
          return mockDestinationFile;
        }
        return mockFile;
      });

      (mockSourceFile.exists as jest.Mock).mockResolvedValue([true]);
      (mockSourceFile.copy as jest.Mock).mockResolvedValue(undefined);
      (mockSourceFile.delete as jest.Mock).mockResolvedValue(undefined);
    });

    it("should move image to denied folder and return new path", async () => {
      const result = await imageStorage.moveImageToDenied(report);

      expect(result).toBe("reports/denied/user-upload.jpg");
      expect(mockSourceFile.copy).toHaveBeenCalledWith(mockDestinationFile);
      expect(mockSourceFile.delete).toHaveBeenCalled();
    });

    it("should default filename when path missing segments", async () => {
      const namelessReport = { imagePath: "" };
      mockBucket.file.mockImplementation((path: string) => {
        if (path.includes("denied")) {
          return mockDestinationFile;
        }
        return mockSourceFile;
      });

      const result = await imageStorage.moveImageToDenied(namelessReport);

      expect(result).toBe("reports/denied/image");
    });

    it("should throw if source file does not exist", async () => {
      (mockSourceFile.exists as jest.Mock).mockResolvedValueOnce([false]);

      await expect(
        imageStorage.moveImageToDenied(report)
      ).rejects.toThrow("Source file not found: reports/pending/user-upload.jpg");
      expect(mockSourceFile.copy).not.toHaveBeenCalled();
    });

    it("should propagate errors from copy operation", async () => {
      const error = new Error("Copy failed");
      (mockSourceFile.copy as jest.Mock).mockRejectedValueOnce(error);

      await expect(
        imageStorage.moveImageToDenied(report)
      ).rejects.toThrow("Copy failed");
      expect(mockSourceFile.delete).not.toHaveBeenCalled();
    });

    it("should propagate errors from delete operation", async () => {
      const error = new Error("Delete failed");
      (mockSourceFile.delete as jest.Mock).mockRejectedValueOnce(error);

      await expect(
        imageStorage.moveImageToDenied(report)
      ).rejects.toThrow("Delete failed");
      expect(mockSourceFile.copy).toHaveBeenCalled();
    });
  });

//   describe("moveImageToDenied", () => {
//     const reportId = "test-report-456";
//     const mockReport = {
//       imagePath: "reports/pending/denied-image.jpg",
//       address: "456 Deny Street",
//       lat: 37.7749,
//       lng: -122.4194,
//     };

//     beforeEach(() => {
//       // Reset file mocks for each test
//       jest.clearAllMocks();

//       // Configure bucket.file() to return appropriate mock files for moveImageToDenied
//       mockBucket.file.mockImplementation((path: string) => {
//         if (path === mockReport.imagePath || path.includes("pending")) {
//           return mockSourceFile;
//         } else if (path.includes("denied")) {
//           return mockDestinationFile;
//         }
//         return mockFile;
//       });

//       // Set up default successful mocks
//       (mockSourceFile.exists as jest.Mock).mockResolvedValue([true]);
//       (mockSourceFile.copy as jest.Mock).mockResolvedValue(undefined);
//       (mockSourceFile.delete as jest.Mock).mockResolvedValue(undefined);
//     });

//     it("should successfully move image to denied location and return path", async () => {
//       // Arrange
//       const expectedPath = `reports/denied/${reportId}/denied-image.jpg`;

//       // Act
//       const result = await imageStorage.moveImageToDenied(mockReport, reportId);

//       // Assert
//       expect(result.imagePath).toBe(expectedPath);

//       // Verify the correct paths were used
//       expect(mockBucket.file).toHaveBeenCalledWith(mockReport.imagePath);
//       expect(mockBucket.file).toHaveBeenCalledWith(expectedPath);

//       // Verify the complete workflow was executed
//       expect(mockSourceFile.exists).toHaveBeenCalled();
//       expect(mockSourceFile.copy).toHaveBeenCalledWith(mockDestinationFile);
//       expect(mockSourceFile.delete).toHaveBeenCalled();
//     });

//     it("should handle image paths with different file extensions", async () => {
//       // Arrange
//       const reportWithPng = {
//         ...mockReport,
//         imagePath: "reports/pending/test-denied.png",
//       };
//       const expectedPath = `reports/denied/${reportId}/test-denied.png`;

//       // Act
//       const result = await imageStorage.moveImageToDenied(
//         reportWithPng,
//         reportId
//       );

//       // Assert
//       expect(result.imagePath).toBe(expectedPath);
//       expect(mockBucket.file).toHaveBeenCalledWith(expectedPath);
//     });

//     it("should handle image paths with nested directories", async () => {
//       // Arrange
//       const reportWithNestedPath = {
//         ...mockReport,
//         imagePath: "reports/pending/subfolder/nested-denied.jpg",
//       };
//       const expectedPath = `reports/denied/${reportId}/nested-denied.jpg`;

//       // Act
//       const result = await imageStorage.moveImageToDenied(
//         reportWithNestedPath,
//         reportId
//       );

//       // Assert
//       expect(result.imagePath).toBe(expectedPath);
//       expect(mockBucket.file).toHaveBeenCalledWith(expectedPath);
//     });

//     it("should use default filename when imagePath has no filename", async () => {
//       // Arrange
//       const reportWithInvalidPath = {
//         ...mockReport,
//         imagePath: "reports/pending/",
//       };
//       const expectedPath = `reports/denied/${reportId}/image`;

//       // Act
//       const result = await imageStorage.moveImageToDenied(
//         reportWithInvalidPath,
//         reportId
//       );

//       // Assert
//       expect(result.imagePath).toBe(expectedPath);
//       expect(mockBucket.file).toHaveBeenCalledWith(expectedPath);
//     });

//     it("should handle empty imagePath gracefully", async () => {
//       // Arrange
//       const reportWithEmptyPath = {
//         ...mockReport,
//         imagePath: "",
//       };
//       const expectedPath = `reports/denied/${reportId}/image`;

//       // Act
//       const result = await imageStorage.moveImageToDenied(
//         reportWithEmptyPath,
//         reportId
//       );

//       // Assert
//       expect(result.imagePath).toBe(expectedPath);
//       expect(mockBucket.file).toHaveBeenCalledWith(expectedPath);
//     });

//     it("should throw error when source file does not exist", async () => {
//       // Arrange - Reset mocks and set failure condition
//       jest.clearAllMocks();
//       mockBucket.file.mockImplementation((path: string) => {
//         if (path === mockReport.imagePath) return mockSourceFile;
//         if (path.includes("denied")) return mockDestinationFile;
//         return mockFile;
//       });
//       (mockSourceFile.exists as jest.Mock).mockResolvedValueOnce([false]);

//       // Act & Assert
//       await expect(
//         imageStorage.moveImageToDenied(mockReport, reportId)
//       ).rejects.toThrow(`Source file not found: ${mockReport.imagePath}`);

//       // Verify no other operations were attempted
//       expect(mockSourceFile.copy).not.toHaveBeenCalled();
//       expect(mockSourceFile.delete).not.toHaveBeenCalled();
//     });

//     it("should propagate error when copy operation fails", async () => {
//       // Arrange - Reset mocks and set failure condition
//       jest.clearAllMocks();
//       mockBucket.file.mockImplementation((path: string) => {
//         if (path === mockReport.imagePath) return mockSourceFile;
//         if (path.includes("denied")) return mockDestinationFile;
//         return mockFile;
//       });
//       (mockSourceFile.exists as jest.Mock).mockResolvedValueOnce([true]);
//       const copyError = new Error("Failed to copy file to denied location");
//       (mockSourceFile.copy as jest.Mock).mockRejectedValueOnce(copyError);

//       // Act & Assert
//       await expect(
//         imageStorage.moveImageToDenied(mockReport, reportId)
//       ).rejects.toThrow("Failed to copy file to denied location");

//       // Verify delete was not called since copy failed
//       expect(mockSourceFile.delete).not.toHaveBeenCalled();
//     });

//     it("should propagate error when delete operation fails", async () => {
//       // Arrange - Reset mocks and set failure condition
//       jest.clearAllMocks();
//       mockBucket.file.mockImplementation((path: string) => {
//         if (path === mockReport.imagePath) return mockSourceFile;
//         if (path.includes("denied")) return mockDestinationFile;
//         return mockFile;
//       });
//       (mockSourceFile.exists as jest.Mock).mockResolvedValueOnce([true]);
//       (mockSourceFile.copy as jest.Mock).mockResolvedValueOnce(undefined);
//       const deleteError = new Error("Failed to delete source file");
//       (mockSourceFile.delete as jest.Mock).mockRejectedValueOnce(deleteError);

//       // Act & Assert
//       await expect(
//         imageStorage.moveImageToDenied(mockReport, reportId)
//       ).rejects.toThrow("Failed to delete source file");

//       // Verify that copy succeeded before delete failed
//       expect(mockSourceFile.copy).toHaveBeenCalled();
//     });

//     it("should handle special characters in reportId", async () => {
//       // Arrange
//       const specialReportId = "denied-report-with-special-chars_456!@#";
//       const expectedPath = `reports/denied/${specialReportId}/denied-image.jpg`;

//       // Act
//       const result = await imageStorage.moveImageToDenied(
//         mockReport,
//         specialReportId
//       );

//       // Assert
//       expect(result.imagePath).toBe(expectedPath);
//       expect(mockBucket.file).toHaveBeenCalledWith(expectedPath);
//     });

//     it("should handle special characters in filename", async () => {
//       // Arrange
//       const reportWithSpecialChars = {
//         ...mockReport,
//         imagePath: "reports/pending/denied image with spaces & symbols.jpg",
//       };
//       const expectedPath = `reports/denied/${reportId}/denied image with spaces & symbols.jpg`;

//       // Act
//       const result = await imageStorage.moveImageToDenied(
//         reportWithSpecialChars,
//         reportId
//       );

//       // Assert
//       expect(result.imagePath).toBe(expectedPath);
//       expect(mockBucket.file).toHaveBeenCalledWith(expectedPath);
//     });

//     it("should maintain original file extension for denied reports", async () => {
//       // Test cases for different file extensions
//       const testCases = [
//         { ext: "jpg", expected: "jpg" },
//         { ext: "jpeg", expected: "jpeg" },
//         { ext: "png", expected: "png" },
//         { ext: "gif", expected: "gif" },
//         { ext: "webp", expected: "webp" },
//         { ext: "bmp", expected: "bmp" },
//       ];

//       for (const testCase of testCases) {
//         // Arrange
//         const reportWithExtension = {
//           ...mockReport,
//           imagePath: `reports/pending/denied-test.${testCase.ext}`,
//         };

//         // Act
//         await imageStorage.moveImageToDenied(reportWithExtension, reportId);

//         // Assert
//         expect(mockBucket.file).toHaveBeenCalledWith(
//           `reports/denied/${reportId}/denied-test.${testCase.expected}`
//         );
//       }
//     });

//     it("should handle concurrent calls with different report IDs", async () => {
//       // Arrange
//       const reportId1 = "denied-report-1";
//       const reportId2 = "denied-report-2";
//       const report1 = {
//         ...mockReport,
//         imagePath: "reports/pending/denied1.jpg",
//       };
//       const report2 = {
//         ...mockReport,
//         imagePath: "reports/pending/denied2.jpg",
//       };

//       // Act - Make concurrent calls
//       const [result1, result2] = await Promise.all([
//         imageStorage.moveImageToDenied(report1, reportId1),
//         imageStorage.moveImageToDenied(report2, reportId2),
//       ]);

//       // Assert
//       expect(result1.imagePath).toContain(reportId1);
//       expect(result2.imagePath).toContain(reportId2);
//       expect(result1.imagePath).toContain("denied1.jpg");
//       expect(result2.imagePath).toContain("denied2.jpg");
//     });

//     it("should not generate URL tokens (unlike moveImageToVerified)", async () => {
//       // Arrange & Act
//       await imageStorage.moveImageToDenied(mockReport, reportId);

//       // Assert - Verify no metadata operations for token generation
//       expect(mockDestinationFile.getMetadata).not.toHaveBeenCalled();
//       expect(mockDestinationFile.setMetadata).not.toHaveBeenCalled();

//       // Verify only file operations (exists, copy, delete) were performed
//       expect(mockSourceFile.exists).toHaveBeenCalled();
//       expect(mockSourceFile.copy).toHaveBeenCalled();
//       expect(mockSourceFile.delete).toHaveBeenCalled();
//     });

//     it("should validate that the method does NOT use moveImageAndGenerateUrl internally", async () => {
//       // Arrange
//       const moveImageAndGenerateUrlSpy = jest.spyOn(
//         imageStorage,
//         "moveImageAndGenerateUrl"
//       );

//       // Act
//       await imageStorage.moveImageToDenied(mockReport, reportId);

//       // Assert - Should not use the URL generation method
//       expect(moveImageAndGenerateUrlSpy).not.toHaveBeenCalled();

//       moveImageAndGenerateUrlSpy.mockRestore();
//     });
//   });

  describe("Integration with logging", () => {
    it("should log appropriate messages during successful operations", async () => {
      // Arrange
      const logger = require("firebase-functions/logger");
      const sourcePath = "reports/pending/test.jpg";
      const destinationPath = "reports/verified/test/test.jpg";

      (mockSourceFile.exists as jest.Mock).mockResolvedValueOnce([true]);
      (mockSourceFile.copy as jest.Mock).mockResolvedValueOnce(undefined);
      (mockDestinationFile.getMetadata as jest.Mock).mockResolvedValueOnce([
        { metadata: {} },
      ]);
      (mockDestinationFile.setMetadata as jest.Mock).mockResolvedValueOnce(
        undefined
      );
      (mockSourceFile.delete as jest.Mock).mockResolvedValueOnce(undefined);

      // Act
      await imageStorage.moveImageAndGenerateUrl(sourcePath, destinationPath);

      // Assert
      expect(logger.info).toHaveBeenCalledWith("File copied successfully:", {
        source: sourcePath,
        destination: destinationPath,
      });
      expect(logger.info).toHaveBeenCalledWith(
        "Generated new download token for file:",
        {
          filePath: mockDestinationFile.name,
          token: "mock-uuid-token-12345",
        }
      );
      expect(logger.info).toHaveBeenCalledWith("File deleted successfully:", {
        filePath: sourcePath,
      });
    });

    it("should log errors appropriately", async () => {
      // Arrange
      const logger = require("firebase-functions/logger");
      const filePath = "test-file.jpg";
      const error = new Error("Storage error");

      (mockFile.exists as jest.Mock).mockRejectedValueOnce(error);
      mockBucket.file.mockReturnValue(mockFile);

      // Act
      await imageStorage.fileExists(filePath);

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        "Error checking file existence:",
        {
          filePath,
          error,
        }
      );
    });
  });
});
