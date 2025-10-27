import { HttpsError } from "firebase-functions/v2/https";

// Mock Firebase Admin SDK - define mocks inline to avoid hoisting issues
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDoc = jest.fn(() => ({
  get: mockGet,
  set: mockSet,
}));
const mockCollection = jest.fn(() => ({
  doc: mockDoc,
}));
const mockRunTransaction = jest.fn();

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  database: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => ({
      collection: mockCollection,
      runTransaction: mockRunTransaction,
    })),
    {
      FieldValue: {
        serverTimestamp: jest.fn(() => "mock_timestamp"),
      },
      Timestamp: {
        fromMillis: jest.fn((millis: number) => ({
          _seconds: Math.floor(millis / 1000),
          _nanoseconds: (millis % 1000) * 1000000,
        })),
      },
    }
  ),
  credential: {
    applicationDefault: jest.fn(),
  },
}));

// Import after mocking
import { enforceDailyQuotaByIp } from "../../index";

// Mock logger
jest.mock("firebase-functions/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock environment variables
process.env.RATE_SALT = "test_integration_salt_12345";

describe("enforceDailyQuotaByIp Integration Tests", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup default mock implementations
    mockCollection.mockReturnValue({ doc: mockDoc });
    mockDoc.mockReturnValue({ get: mockGet, set: mockSet });
  });

  describe("Unknown IP Rejection", () => {
    it("should reject requests with unknown IP", async () => {
      const req = {
        headers: {},
        // No ip property
      };

      await expect(
        enforceDailyQuotaByIp(req as any, "test", 3)
      ).rejects.toThrow(HttpsError);

      await expect(
        enforceDailyQuotaByIp(req as any, "test", 3)
      ).rejects.toThrow(
        "Unable to determine client IP address. Request blocked for security."
      );

      // Verify no database operations were attempted
      expect(mockRunTransaction).not.toHaveBeenCalled();
      expect(mockCollection).not.toHaveBeenCalled();
    });

    it("should reject requests with null IP", async () => {
      const req = {
        headers: {},
        ip: null,
      };

      const error = await enforceDailyQuotaByIp(req as any, "test", 3).catch(
        (e) => e
      );
      expect(error).toBeInstanceOf(HttpsError);
      expect(error.code).toBe("failed-precondition");
      expect(error.message).toBe(
        "Unable to determine client IP address. Request blocked for security."
      );

      // Verify no database operations were attempted
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it("should reject requests with undefined IP", async () => {
      const req = {
        headers: { "x-forwarded-for": "" },
        ip: undefined,
      };

      await expect(
        enforceDailyQuotaByIp(req as any, "test", 3)
      ).rejects.toMatchObject({
        code: "failed-precondition",
        message:
          "Unable to determine client IP address. Request blocked for security.",
      });

      expect(mockRunTransaction).not.toHaveBeenCalled();
    });
  });

  describe("Valid IP Processing", () => {
    it("should allow first request from valid IP", async () => {
      const req = {
        headers: { "x-forwarded-for": "192.168.1.1" },
        ip: "127.0.0.1",
      };

      // Mock transaction that simulates no existing record
      mockRunTransaction.mockImplementation(async (callback) => {
        const mockTx = {
          get: jest.fn().mockResolvedValue({
            exists: false,
            data: () => ({}),
          }),
          set: jest.fn(),
        };
        await callback(mockTx);
      });

      await expect(
        enforceDailyQuotaByIp(req as any, "pin", 3)
      ).resolves.not.toThrow();

      // Verify database operations were called correctly
      expect(mockCollection).toHaveBeenCalledWith("rate_daily_ip");
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    });

    it("should allow request under limit", async () => {
      const req = {
        headers: { "x-forwarded-for": "192.168.1.100" },
        ip: "127.0.0.1",
      };

      const mockTxSet = jest.fn();

      // Mock transaction that simulates existing record with 2 requests today
      mockRunTransaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              date: new Date().toISOString().split("T")[0], // Today's date
              count: 2,
            }),
          }),
          set: mockTxSet,
        };
        await callback(mockTx);
      });

      await expect(
        enforceDailyQuotaByIp(req as any, "pin", 3)
      ).resolves.not.toThrow();

      // Verify the set was called to increment count
      expect(mockTxSet).toHaveBeenCalledWith(
        expect.anything(), // doc reference
        expect.objectContaining({
          count: 3,
          date: expect.any(String),
          updatedAt: "mock_timestamp",
        }),
        { merge: true }
      );
    });

    it("should block request at limit", async () => {
      const req = {
        headers: { "x-forwarded-for": "192.168.1.200" },
        ip: "127.0.0.1",
      };

      // Mock transaction that simulates existing record at limit
      mockRunTransaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              date: new Date().toISOString().split("T")[0], // Today's date
              count: 3,
            }),
          }),
          set: jest.fn(),
        };
        const result = await callback(mockTx);
        return result;
      });

      const isAboveLimit = await enforceDailyQuotaByIp(req as any, "pin", 3);
      expect(isAboveLimit).toBe(true);

      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    });

    it("should block request over limit", async () => {
      const req = {
        headers: { "x-forwarded-for": "192.168.1.201" },
        ip: "127.0.0.1",
      };

      // Mock transaction that simulates existing record over limit
      mockRunTransaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              date: new Date().toISOString().split("T")[0], // Today's date
              count: 5,
            }),
          }),
          set: jest.fn(),
        };
        const result = await callback(mockTx);
        return result;
      });

      const isAboveLimit = await enforceDailyQuotaByIp(req as any, "pin", 3);
      expect(isAboveLimit).toBe(true);
    });
  });

  // ============================ Date reset logic tests =============================
  // i honestly dont know why i have this? using TTL for cleanup.
  describe("Date Reset Logic", () => {
    it("should reset count for new day", async () => {
      const req = {
        headers: { "x-forwarded-for": "192.168.1.50" },
        ip: "127.0.0.1",
      };

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayString = yesterday.toISOString().split("T")[0];

      const mockTxSet = jest.fn();

      // Mock transaction that simulates old data from yesterday
      mockRunTransaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              date: yesterdayString,
              count: 3, // Was at limit yesterday
            }),
          }),
          set: mockTxSet,
        };
        await callback(mockTx);
      });

      await expect(
        enforceDailyQuotaByIp(req as any, "pin", 3)
      ).resolves.not.toThrow();

      // Verify count was reset to 1 for new day
      expect(mockTxSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          count: 1, // Reset from 3 to 1
          date: expect.any(String),
          updatedAt: "mock_timestamp",
        }),
        { merge: true }
      );

      // Verify the date is today
      const setCall = mockTxSet.mock.calls[0][1];
      expect(setCall.date).toBe(new Date().toISOString().split("T")[0]);
    });

    it("should handle missing date field", async () => {
      const req = {
        headers: { "x-forwarded-for": "192.168.1.51" },
        ip: "127.0.0.1",
      };

      const mockTxSet = jest.fn();

      // Mock transaction that simulates record without date field
      mockRunTransaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              count: 2,
              // No date field
            }),
          }),
          set: mockTxSet,
        };
        await callback(mockTx);
      });

      await expect(
        enforceDailyQuotaByIp(req as any, "pin", 3)
      ).resolves.not.toThrow();

      // Should treat as today and increment normally
      expect(mockTxSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          count: 3,
          date: new Date().toISOString().split("T")[0],
        }),
        { merge: true }
      );
    });
  });

  // =================================================================================

  describe("Custom Limits", () => {
    it("should respect custom limit of 1", async () => {
      const req = {
        headers: { "x-forwarded-for": "192.168.1.60" },
        ip: "127.0.0.1",
      };

      // Mock transaction that simulates existing record with 1 request
      mockRunTransaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              date: new Date().toISOString().split("T")[0],
              count: 1,
            }),
          }),
          set: jest.fn(),
        };
        const result = await callback(mockTx);
        return result;
      });

      const isAboveLimit = await enforceDailyQuotaByIp(req as any, "pin", 1);
      expect(isAboveLimit).toBe(true);
    });

    it("should respect custom limit of 10", async () => {
      const req = {
        headers: { "x-forwarded-for": "192.168.1.61" },
        ip: "127.0.0.1",
      };

      const mockTxSet = jest.fn();

      // Mock transaction that simulates existing record with 9 requests
      mockRunTransaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              date: new Date().toISOString().split("T")[0],
              count: 9,
            }),
          }),
          set: mockTxSet,
        };
        await callback(mockTx);
      });

      await expect(
        enforceDailyQuotaByIp(req as any, "pin", 10)
      ).resolves.not.toThrow();

      expect(mockTxSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          count: 10,
        }),
        { merge: true }
      );
    });
  });

  describe("Bucket Isolation", () => {
    it("should use correct document path with bucket and hashed IP", async () => {
      const req = {
        headers: { "x-forwarded-for": "192.168.1.70" },
        ip: "127.0.0.1",
      };

      // Mock transaction for successful case
      mockRunTransaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          get: jest.fn().mockResolvedValue({
            exists: false,
            data: () => ({}),
          }),
          set: jest.fn(),
        };
        await callback(mockTx);
      });

      await enforceDailyQuotaByIp(req as any, "test_bucket", 3);

      // Verify correct collection and document path
      expect(mockCollection).toHaveBeenCalledWith("rate_daily_ip");
      expect(mockDoc).toHaveBeenCalledWith(
        expect.stringMatching(/^test_bucket_[a-f0-9]{64}$/)
      );
    });

    it("should generate different documents for different buckets", async () => {
      const req = {
        headers: { "x-forwarded-for": "192.168.1.71" },
        ip: "127.0.0.1",
      };

      // Mock transaction for successful case
      mockRunTransaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          get: jest.fn().mockResolvedValue({
            exists: false,
            data: () => ({}),
          }),
          set: jest.fn(),
        };
        await callback(mockTx);
      });

      // Call with first bucket
      await enforceDailyQuotaByIp(req as any, "bucket1", 3);
      const firstCall = (mockDoc as jest.MockedFunction<any>).mock.calls[
        (mockDoc as jest.MockedFunction<any>).mock.calls.length - 1
      ][0];

      // Call with second bucket
      await enforceDailyQuotaByIp(req as any, "bucket2", 3);
      const secondCall = (mockDoc as jest.MockedFunction<any>).mock.calls[
        (mockDoc as jest.MockedFunction<any>).mock.calls.length - 1
      ][0];

      // Should generate different document paths
      expect(firstCall).not.toBe(secondCall);
      expect(firstCall).toMatch(/^bucket1_/);
      expect(secondCall).toMatch(/^bucket2_/);
    });
  });

  describe("IP Address Variations", () => {
    it("should handle IPv4 addresses", async () => {
      const req = {
        headers: { "x-forwarded-for": "203.0.113.1" },
        ip: "127.0.0.1",
      };

      mockRunTransaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          get: jest.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
          set: jest.fn(),
        };
        await callback(mockTx);
      });

      await expect(
        enforceDailyQuotaByIp(req as any, "pin", 3)
      ).resolves.not.toThrow();
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    });

    it("should handle IPv6 addresses", async () => {
      const req = {
        headers: {
          "x-forwarded-for": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        },
        ip: "127.0.0.1",
      };

      mockRunTransaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          get: jest.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
          set: jest.fn(),
        };
        await callback(mockTx);
      });

      await expect(
        enforceDailyQuotaByIp(req as any, "pin", 3)
      ).resolves.not.toThrow();
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple IPs in x-forwarded-for header", async () => {
      const req = {
        headers: { "x-forwarded-for": "203.0.113.1, 198.51.100.1, 192.0.2.1" },
        ip: "127.0.0.1",
      };

      mockRunTransaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          get: jest.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
          set: jest.fn(),
        };
        await callback(mockTx);
      });

      await expect(
        enforceDailyQuotaByIp(req as any, "pin", 3)
      ).resolves.not.toThrow();

      // Should use the first IP (203.0.113.1) and create a consistent hash
      expect(mockDoc).toHaveBeenCalledWith(
        expect.stringMatching(/^pin_[a-f0-9]{64}$/)
      );
    });
  });

  describe("Transaction Error Handling", () => {
    it("should propagate transaction errors", async () => {
      const req = {
        headers: { "x-forwarded-for": "192.168.1.80" },
        ip: "127.0.0.1",
      };

      // Mock transaction that throws an error
      const transactionError = new Error("Firestore transaction failed");
      mockRunTransaction.mockRejectedValue(transactionError);

      await expect(enforceDailyQuotaByIp(req as any, "pin", 3)).rejects.toThrow(
        "Firestore transaction failed"
      );

      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    });

    it("should handle document get errors", async () => {
      const req = {
        headers: { "x-forwarded-for": "192.168.1.81" },
        ip: "127.0.0.1",
      };

      // Mock transaction where get throws an error
      mockRunTransaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          get: jest.fn().mockRejectedValue(new Error("Document get failed")),
          set: jest.fn(),
        };
        await callback(mockTx);
      });

      await expect(enforceDailyQuotaByIp(req as any, "pin", 3)).rejects.toThrow(
        "Document get failed"
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty data object", async () => {
      const req = {
        headers: { "x-forwarded-for": "192.168.1.90" },
        ip: "127.0.0.1",
      };

      const mockTxSet = jest.fn();

      mockRunTransaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({}), // Empty data object
          }),
          set: mockTxSet,
        };
        await callback(mockTx);
      });

      await expect(
        enforceDailyQuotaByIp(req as any, "pin", 3)
      ).resolves.not.toThrow();

      // Should treat as first request and set count to 1
      expect(mockTxSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          count: 1,
          date: new Date().toISOString().split("T")[0],
        }),
        { merge: true }
      );
    });

    it("should handle malformed count field", async () => {
      const req = {
        headers: { "x-forwarded-for": "192.168.1.91" },
        ip: "127.0.0.1",
      };

      const mockTxSet = jest.fn();

      mockRunTransaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              date: new Date().toISOString().split("T")[0],
              count: "invalid", // String instead of number
            }),
          }),
          set: mockTxSet,
        };
        await callback(mockTx);
      });

      await expect(
        enforceDailyQuotaByIp(req as any, "pin", 3)
      ).resolves.not.toThrow();

      // Should treat invalid count as 0 and set to 1
      expect(mockTxSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          count: 1,
        }),
        { merge: true }
      );
    });
  });
});
