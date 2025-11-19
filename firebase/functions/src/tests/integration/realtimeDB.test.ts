import { RealtimeDB } from "../../database/RealtimeDB";

jest.mock("firebase-functions/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe("RealtimeDB - Integration Tests", () => {
  let realtimeDb: RealtimeDB;
  let mockDb: { ref: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {
      ref: jest.fn(),
    };
    realtimeDb = new RealtimeDB(mockDb as any);
  });

  describe("getPendingReport", () => {
    it("returns report data when snapshot exists", async () => {
      const mockReport = { address: "123 Main St" };
      const once = jest.fn().mockResolvedValue({
        exists: () => true,
        val: () => mockReport,
      });
      mockDb.ref.mockReturnValue({ once });

      const result = await realtimeDb.getPendingReport("report-1");

      expect(mockDb.ref).toHaveBeenCalledWith("pending/report-1");
      expect(result).toEqual(mockReport);
    });

    it("returns null and logs warning when snapshot missing", async () => {
      const logger = require("firebase-functions/logger");
      const once = jest.fn().mockResolvedValue({
        exists: () => false,
      });
      mockDb.ref.mockReturnValue({ once });

      const result = await realtimeDb.getPendingReport("missing-report");

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith("Pending report not found:", {
        reportId: "missing-report",
      });
    });

    it("propagates errors from database", async () => {
      const logger = require("firebase-functions/logger");
      const error = new Error("DB failure");
      const once = jest.fn().mockRejectedValue(error);
      mockDb.ref.mockReturnValue({ once });

      await expect(
        realtimeDb.getPendingReport("report-err")
      ).rejects.toThrow("DB failure");
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to retrieve pending report:",
        { reportId: "report-err", error }
      );
    });
  });

  describe("getVerifiedReport", () => {
    it("returns report data when snapshot exists", async () => {
      const mockReport = { address: "456 Main St" };
      const once = jest.fn().mockResolvedValue({
        exists: () => true,
        val: () => mockReport,
      });
      mockDb.ref.mockReturnValue({ once });

      const result = await realtimeDb.getVerifiedReport("report-2");

      expect(mockDb.ref).toHaveBeenCalledWith("verified/report-2");
      expect(result).toEqual(mockReport);
    });

    it("returns null when snapshot missing", async () => {
      const logger = require("firebase-functions/logger");
      const once = jest.fn().mockResolvedValue({
        exists: () => false,
      });
      mockDb.ref.mockReturnValue({ once });

      const result = await realtimeDb.getVerifiedReport("missing-report");
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith("Verified report not found:", {
        reportId: "missing-report",
      });
    });

    it("propagates errors from database", async () => {
      const error = new Error("DB boom");
      const once = jest.fn().mockRejectedValue(error);
      mockDb.ref.mockReturnValue({ once });

      await expect(
        realtimeDb.getVerifiedReport("report-err")
      ).rejects.toThrow("DB boom");
    });
  });

  describe("saveVerifiedReport", () => {
    it("writes data to verified path", async () => {
      const set = jest.fn().mockResolvedValue(undefined);
      mockDb.ref.mockReturnValue({ set });

      await realtimeDb.saveVerifiedReport("report-3", {
        address: "789 Main",
      } as any);

      expect(mockDb.ref).toHaveBeenCalledWith("verified/report-3");
      expect(set).toHaveBeenCalledWith({ address: "789 Main" });
    });

    it("throws when set fails", async () => {
      const error = new Error("Set failed");
      const set = jest.fn().mockRejectedValue(error);
      mockDb.ref.mockReturnValue({ set });

      await expect(
        realtimeDb.saveVerifiedReport("report-3", {} as any)
      ).rejects.toThrow("Set failed");
    });
  });

  describe("removePendingReport", () => {
    it("removes pending entry", async () => {
      const remove = jest.fn().mockResolvedValue(undefined);
      mockDb.ref.mockReturnValue({ remove });

      await realtimeDb.removePendingReport("report-4");

      expect(mockDb.ref).toHaveBeenCalledWith("pending/report-4");
      expect(remove).toHaveBeenCalled();
    });

    it("throws when remove fails", async () => {
      const error = new Error("Remove failed");
      const remove = jest.fn().mockRejectedValue(error);
      mockDb.ref.mockReturnValue({ remove });

      await expect(
        realtimeDb.removePendingReport("report-4")
      ).rejects.toThrow("Remove failed");
    });
  });

  describe("updateReport", () => {
    const logger = require("firebase-functions/logger");
    let mockDate: jest.SpyInstance<string, []>;

    beforeEach(() => {
      mockDate = jest
        .spyOn(Date.prototype, "toISOString")
        .mockReturnValue("2025-11-18T10:00:00.000Z");
    });

    afterEach(() => {
      mockDate.mockRestore();
    });

    it("increments reported count and updates timestamp", async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const reportedChild = {
        once: jest.fn().mockResolvedValue({
          exists: () => true,
          val: () => 3,
        }),
      };
      const verifiedRef = {
        once: jest.fn().mockResolvedValue({
          exists: () => true,
          val: () => ({ reported: 3, addedAt: "old-date" }),
        }),
        child: jest.fn().mockReturnValue(reportedChild),
        update,
      };
      mockDb.ref.mockReturnValue(verifiedRef);

      const result = await realtimeDb.updateReport("report-xyz");

      expect(result).toBe(true);
      expect(update).toHaveBeenCalledWith({
        reported: 4,
        addedAt: "2025-11-18T10:00:00.000Z",
      });
      expect(logger.info).toHaveBeenCalledWith("Updated verified report:", {
        reportId: "report-xyz",
        newCount: 4,
        addedAt: "2025-11-18T10:00:00.000Z",
      });
    });

    it("initializes reported count when missing", async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const reportedChild = {
        once: jest.fn().mockResolvedValue({
          exists: () => false,
        }),
      };
      const verifiedRef = {
        once: jest.fn().mockResolvedValue({
          exists: () => true,
          val: () => ({ reported: undefined }),
        }),
        child: jest.fn().mockReturnValue(reportedChild),
        update,
      };
      mockDb.ref.mockReturnValue(verifiedRef);

      const result = await realtimeDb.updateReport("report-init");

      expect(result).toBe(true);
      expect(update).toHaveBeenCalledWith({
        reported: 2,
        addedAt: "2025-11-18T10:00:00.000Z",
      });
    });

    it("returns false if report does not exist", async () => {
      const verifiedRef = {
        once: jest.fn().mockResolvedValue({
          exists: () => false,
        }),
        child: jest.fn(),
        update: jest.fn(),
      };
      mockDb.ref.mockReturnValue(verifiedRef);

      const result = await realtimeDb.updateReport("missing");

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        "Cannot increment reported count - verified report not found:",
        { reportId: "missing" }
      );
    });

    it("returns false when update fails and logs error", async () => {
      const error = new Error("Update failed");
      const reportedChild = {
        once: jest.fn().mockResolvedValue({
          exists: () => true,
          val: () => 1,
        }),
      };
      const verifiedRef = {
        once: jest.fn().mockResolvedValue({
          exists: () => true,
          val: () => ({ reported: 1 }),
        }),
        child: jest.fn().mockReturnValue(reportedChild),
        update: jest.fn().mockRejectedValue(error),
      };
      mockDb.ref.mockReturnValue(verifiedRef);

      const result = await realtimeDb.updateReport("report-err");

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to update verified report:",
        { reportId: "report-err", error }
      );
    });
  });

  describe("read", () => {
    it("returns data when snapshot exists", async () => {
      const data = { foo: "bar" };
      const once = jest.fn().mockResolvedValue({
        exists: () => true,
        val: () => data,
      });
      mockDb.ref.mockReturnValue({ once });

      const result = await realtimeDb.read<typeof data>("custom/path");

      expect(result).toEqual(data);
    });

    it("returns null when snapshot missing", async () => {
      const once = jest.fn().mockResolvedValue({
        exists: () => false,
      });
      mockDb.ref.mockReturnValue({ once });

      const result = await realtimeDb.read("custom/path");
      expect(result).toBeNull();
    });

    it("throws when read fails", async () => {
      const error = new Error("Read failed");
      const once = jest.fn().mockRejectedValue(error);
      mockDb.ref.mockReturnValue({ once });

      await expect(realtimeDb.read("custom/path")).rejects.toThrow(
        "Read failed"
      );
    });
  });

  describe("write", () => {
    it("writes data to provided path", async () => {
      const set = jest.fn().mockResolvedValue(undefined);
      mockDb.ref.mockReturnValue({ set });

      await realtimeDb.write("custom/path", { foo: "bar" });

      expect(mockDb.ref).toHaveBeenCalledWith("custom/path");
      expect(set).toHaveBeenCalledWith({ foo: "bar" });
    });

    it("throws when write fails", async () => {
      const error = new Error("Write failed");
      const set = jest.fn().mockRejectedValue(error);
      mockDb.ref.mockReturnValue({ set });

      await expect(
        realtimeDb.write("custom/path", { foo: "bar" })
      ).rejects.toThrow("Write failed");
    });
  });

  describe("delete", () => {
    it("removes data at provided path", async () => {
      const remove = jest.fn().mockResolvedValue(undefined);
      mockDb.ref.mockReturnValue({ remove });

      await realtimeDb.delete("custom/path");

      expect(mockDb.ref).toHaveBeenCalledWith("custom/path");
      expect(remove).toHaveBeenCalled();
    });

    it("throws when delete fails", async () => {
      const error = new Error("Delete failed");
      const remove = jest.fn().mockRejectedValue(error);
      mockDb.ref.mockReturnValue({ remove });

      await expect(realtimeDb.delete("custom/path")).rejects.toThrow(
        "Delete failed"
      );
    });
  });
});
