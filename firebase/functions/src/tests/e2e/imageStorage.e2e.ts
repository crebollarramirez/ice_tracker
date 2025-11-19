import { ImageStorage } from "../../database/ImageStorage";

jest.mock("firebase-functions/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "test-uuid-token"),
}));

class FakeBucket {
  name = "test-bucket.appspot.com";
  private files = new Map<string, FakeFile>();

  file(path: string) {
    if (!this.files.has(path)) {
      this.files.set(path, new FakeFile(path));
    }
    return this.files.get(path)!;
  }

  seed(path: string, content = "file-content") {
    const file = this.file(path);
    file.seed(content);
    return file;
  }

  has(path: string) {
    return this.files.get(path)?.existsSync ?? false;
  }
}

class FakeFile {
  public metadata: Record<string, any> = {};
  public existsSync = false;
  private storedContent = "";

  constructor(public name: string) {}

  seed(content: string) {
    this.existsSync = true;
    this.storedContent = content;
  }

  async exists() {
    return [this.existsSync];
  }

  async copy(destinationFile: FakeFile) {
    if (!this.existsSync) throw new Error("Source missing");
    destinationFile.existsSync = true;
    destinationFile.storedContent = this.storedContent;
    destinationFile.metadata = { ...this.metadata };
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

describe("ImageStorage - E2E", () => {
  let bucket: FakeBucket;
  let storage: ImageStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    bucket = new FakeBucket();
    storage = new ImageStorage(bucket as any);
  });

  it("moves image and generates permanent URL", async () => {
    bucket.seed("reports/pending/test.jpg");

    const result = await storage.moveImageAndGenerateUrl(
      "reports/pending/test.jpg",
      "reports/verified/abc/test.jpg"
    );

    expect(result.imageUrl).toBe(
      "https://firebasestorage.googleapis.com/v0/b/test-bucket.appspot.com/o/reports%2Fverified%2Fabc%2Ftest.jpg?alt=media&token=test-uuid-token"
    );
    expect(bucket.has("reports/pending/test.jpg")).toBe(false);
    expect(bucket.has("reports/verified/abc/test.jpg")).toBe(true);
  });

  it("moves image to verified directory", async () => {
    bucket.seed("reports/pending/user/img.png");
    const { imageUrl } = await storage.moveImageToVerified(
      { imagePath: "reports/pending/user/img.png" },
      "report-123"
    );

    expect(imageUrl).toContain(
      "reports%2Fverified%2Freport-123%2Fimg.png?alt=media&token=test-uuid-token"
    );
    expect(bucket.has("reports/pending/user/img.png")).toBe(false);
    expect(bucket.has("reports/verified/report-123/img.png")).toBe(true);
  });

  it("moves image to denied directory", async () => {
    bucket.seed("reports/pending/deny/img.png");
    const newPath = await storage.moveImageToDenied({
      imagePath: "reports/pending/deny/img.png",
    });

    expect(newPath).toBe("reports/denied/img.png");
    expect(bucket.has("reports/pending/deny/img.png")).toBe(false);
    expect(bucket.has("reports/denied/img.png")).toBe(true);
  });

  it("reuses existing download token", async () => {
    const file = bucket.seed("reports/pending/test2.jpg");
    file.metadata = { firebaseStorageDownloadTokens: "existing-token" };

    const { imageUrl } = await storage.moveImageAndGenerateUrl(
      "reports/pending/test2.jpg",
      "reports/verified/abc/test2.jpg"
    );

    expect(imageUrl).toContain("existing-token");
  });

  it("exposes bucket name", () => {
    expect(storage.getBucketName()).toBe("test-bucket.appspot.com");
  });
});
