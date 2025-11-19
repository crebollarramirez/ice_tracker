import { Collections } from "../../database/Collection";

jest.mock("firebase-functions/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

class FakeFirestore {
  private store = new Map<string, any[]>();
  private shouldThrow = false;

  enableError() {
    this.shouldThrow = true;
  }

  collection(name: string) {
    if (!this.store.has(name)) {
      this.store.set(name, []);
    }

    const bucket = this.store.get(name)!;
    const throwIfNeeded = () => {
      if (this.shouldThrow) {
        throw new Error("Fake Firestore failure");
      }
    };

    return {
      add: async (data: any) => {
        throwIfNeeded();
        bucket.push(data);
        return { id: `${name}-${bucket.length}` };
      },
    };
  }

  getCollection(name: string) {
    return this.store.get(name) ?? [];
  }
}

describe("Collections - E2E", () => {
  let firestore: FakeFirestore;
  let collections: Collections;

  beforeEach(() => {
    firestore = new FakeFirestore();
    collections = new Collections(firestore as any);
    jest.clearAllMocks();
  });

  it("logs verification events with derived timestamp", async () => {
    const mockDate = "2025-10-10T10:00:00.000Z";
    jest.spyOn(Date.prototype, "toISOString").mockReturnValue(mockDate);

    await collections.logVerification({
      reportId: "report-123",
      verifierUid: "verifier-1",
      reportAddress: "123 Main St",
    });

    const rows = firestore.getCollection("verificationLogs");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      reportId: "report-123",
      verifierUid: "verifier-1",
      verifiedAt: mockDate,
    });

    (Date.prototype.toISOString as jest.Mock).mockRestore();
  });

  it("logs denial events with derived image name and timestamp", async () => {
    const mockDate = "2025-11-11T10:00:00.000Z";
    jest.spyOn(Date.prototype, "toISOString").mockReturnValue(mockDate);

    await collections.logDenial({
      verifierUid: "verifier-2",
      reportAddress: "456 Deny Rd",
      imagePath: "reports/pending/deny-me.jpg",
    });

    const rows = firestore.getCollection("deniedLogs");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      verifierUid: "verifier-2",
      reportAddress: "456 Deny Rd",
      imagePath: "reports/pending/deny-me.jpg",
      deniedAt: mockDate,
      imageName: "deny-me.jpg",
    });

    (Date.prototype.toISOString as jest.Mock).mockRestore();
  });

  it("bubbles Firestore failures", async () => {
    firestore.enableError();

    await expect(
      collections.logVerification({
        reportId: "report-err",
        verifierUid: "uid",
        reportAddress: "addr",
      })
    ).rejects.toThrow("Fake Firestore failure");
  });
});
