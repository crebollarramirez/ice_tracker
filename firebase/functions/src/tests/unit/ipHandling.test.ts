// Mock the SALT environment variable
const MOCK_SALT = "test_salt_12345";
process.env.RATE_SALT = MOCK_SALT;

// Import the actual functions we want to test from index.ts
import { clientIp, ipKey, todayUTC } from "../../utils/utils";

describe("IP Handling Functions", () => {
  describe("clientIp", () => {
    it("should extract IP from x-forwarded-for header", () => {
      const req = {
        headers: {
          "x-forwarded-for": "192.168.1.1, 10.0.0.1, 172.16.0.1",
        },
        ip: "127.0.0.1",
      } as 
    any;

      expect(clientIp(req)).toBe("192.168.1.1");
    });

    it("should handle single IP in x-forwarded-for header", () => {
      const req = {
        headers: {
          "x-forwarded-for": "192.168.1.1",
        },
        ip: "127.0.0.1",
      };

      expect(clientIp(req as any)).toBe("192.168.1.1");
    });

    it("should fallback to req.ip when x-forwarded-for is empty", () => {
      const req = {
        headers: {
          "x-forwarded-for": "",
        },
        ip: "127.0.0.1",
      };

      expect(clientIp(req as any)).toBe("127.0.0.1");
    });

    it("should fallback to req.ip when x-forwarded-for is missing", () => {
      const req = {
        headers: {},
        ip: "127.0.0.1",
      };

      expect(clientIp(req as any)).toBe("127.0.0.1");
    });

    it("should return 'unknown' when both x-forwarded-for and req.ip are missing", () => {
      const req = {
        headers: {},
      };

      expect(clientIp(req as any)).toBe("unknown");
    });

    it("should return 'unknown' when req.ip is null", () => {
      const req = {
        headers: {},
        ip: null,
      };

      expect(clientIp(req as any)).toBe("unknown");
    });

    it("should return 'unknown' when req.ip is undefined", () => {
      const req = {
        headers: {},
        ip: undefined,
      };

      expect(clientIp(req as any)).toBe("unknown");
    });

    it("should trim whitespace from x-forwarded-for IP", () => {
      const req = {
        headers: {
          "x-forwarded-for": " 192.168.1.1 , 10.0.0.1 ",
        },
        ip: "127.0.0.1",
      };

      expect(clientIp(req as any)).toBe("192.168.1.1");
    });

    it("should handle empty string in x-forwarded-for", () => {
      const req = {
        headers: {
          "x-forwarded-for": ", 10.0.0.1",
        },
        ip: "127.0.0.1",
      };

      expect(clientIp(req as any)).toBe("127.0.0.1");
    });

    it("should handle IPv6 addresses", () => {
      const req = {
        headers: {
          "x-forwarded-for": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        },
        ip: "127.0.0.1",
      };

      expect(clientIp(req as any)).toBe("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
    });

    it("should handle malformed headers gracefully", () => {
      const req = {
        headers: {
          "x-forwarded-for": null,
        },
        ip: "127.0.0.1",
      };

      expect(clientIp(req as any)).toBe("127.0.0.1");
    });
  });

  describe("ipKey", () => {
    it("should generate consistent hashes for the same IP", () => {
      const ip = "192.168.1.1";
      const hash1 = ipKey(ip);
      const hash2 = ipKey(ip);

      expect(hash1).toBe(hash2);
      expect(hash1).toBeTruthy();
      expect(typeof hash1).toBe("string");
    });

    it("should generate different hashes for different IPs", () => {
      const ip1 = "192.168.1.1";
      const ip2 = "192.168.1.2";
      const hash1 = ipKey(ip1);
      const hash2 = ipKey(ip2);

      expect(hash1).not.toBe(hash2);
    });

    it("should generate SHA-256 length hash (64 characters)", () => {
      const ip = "192.168.1.1";
      const hash = ipKey(ip);

      expect(hash.length).toBe(64);
      expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true);
    });

    it("should handle empty IP string", () => {
      const ip = "";
      const hash = ipKey(ip);

      expect(hash).toBeTruthy();
      expect(hash.length).toBe(64);
    });

    it("should handle special characters in IP", () => {
      const ip = "192.168.1.1:8080";
      const hash = ipKey(ip);

      expect(hash).toBeTruthy();
      expect(hash.length).toBe(64);
    });

    it("should handle IPv6 addresses", () => {
      const ip = "2001:0db8:85a3:0000:0000:8a2e:0370:7334";
      const hash = ipKey(ip);

      expect(hash).toBeTruthy();
      expect(hash.length).toBe(64);
    });

    it("should handle 'unknown' IP", () => {
      const ip = "unknown";
      const hash = ipKey(ip);

      expect(hash).toBeTruthy();
      expect(hash.length).toBe(64);
    });

    // it("should produce different hashes with different salts", () => {
    //   const ip = "192.168.1.1";

    //   // Test with current salt
    //   const hash1 = ipKey(ip);

    //   // Test with different salt by temporarily changing the environment variable
    //   const originalSalt = process.env.RATE_SALT;
    //   process.env.RATE_SALT = "different_salt";

    //   // We need to re-import the module to pick up the new environment variable
    //   // Since the SALT is read at module load time, we need to clear the cache
    //   delete require.cache[require.resolve("../../index")];
    //   const { ipKey: ipKeyWithNewSalt } = require("../../index");

    //   const hash2 = ipKeyWithNewSalt(ip);

    //   // Restore original salt and clear cache again
    //   process.env.RATE_SALT = originalSalt;
    //   delete require.cache[require.resolve("../../index")];

    //   expect(hash1).not.toBe(hash2);
    // });
  });

  describe("todayUTC", () => {
    it("should return date in YYYY-MM-DD format", () => {
      const today = todayUTC();

      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should return current UTC date", () => {
      const today = todayUTC();
      const expectedDate = new Date();
      const expectedString = `${expectedDate.getUTCFullYear()}-${String(
        expectedDate.getUTCMonth() + 1
      ).padStart(2, "0")}-${String(expectedDate.getUTCDate()).padStart(
        2,
        "0"
      )}`;

      expect(today).toBe(expectedString);
    });

    it("should pad single digit months and days with zero", () => {
      // Mock Date to return a date with single digit month and day
      const mockDate = new Date("2023-01-05T12:00:00Z");
      const originalDate = global.Date;

      global.Date = jest.fn(() => mockDate) as any;
      global.Date.now = originalDate.now;
      global.Date.parse = originalDate.parse;
      global.Date.UTC = originalDate.UTC;

      const result = todayUTC();

      expect(result).toBe("2023-01-05");

      // Restore original Date
      global.Date = originalDate;
    });

    it("should handle edge cases like new year", () => {
      // Mock Date to return January 1st
      const mockDate = new Date("2024-01-01T00:00:00Z");
      const originalDate = global.Date;

      global.Date = jest.fn(() => mockDate) as any;
      global.Date.now = originalDate.now;
      global.Date.parse = originalDate.parse;
      global.Date.UTC = originalDate.UTC;

      const result = todayUTC();

      expect(result).toBe("2024-01-01");

      // Restore original Date
      global.Date = originalDate;
    });

    it("should handle leap year dates", () => {
      // Mock Date to return February 29th of a leap year
      const mockDate = new Date("2024-02-29T12:00:00Z");
      const originalDate = global.Date;

      global.Date = jest.fn(() => mockDate) as any;
      global.Date.now = originalDate.now;
      global.Date.parse = originalDate.parse;
      global.Date.UTC = originalDate.UTC;

      const result = todayUTC();

      expect(result).toBe("2024-02-29");

      // Restore original Date
      global.Date = originalDate;
    });

    it("should be consistent when called multiple times in the same day", () => {
      const result1 = todayUTC();
      const result2 = todayUTC();

      expect(result1).toBe(result2);
    });
  });
});
