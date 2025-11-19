import { RealtimeDB } from "../../database/RealtimeDB";

jest.mock("firebase-functions/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

class FakeDatabase {
  private data: Record<string, any> = {};

  ref(path: string) {
    return new FakeRef(this, path);
  }

  getValue(path: string) {
    const parts = path.split("/").filter(Boolean);
    let node: any = this.data;

    for (const part of parts) {
      if (node?.[part] === undefined) {
        return undefined;
      }
      node = node[part];
    }

    return node;
  }

  setValue(path: string, value: any) {
    const parts = path.split("/").filter(Boolean);
    let node: any = this.data;

    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        node[part] = value;
      } else {
        node[part] = node[part] ?? {};
        node = node[part];
      }
    });
  }

  removeValue(path: string) {
    const parts = path.split("/").filter(Boolean);
    let node: any = this.data;

    parts.forEach((part, index) => {
      if (!node) return;
      if (index === parts.length - 1) {
        delete node[part];
      } else {
        node = node[part];
      }
    });
  }

  updateValue(path: string, patch: Record<string, any>) {
    const current = this.getValue(path) ?? {};
    this.setValue(path, { ...current, ...patch });
  }
}

class FakeRef {
  constructor(private db: FakeDatabase, private path: string) {}

  async once(_: string) {
    const value = this.db.getValue(this.path);
    return {
      exists: () => value !== undefined,
      val: () => value,
    };
  }

  async set(value: any) {
    this.db.setValue(this.path, value);
  }

  async remove() {
    this.db.removeValue(this.path);
  }

  child(childPath: string) {
    return new FakeRef(this.db, `${this.path}/${childPath}`);
  }

  async update(patch: Record<string, any>) {
    this.db.updateValue(this.path, patch);
  }
}

describe("RealtimeDB - E2E", () => {
  const logger = require("firebase-functions/logger");
  let fakeDb: FakeDatabase;
  let realtimeDb: RealtimeDB;

  beforeEach(() => {
    jest.clearAllMocks();
    fakeDb = new FakeDatabase();
    realtimeDb = new RealtimeDB(fakeDb as any);
  });

  it("handles pending and verified report lifecycle", async () => {
    const pendingReport = {
      addedAt: "2025-11-01T10:00:00.000Z",
      address: "123 Pending St",
      additionalInfo: "needs review",
      lat: 10,
      lng: 20,
      reported: 1,
      imagePath: "reports/pending/test.jpg",
    };

    await realtimeDb.write("pending/report-1", pendingReport);
    const fetchedPending = await realtimeDb.getPendingReport("report-1");
    expect(fetchedPending).toEqual(pendingReport);

    await realtimeDb.removePendingReport("report-1");
    expect(await realtimeDb.getPendingReport("report-1")).toBeNull();

    const verifiedReport = {
      ...pendingReport,
      imageUrl: "https://example.com/img.jpg",
      verifiedAt: "2025-11-02T10:00:00.000Z",
    };

    await realtimeDb.saveVerifiedReport("report-verified", verifiedReport);
    const fetchedVerified = await realtimeDb.getVerifiedReport(
      "report-verified"
    );
    expect(fetchedVerified).toEqual(verifiedReport);

    jest
      .spyOn(Date.prototype, "toISOString")
      .mockReturnValue("2025-11-18T12:00:00.000Z");

    const updateResult = await realtimeDb.updateReport("report-verified");
    expect(updateResult).toBe(true);

    const updated = await realtimeDb.read<any>("verified/report-verified");
    expect(updated?.reported).toBe(2);
    expect(updated?.addedAt).toBe("2025-11-18T12:00:00.000Z");

    (Date.prototype.toISOString as jest.Mock).mockRestore();
  });

  it("returns false when updating missing report", async () => {
    const result = await realtimeDb.updateReport("missing");
    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      "Cannot increment reported count - verified report not found:",
      { reportId: "missing" }
    );
  });

  it("read/write/delete helpers work for arbitrary paths", async () => {
    await realtimeDb.write("custom/path/value", { foo: "bar" });

    const data = await realtimeDb.read<{ foo: string }>("custom/path/value");
    expect(data).toEqual({ foo: "bar" });

    await realtimeDb.delete("custom/path/value");
    expect(await realtimeDb.read("custom/path/value")).toBeNull();
  });
});
