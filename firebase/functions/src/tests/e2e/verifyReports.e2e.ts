import functionsTest from "firebase-functions-test";

type FakeData = Record<string, any>;

class FakeRealtimeDB {
  private data: FakeData = {};

  ref(path: string) {
    return new FakeRef(this, path);
  }

  getValue(path: string) {
    const parts = path.split("/").filter(Boolean);
    let node: any = this.data;
    for (const part of parts) {
      if (node?.[part] === undefined) return undefined;
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
  constructor(private store: FakeRealtimeDB, private path: string) {}

  async once(_: string) {
    const value = this.store.getValue(this.path);
    return {
      exists: () => value !== undefined,
      val: () => value,
    };
  }

  async set(value: any) {
    this.store.setValue(this.path, value);
  }

  async remove() {
    this.store.removeValue(this.path);
  }

  child(sub: string) {
    return new FakeRef(this.store, `${this.path}/${sub}`);
  }

  async update(patch: Record<string, any>) {
    this.store.updateValue(this.path, patch);
  }
}

class FakeFirestore {
  private collections = new Map<string, any[]>();

  collection(name: string) {
    if (!this.collections.has(name)) {
      this.collections.set(name, []);
    }
    const bucket = this.collections.get(name)!;
    return {
      add: async (data: any) => {
        bucket.push(data);
        return { id: `${name}-${bucket.length}` };
      },
    };
  }

  getCollection(name: string) {
    return this.collections.get(name) ?? [];
  }
}

class FakeFile {
  public metadata: Record<string, any> = {};
  public existsSync = false;
  private storedContent = "";

  constructor(public name: string) {}

  seed(content = "file") {
    this.existsSync = true;
    this.storedContent = content;
  }

  async exists() {
    return [this.existsSync];
  }

  async copy(destinationFile: FakeFile) {
    if (!this.existsSync) throw new Error("Source missing");
    destinationFile.existsSync = true;
    destinationFile.metadata = { ...this.metadata };
    destinationFile.storedContent = this.storedContent;
  }

  async delete() {
    if (!this.existsSync) throw new Error("Delete missing file");
    this.existsSync = false;
  }

  async getMetadata() {
    return [
      {
        metadata: this.metadata,
      },
    ];
  }

  async setMetadata(metadata: { metadata: Record<string, any> }) {
    this.metadata = metadata.metadata;
  }
}

class FakeBucket {
  name = "test-bucket.appspot.com";
  private files = new Map<string, FakeFile>();

  file(path: string) {
    if (!this.files.has(path)) {
      this.files.set(path, new FakeFile(path));
    }
    return this.files.get(path)!;
  }

  seed(path: string) {
    this.file(path).seed();
  }

  has(path: string) {
    return this.files.get(path)?.existsSync ?? false;
  }
}

function createFakeFirebaseAdmin() {
  const realtime = new FakeRealtimeDB();
  const firestore = new FakeFirestore();
  const bucket = new FakeBucket();

  return {
    env: { realtime, firestore, bucket },
    module: {
      initializeApp: jest.fn(),
      database: jest.fn(() => ({
        ref: (path: string) => realtime.ref(path),
      })),
      firestore: jest.fn(() => ({
        collection: (name: string) => firestore.collection(name),
      })),
      storage: jest.fn(() => ({
        bucket: jest.fn(() => bucket),
      })),
    },
  };
}

describe("verify/deny/delete – e2e", () => {
  beforeAll(() => {
    process.env.STORAGE_BUCKET = "test-bucket.appspot.com";
  });

  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  async function setupFunctions() {
    jest.resetModules();
    const fake = createFakeFirebaseAdmin();
    jest.doMock("firebase-admin", () => fake.module);
    const mod = await import("../../index");
    const testEnv = functionsTest({ projectId: "test-project" });
    return {
      fake,
      verifyReport: testEnv.wrap(mod.verifyReport),
      denyReport: testEnv.wrap(mod.denyReport),
      deletePendingReport: testEnv.wrap(mod.deletePendingReport),
      cleanup: () => testEnv.cleanup(),
    };
  }

  const auth = {
    uid: "verifier-uid",
    token: { role: "verifier", aud: "", auth_time: 0, exp: 0, firebase: {} },
  } as any;

  it("verifies a pending report and logs it", async () => {
    const { verifyReport, fake, cleanup } = await setupFunctions();
    const reportId = "verify-1";
    const pending = {
      addedAt: "2025-01-01T00:00:00.000Z",
      additionalInfo: "pending info",
      address: "123 Pending Rd",
      imagePath: `reports/pending/${reportId}/image.jpg`,
      lat: 1,
      lng: 2,
      reported: 1,
    };
    fake.env.realtime.setValue(`pending/${reportId}`, pending);
    fake.env.bucket.seed(pending.imagePath);

    const response = await verifyReport({
      data: { reportId },
      auth,
    } as any);

    expect(response).toEqual({
      success: true,
      message: `Report ${reportId} verified successfully`,
    });
    expect(fake.env.realtime.getValue(`pending/${reportId}`)).toBeUndefined();
    const verified = fake.env.realtime.getValue(`verified/${reportId}`);
    expect(verified).toMatchObject({
      address: pending.address,
      additionalInfo: pending.additionalInfo,
      imageUrl: expect.stringContaining(
        "https://firebasestorage.googleapis.com"
      ),
    });
    expect(fake.env.bucket.has(pending.imagePath)).toBe(false);
    expect(fake.env.bucket.has(`reports/verified/${reportId}/image.jpg`)).toBe(
      true
    );
    expect(fake.env.firestore.getCollection("verificationLogs")).toHaveLength(
      1
    );
    cleanup();
  });

  it("denies a pending report and stores denial entry", async () => {
    const { denyReport, fake, cleanup } = await setupFunctions();
    const reportId = "deny-1";
    const pending = {
      addedAt: "2025-01-05T00:00:00.000Z",
      additionalInfo: "deny me",
      address: "456 Deny St",
      imagePath: `reports/pending/${reportId}/photo.jpg`,
      lat: 5,
      lng: 6,
      reported: 1,
    };
    fake.env.realtime.setValue(`pending/${reportId}`, pending);
    fake.env.bucket.seed(pending.imagePath);

    const result = await denyReport({
      data: { reportId },
      auth,
    } as any);

    expect(result).toEqual({
      success: true,
      message: `Report ${reportId} denied successfully`,
    });
    expect(fake.env.realtime.getValue(`pending/${reportId}`)).toBeUndefined();
    expect(fake.env.bucket.has(pending.imagePath)).toBe(false);
    expect(fake.env.bucket.has(`reports/denied/photo.jpg`)).toBe(true);
    expect(fake.env.firestore.getCollection("deniedLogs")).toHaveLength(1);
    cleanup();
  });

  it("deletes pending report and associated image", async () => {
    const { deletePendingReport, fake, cleanup } = await setupFunctions();
    const reportId = "delete-1";
    const pending = {
      addedAt: "2025-01-05T00:00:00.000Z",
      additionalInfo: "delete me",
      address: "789 Remove Ave",
      imagePath: `reports/pending/${reportId}/photo.jpg`,
      lat: 9,
      lng: 10,
      reported: 1,
    };
    fake.env.realtime.setValue(`pending/${reportId}`, pending);
    fake.env.bucket.seed(pending.imagePath);

    const response = await deletePendingReport({
      data: { reportId },
      auth,
    } as any);

    expect(response).toEqual({
      success: true,
      message: `Report ${reportId} deleted successfully`,
    });
    expect(fake.env.realtime.getValue(`pending/${reportId}`)).toBeUndefined();
    expect(fake.env.bucket.has(pending.imagePath)).toBe(false);
    cleanup();
  });

  it("throws when verifier role missing", async () => {
    const { verifyReport, cleanup } = await setupFunctions();
    await expect(
      verifyReport({
        data: { reportId: "x" },
        auth: {
          uid: "user",
          token: { aud: "", auth_time: 0, exp: 0, firebase: {} },
        } as any,
      } as any)
    ).rejects.toThrow("Insufficient permissions. Verifier role required.");
    cleanup();
  });

  // ========== INPUT VALIDATION TESTS ==========

  it("rejects empty reportId", async () => {
    const { verifyReport, cleanup } = await setupFunctions();
    await expect(
      verifyReport({
        data: { reportId: "" },
        auth,
      } as any)
    ).rejects.toThrow();
    cleanup();
  });

  it("rejects missing reportId", async () => {
    const { verifyReport, cleanup } = await setupFunctions();
    await expect(
      verifyReport({
        data: {},
        auth,
      } as any)
    ).rejects.toThrow();
    cleanup();
  });

  it("handles non-existent pending report gracefully", async () => {
    const { verifyReport, cleanup } = await setupFunctions();
    await expect(
      verifyReport({
        data: { reportId: "nonexistent-id" },
        auth,
      } as any)
    ).rejects.toThrow();
    cleanup();
  });

  it("handles pending report with missing imagePath", async () => {
    const { verifyReport, fake, cleanup } = await setupFunctions();
    const reportId = "no-image-path";
    fake.env.realtime.setValue(`pending/${reportId}`, {
      addedAt: "2025-01-01T00:00:00.000Z",
      address: "123 Test St",
      lat: 1,
      lng: 2,
      reported: 1,
      // imagePath is missing
    });

    await expect(
      verifyReport({
        data: { reportId },
        auth,
      } as any)
    ).rejects.toThrow();
    cleanup();
  });

  it("handles missing image file in storage", async () => {
    const { verifyReport, fake, cleanup } = await setupFunctions();
    const reportId = "missing-storage-file";
    const pending = {
      addedAt: "2025-01-01T00:00:00.000Z",
      address: "123 Test St",
      imagePath: `reports/pending/${reportId}/image.jpg`,
      lat: 1,
      lng: 2,
      reported: 1,
    };
    fake.env.realtime.setValue(`pending/${reportId}`, pending);
    // Note: NOT seeding the file in storage

    await expect(
      verifyReport({
        data: { reportId },
        auth,
      } as any)
    ).rejects.toThrow();
    cleanup();
  });

  // ========== IDEMPOTENCY TESTS ==========

  it("handles double verification attempt", async () => {
    const { verifyReport, fake, cleanup } = await setupFunctions();
    const reportId = "double-verify";
    const pending = {
      addedAt: "2025-01-01T00:00:00.000Z",
      address: "123 Test St",
      imagePath: `reports/pending/${reportId}/image.jpg`,
      lat: 1,
      lng: 2,
      reported: 1,
    };
    fake.env.realtime.setValue(`pending/${reportId}`, pending);
    fake.env.bucket.seed(pending.imagePath);

    // First verification
    await verifyReport({ data: { reportId }, auth } as any);

    // Second verification attempt (pending report no longer exists)
    await expect(
      verifyReport({ data: { reportId }, auth } as any)
    ).rejects.toThrow();
    cleanup();
  });

  it("handles double denial attempt", async () => {
    const { denyReport, fake, cleanup } = await setupFunctions();
    const reportId = "double-deny";
    const pending = {
      addedAt: "2025-01-01T00:00:00.000Z",
      address: "123 Test St",
      imagePath: `reports/pending/${reportId}/image.jpg`,
      lat: 1,
      lng: 2,
      reported: 1,
    };
    fake.env.realtime.setValue(`pending/${reportId}`, pending);
    fake.env.bucket.seed(pending.imagePath);

    // First denial
    await denyReport({ data: { reportId }, auth } as any);

    // Second denial attempt
    await expect(
      denyReport({ data: { reportId }, auth } as any)
    ).rejects.toThrow();
    cleanup();
  });

  // ========== DATA INTEGRITY TESTS ==========

  it("preserves all pending report fields when verifying", async () => {
    const { verifyReport, fake, cleanup } = await setupFunctions();
    const reportId = "complete-data";
    const pending = {
      addedAt: "2025-01-01T00:00:00.000Z",
      additionalInfo: "Detailed information",
      address: "123 Complete St",
      imagePath: `reports/pending/${reportId}/image.jpg`,
      lat: 45.5,
      lng: -122.6,
      reported: 3,
      customField: "should-not-be-lost",
    };
    fake.env.realtime.setValue(`pending/${reportId}`, pending);
    fake.env.bucket.seed(pending.imagePath);

    await verifyReport({ data: { reportId }, auth } as any);

    const verified = fake.env.realtime.getValue(`verified/${reportId}`);
    expect(verified).toMatchObject({
      address: pending.address,
      additionalInfo: pending.additionalInfo,
      lat: pending.lat,
      lng: pending.lng,
    });
    expect(verified.imageUrl).toBeDefined();
    cleanup();
  });

  it("correctly generates imageUrl with token", async () => {
    const { verifyReport, fake, cleanup } = await setupFunctions();
    const reportId = "url-test";
    const pending = {
      addedAt: "2025-01-01T00:00:00.000Z",
      address: "123 URL St",
      imagePath: `reports/pending/${reportId}/image.jpg`,
      lat: 1,
      lng: 2,
      reported: 1,
    };
    fake.env.realtime.setValue(`pending/${reportId}`, pending);
    fake.env.bucket.seed(pending.imagePath);

    await verifyReport({ data: { reportId }, auth } as any);

    const verified = fake.env.realtime.getValue(`verified/${reportId}`);
    expect(verified.imageUrl).toMatch(
      /^https:\/\/firebasestorage\.googleapis\.com/
    );
    expect(verified.imageUrl).toMatch(/token=/);
    cleanup();
  });

  // ========== FIRESTORE LOG VALIDATION ==========

  it("logs verification with correct structure", async () => {
    const { verifyReport, fake, cleanup } = await setupFunctions();
    const reportId = "log-verify";
    const pending = {
      addedAt: "2025-01-01T00:00:00.000Z",
      address: "123 Log St",
      imagePath: `reports/pending/${reportId}/image.jpg`,
      lat: 1,
      lng: 2,
      reported: 1,
    };
    fake.env.realtime.setValue(`pending/${reportId}`, pending);
    fake.env.bucket.seed(pending.imagePath);

    await verifyReport({ data: { reportId }, auth } as any);

    const logs = fake.env.firestore.getCollection("verificationLogs");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      reportId,
      verifierUid: auth.uid,
      verifiedAt: expect.any(String),
    });
    cleanup();
  });

  it("logs denial with correct structure and image name", async () => {
    const { denyReport, fake, cleanup } = await setupFunctions();
    const reportId = "log-deny";
    const pending = {
      addedAt: "2025-01-01T00:00:00.000Z",
      address: "456 Log St",
      imagePath: `reports/pending/${reportId}/test-photo.jpg`,
      lat: 5,
      lng: 6,
      reported: 1,
    };
    fake.env.realtime.setValue(`pending/${reportId}`, pending);
    fake.env.bucket.seed(pending.imagePath);

    await denyReport({ data: { reportId }, auth } as any);

    const logs = fake.env.firestore.getCollection("deniedLogs");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      verifierUid: auth.uid,
      reportAddress: pending.address,
      imagePath: "reports/denied/test-photo.jpg", // Updated to reflect actual moved path
      deniedAt: expect.any(String),
      imageName: "test-photo.jpg",
    });
    cleanup();
  });

  // ========== STORAGE CLEANUP VALIDATION ==========

  it("ensures pending image deleted after verification", async () => {
    const { verifyReport, fake, cleanup } = await setupFunctions();
    const reportId = "cleanup-verify";
    const pendingPath = `reports/pending/${reportId}/image.jpg`;
    const verifiedPath = `reports/verified/${reportId}/image.jpg`;

    fake.env.realtime.setValue(`pending/${reportId}`, {
      addedAt: "2025-01-01T00:00:00.000Z",
      address: "123 Cleanup St",
      imagePath: pendingPath,
      lat: 1,
      lng: 2,
      reported: 1,
    });
    fake.env.bucket.seed(pendingPath);

    await verifyReport({ data: { reportId }, auth } as any);

    expect(fake.env.bucket.has(pendingPath)).toBe(false);
    expect(fake.env.bucket.has(verifiedPath)).toBe(true);
    cleanup();
  });

  it("ensures pending image deleted after denial", async () => {
    const { denyReport, fake, cleanup } = await setupFunctions();
    const reportId = "cleanup-deny";
    const pendingPath = `reports/pending/${reportId}/photo.jpg`;

    fake.env.realtime.setValue(`pending/${reportId}`, {
      addedAt: "2025-01-01T00:00:00.000Z",
      address: "456 Cleanup St",
      imagePath: pendingPath,
      lat: 5,
      lng: 6,
      reported: 1,
    });
    fake.env.bucket.seed(pendingPath);

    await denyReport({ data: { reportId }, auth } as any);

    expect(fake.env.bucket.has(pendingPath)).toBe(false);
    expect(fake.env.bucket.has(`reports/denied/photo.jpg`)).toBe(true);
    cleanup();
  });

  it("ensures pending data and image deleted after delete operation", async () => {
    const { deletePendingReport, fake, cleanup } = await setupFunctions();
    const reportId = "full-delete";
    const imagePath = `reports/pending/${reportId}/photo.jpg`;

    fake.env.realtime.setValue(`pending/${reportId}`, {
      addedAt: "2025-01-01T00:00:00.000Z",
      address: "789 Delete St",
      imagePath,
      lat: 9,
      lng: 10,
      reported: 1,
    });
    fake.env.bucket.seed(imagePath);

    await deletePendingReport({ data: { reportId }, auth } as any);

    expect(fake.env.realtime.getValue(`pending/${reportId}`)).toBeUndefined();
    expect(fake.env.bucket.has(imagePath)).toBe(false);
    cleanup();
  });
});
