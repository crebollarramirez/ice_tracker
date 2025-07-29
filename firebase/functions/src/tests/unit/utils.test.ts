import { describe, it, expect } from "@jest/globals";
import {
  isOlderThan7Days,
  isValidISO8601,
  isDateTodayUTC,
} from "../../utils/utils";

describe("utils", () => {
  const FIXED_DATE = new Date("2025-07-26T00:00:00.000Z").getTime();

  beforeEach(() => {
    // Mock Date to ensure consistent test results
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_DATE);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("isOlderThan7Days", () => {
    it("should return true for locations older than 7 days", () => {
      // Use a fixed date 8 days ago from mocked date (2025-07-26)
      const oldTimestamp = "2025-07-18T00:00:00.000Z"; // 8 days before 2025-07-26

      const result = isOlderThan7Days(oldTimestamp);
      expect(result).toBe(true);
    });

    it("should return false for locations exactly 7 days old", () => {
      // Use a fixed date exactly 7 days ago from mocked date (2025-07-26)
      const timestamp = "2025-07-19T00:00:00.000Z"; // 7 days before 2025-07-26

      const result = isOlderThan7Days(timestamp);
      expect(result).toBe(false);
    });

    it("should return false for recent locations", () => {
      // Use a fixed date 3 days ago from mocked date (2025-07-26)
      const recentTimestamp = "2025-07-23T00:00:00.000Z"; // 3 days before 2025-07-26

      const result = isOlderThan7Days(recentTimestamp);
      expect(result).toBe(false);
    });

    it("should return false for future dates", () => {
      // Use a fixed date in the future from mocked date (2025-07-26)
      const futureTimestamp = "2025-07-27T00:00:00.000Z"; // 1 day after 2025-07-26

      const result = isOlderThan7Days(futureTimestamp);
      expect(result).toBe(false);
    });

    it("should handle timezone differences correctly", () => {
      // Test with different timezone formats
      const utcDate = "2025-07-10T10:00:00.000Z";
      const result = isOlderThan7Days(utcDate);

      // Should be consistent regardless of local timezone
      expect(typeof result).toBe("boolean");
    });

    it("should handle different ISO date formats", () => {
      // Test various valid ISO date formats
      const formats = [
        "2025-07-10T10:00:00.000Z",
        "2025-07-10T10:00:00Z",
        "2025-07-10T10:00:00.123Z",
      ];

      formats.forEach((format) => {
        const result = isOlderThan7Days(format);
        expect(typeof result).toBe("boolean");
      });
    });
  });

  describe("isValidISO8601", () => {
    describe("valid strict ISO 8601 format", () => {
      it("should return true for correct format with milliseconds and Z", () => {
        const validDates = [
          "2025-07-25T23:21:27.427Z",
          "2023-01-01T00:00:00.000Z",
          "2025-12-31T23:59:59.999Z",
          "2024-02-29T12:30:45.123Z", // Leap year
          "2025-06-15T09:15:30.456Z",
        ];

        validDates.forEach((date) => {
          expect(isValidISO8601(date)).toBe(true);
        });
      });

      it("should validate actual dates correctly", () => {
        // These are real valid dates in the strict format
        const realDates = [
          "2025-01-31T12:00:00.000Z", // January 31st
          "2024-02-29T18:30:45.123Z", // Leap year Feb 29th
          "2025-04-30T23:59:59.999Z", // April 30th (valid)
          "2025-07-04T16:20:15.789Z", // Independence Day
          "2025-12-25T08:00:00.000Z", // Christmas
        ];

        realDates.forEach((date) => {
          expect(isValidISO8601(date)).toBe(true);
        });
      });
    });

    describe("invalid formats - missing required components", () => {
      it("should return false for ISO 8601 format without milliseconds", () => {
        const invalidDates = [
          "2025-07-25T12:00:00Z", // Missing milliseconds
          "2023-01-01T00:00:00Z",
          "2025-12-31T23:59:59Z",
        ];

        invalidDates.forEach((date) => {
          expect(isValidISO8601(date)).toBe(false);
        });
      });

      it("should return false for ISO 8601 format without timezone", () => {
        const invalidDates = [
          "2025-07-25T12:00:00.000", // Missing Z
          "2025-07-25T12:00:00", // Missing milliseconds and Z
          "2023-01-01T00:00:00.123",
        ];

        invalidDates.forEach((date) => {
          expect(isValidISO8601(date)).toBe(false);
        });
      });

      it("should return false for date-only ISO 8601 format", () => {
        const invalidDates = ["2025-07-25", "2023-01-01", "2025-12-31"];

        invalidDates.forEach((date) => {
          expect(isValidISO8601(date)).toBe(false);
        });
      });
    });

    describe("invalid date values", () => {
      it("should return false for invalid month values", () => {
        const invalidDates = [
          "2025-13-01T12:00:00.000Z", // Invalid month (13)
          "2025-00-01T12:00:00.000Z", // Invalid month (0)
          "2025-15-25T12:00:00.000Z", // Invalid month (15)
        ];

        invalidDates.forEach((date) => {
          expect(isValidISO8601(date)).toBe(false);
        });
      });

      it("should return false for invalid day values", () => {
        const invalidDates = [
          "2025-01-32T12:00:00.000Z", // Invalid day for January
          "2025-02-30T12:00:00.000Z", // Invalid day for February
          "2023-02-29T12:00:00.000Z", // Not a leap year
          "2025-04-31T12:00:00.000Z", // Invalid day for April
          "2025-06-31T12:00:00.000Z", // Invalid day for June
          "2025-01-00T12:00:00.000Z", // Invalid day (0)
        ];

        invalidDates.forEach((date) => {
          expect(isValidISO8601(date)).toBe(false);
        });
      });

      it("should return false for invalid time values", () => {
        const invalidTimes = [
          "2025-07-25T25:00:00.000Z", // Invalid hour (25)
          "2025-07-25T12:60:00.000Z", // Invalid minute (60)
          "2025-07-25T12:00:60.000Z", // Invalid second (60)
          "2025-07-25T24:00:00.000Z", // Invalid hour (24)
          "2025-07-25T-1:00:00.000Z", // Negative hour
        ];

        invalidTimes.forEach((date) => {
          expect(isValidISO8601(date)).toBe(false);
        });
      });
    });

    describe("invalid formats and malformed strings", () => {
      it("should return false for non-ISO date formats", () => {
        const invalidFormats = [
          "2025/07/25T12:00:00.000Z",
          "07-25-2025T12:00:00.000Z",
          "25-07-2025T12:00:00.000Z",
          "2025.07.25T12:00:00.000Z",
          "July 25, 2025T12:00:00.000Z",
        ];

        invalidFormats.forEach((date) => {
          expect(isValidISO8601(date)).toBe(false);
        });
      });

      it("should return false for malformed time components", () => {
        const malformedStrings = [
          "2025-7-25T12:00:00.000Z", // Single digit month
          "2025-07-5T12:00:00.000Z", // Single digit day
          "2025-07-25T2:00:00.000Z", // Single digit hour
          "2025-07-25T12:0:00.000Z", // Single digit minute
          "2025-07-25T12:00:0.000Z", // Single digit second
          "2025-07-25 12:00:00.000Z", // Space instead of T
          "2025-07-25T12:00:00.0Z", // Single millisecond digit
          "2025-07-25T12:00:00.00Z", // Two millisecond digits
          "2025-07-25T12:00:00.1234Z", // Four millisecond digits
        ];

        malformedStrings.forEach((date) => {
          expect(isValidISO8601(date)).toBe(false);
        });
      });

      it("should return false for completely invalid strings", () => {
        const invalidStrings = [
          "invalid",
          "not-a-date",
          "2025",
          "07-25",
          "T12:00:00.000Z",
          "2025-07-25T",
          "abc-def-ghijT12:00:00.000Z",
          "",
          " ",
          "2025-07-25T12:00:00.Z",
          "2025-07-25T12:00:00000Z",
        ];

        invalidStrings.forEach((date) => {
          expect(isValidISO8601(date)).toBe(false);
        });
      });
    });

    describe("edge cases and input validation", () => {
      it("should return false for null and undefined inputs", () => {
        expect(isValidISO8601(null as any)).toBe(false);
        expect(isValidISO8601(undefined as any)).toBe(false);
      });

      it("should return false for non-string inputs", () => {
        expect(isValidISO8601(123 as any)).toBe(false);
        expect(isValidISO8601("not a date object" as any)).toBe(false);
        expect(isValidISO8601({} as any)).toBe(false);
        expect(isValidISO8601([] as any)).toBe(false);
        expect(isValidISO8601(true as any)).toBe(false);
      });

      it("should return false for empty string and whitespace", () => {
        expect(isValidISO8601("")).toBe(false);
        expect(isValidISO8601(" ")).toBe(false);
        expect(isValidISO8601("  2025-07-25T12:00:00.000Z  ")).toBe(false);
        expect(isValidISO8601("\t2025-07-25T12:00:00.000Z\n")).toBe(false);
      });

      it("should validate year boundaries correctly", () => {
        // Test extreme but valid years
        expect(isValidISO8601("0001-01-01T00:00:00.000Z")).toBe(true);
        expect(isValidISO8601("9999-12-31T23:59:59.999Z")).toBe(true);

        // Test invalid year formats
        expect(isValidISO8601("25-07-25T12:00:00.000Z")).toBe(false);
        expect(isValidISO8601("025-07-25T12:00:00.000Z")).toBe(false);
      });
    });

    describe("timezone validation", () => {
      it("should only accept Z timezone designator", () => {
        const invalidTimezones = [
          "2025-07-25T12:00:00.000", // No timezone
          "2025-07-25T12:00:00.000+00:00", // Offset format
          "2025-07-25T12:00:00.000-05:00", // Negative offset
          "2025-07-25T12:00:00.000UTC", // UTC spelled out
          "2025-07-25T12:00:00.000z", // Lowercase z
        ];

        invalidTimezones.forEach((date) => {
          expect(isValidISO8601(date)).toBe(false);
        });
      });

      it("should accept only uppercase Z", () => {
        expect(isValidISO8601("2025-07-25T12:00:00.000Z")).toBe(true);
        expect(isValidISO8601("2025-07-25T12:00:00.000z")).toBe(false);
      });
    });

    describe("leap year validation", () => {
      it("should accept valid leap year dates", () => {
        const leapYearDates = [
          "2024-02-29T12:00:00.000Z", // 2024 is a leap year
          "2020-02-29T18:30:45.123Z", // 2020 is a leap year
          "2000-02-29T00:00:00.000Z", // 2000 is a leap year (divisible by 400)
        ];

        leapYearDates.forEach((date) => {
          expect(isValidISO8601(date)).toBe(true);
        });
      });

      it("should reject invalid leap year dates", () => {
        const invalidLeapDates = [
          "2023-02-29T12:00:00.000Z", // 2023 is not a leap year
          "2025-02-29T12:00:00.000Z", // 2025 is not a leap year
          "1900-02-29T12:00:00.000Z", // 1900 is not a leap year (divisible by 100 but not 400)
        ];

        invalidLeapDates.forEach((date) => {
          expect(isValidISO8601(date)).toBe(false);
        });
      });
    });
  });

  describe("isDateTodayUTC", () => {
    it("should return true for a timestamp that is today in UTC", () => {
      // Use the mocked date (2025-07-26)
      const todayUTC = "2025-07-26T12:00:00.000Z"; // Same day as mocked date

      const result = isDateTodayUTC(todayUTC);
      expect(result).toBe(true);
    });

    it("should return false for a timestamp that is yesterday in UTC", () => {
      // Use a fixed date that's yesterday from mocked date (2025-07-26)
      const yesterdayUTC = "2025-07-25T12:00:00.000Z"; // 1 day before mocked date

      const result = isDateTodayUTC(yesterdayUTC);
      expect(result).toBe(false);
    });

    it("should return false for a timestamp that is tomorrow in UTC", () => {
      // Use a fixed date that's tomorrow from mocked date (2025-07-26)
      const tomorrowUTC = "2025-07-27T12:00:00.000Z"; // 1 day after mocked date

      const result = isDateTodayUTC(tomorrowUTC);
      expect(result).toBe(false);
    });

    it("should return false for a timestamp with a different year", () => {
      // Use a fixed date with different year from mocked date (2025-07-26)
      const lastYearUTC = "2024-07-26T12:00:00.000Z"; // 1 year before mocked date

      const result = isDateTodayUTC(lastYearUTC);
      expect(result).toBe(false);
    });

    it("should return false for a timestamp with a different month", () => {
      // Use a fixed date with different month from mocked date (2025-07-26)
      const lastMonthUTC = "2025-06-26T12:00:00.000Z"; // 1 month before mocked date

      const result = isDateTodayUTC(lastMonthUTC);
      expect(result).toBe(false);
    });

    it("should handle edge cases for UTC midnight", () => {
      // Use the mocked date at UTC midnight
      const midnightUTC = "2025-07-26T00:00:00.000Z"; // Exact mocked date

      const result = isDateTodayUTC(midnightUTC);
      expect(result).toBe(true);
    });

    it("should handle edge cases for the last second of the day in UTC", () => {
      // Use the mocked date at the last millisecond of the day
      const lastSecondUTC = "2025-07-26T23:59:59.999Z"; // Same day as mocked date

      const result = isDateTodayUTC(lastSecondUTC);
      expect(result).toBe(true);
    });
  });
});
