import functionsTest from "firebase-functions-test";
import { HttpsError } from "firebase-functions/v2/https";

const createRealtimeMock = () => ({
  getPendingReport: jest.fn(),
  getVerifiedReport: jest.fn(),
  updateReport: jest.fn(),
  saveVerifiedReport: jest.fn(),
  removePendingReport: jest.fn(),
});

const createImageStorageMock = () => ({
  moveImageToVerified: jest.fn(),
  moveImageToDenied: jest.fn(),
  deleteFile: jest.fn(),
});

const createCollectionsMock = () => ({
  logVerification: jest.fn(),
  logDenial: jest.fn(),
});

const realtimeMock = createRealtimeMock();
const imageStorageMock = createImageStorageMock();
const collectionsMock = createCollectionsMock();

jest.mock("../../database/RealtimeDB", () => ({
  RealtimeDB: jest.fn().mockImplementation(() => realtimeMock),
}));

jest.mock("../../database/ImageStorage", () => ({
  ImageStorage: jest.fn().mockImplementation(() => imageStorageMock),
}));

jest.mock("../../database/Collection", () => ({
  Collections: jest.fn().mockImplementation(() => collectionsMock),
}));

jest.mock("../../auth/auth", () => ({
  requireVerifierRole: jest.fn().mockImplementation((auth) => {
    if (!auth) throw new HttpsError("unauthenticated", "Authentication required");
    return { uid: auth.uid ?? "verifier-uid" };
  }),
}));

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  database: jest.fn(() => ({ ref: jest.fn() })),
  firestore: jest.fn(() => ({ collection: jest.fn() })),
  storage: jest.fn(() => ({
    bucket: jest.fn(() => ({})),
  })),
}));

const { verifyReport, denyReport, deletePendingReport } = require("../../index");
const testEnv = functionsTest({ projectId: "iceinmyarea" });
const wrappedVerifyReport = testEnv.wrap(verifyReport) as any;
const wrappedDenyReport = testEnv.wrap(denyReport) as any;
const wrappedDeletePendingReport = testEnv.wrap(deletePendingReport) as any;

const baseAuth = { uid: "verifier-uid", token: { role: "verifier" } };

const pendingReport = {
  addedAt: "2025-01-01T00:00:00.000Z",
  additionalInfo: "details",
  address: "123 Main St",
  imagePath: "reports/pending/report-1/image.jpg",
  lat: 10,
  lng: 20,
  reported: 1,
};

describe("verifyReport – integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(realtimeMock).forEach((fn: any) => fn.mockReset?.());
    Object.values(imageStorageMock).forEach((fn: any) => fn.mockReset?.());
    Object.values(collectionsMock).forEach((fn: any) => fn.mockReset?.());
  });

  it("creates a verified record from pending data", async () => {
    realtimeMock.getVerifiedReport.mockResolvedValue(null);
    realtimeMock.getPendingReport.mockResolvedValue(pendingReport);
    imageStorageMock.moveImageToVerified.mockResolvedValue({
      imageUrl: "https://example.com/verified.jpg",
    });

    const result = await wrappedVerifyReport({
      data: { reportId: "report-1" },
      auth: baseAuth,
    });

    expect(result).toEqual({
      success: true,
      message: "Report report-1 verified successfully",
    });
    expect(imageStorageMock.moveImageToVerified).toHaveBeenCalledWith(
      pendingReport,
      "report-1"
    );
    expect(collectionsMock.logVerification).toHaveBeenCalledWith({
      reportId: "report-1",
      verifierUid: "verifier-uid",
      reportAddress: pendingReport.address,
    });
    expect(realtimeMock.saveVerifiedReport).toHaveBeenCalledWith(
      "report-1",
      expect.objectContaining({
        address: pendingReport.address,
        imageUrl: "https://example.com/verified.jpg",
      })
    );
    expect(realtimeMock.removePendingReport).toHaveBeenCalled();
  });

  it("increments existing verified report and deletes pending image", async () => {
    realtimeMock.getVerifiedReport.mockResolvedValue({ reported: 5 });
    realtimeMock.getPendingReport.mockResolvedValue(pendingReport);
    realtimeMock.updateReport.mockResolvedValue(true);
    imageStorageMock.moveImageToVerified.mockResolvedValue({
      imageUrl: "url",
    });

    await wrappedVerifyReport({
      data: { reportId: "report-2" },
      auth: baseAuth,
    });

    expect(realtimeMock.updateReport).toHaveBeenCalledWith("report-2");
    expect(imageStorageMock.deleteFile).toHaveBeenCalledWith(
      pendingReport.imagePath
    );
    expect(realtimeMock.removePendingReport).toHaveBeenCalledTimes(2);
  });

  it("throws when pending report is missing", async () => {
    realtimeMock.getPendingReport.mockResolvedValue(null);

    await expect(
      wrappedVerifyReport({ data: { reportId: "missing" }, auth: baseAuth })
    ).rejects.toThrow("Report with ID missing not found in pending reports");
  });
});

describe("denyReport – integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(realtimeMock).forEach((fn: any) => fn.mockReset?.());
    Object.values(imageStorageMock).forEach((fn: any) => fn.mockReset?.());
    Object.values(collectionsMock).forEach((fn: any) => fn.mockReset?.());
  });

  it("moves image to denied path and logs denial", async () => {
    realtimeMock.getPendingReport.mockResolvedValue(pendingReport);
    imageStorageMock.moveImageToDenied.mockResolvedValue(
      "reports/denied/image.jpg"
    );

    const response = await wrappedDenyReport({
      data: { reportId: "report-3" },
      auth: baseAuth,
    });

    expect(response).toEqual({
      success: true,
      message: "Report report-3 denied successfully",
    });
    expect(imageStorageMock.moveImageToDenied).toHaveBeenCalledWith(
      pendingReport
    );
    expect(collectionsMock.logDenial).toHaveBeenCalledWith({
      verifierUid: "verifier-uid",
      reportAddress: pendingReport.address,
      imagePath: "reports/denied/image.jpg",
    });
    expect(realtimeMock.removePendingReport).toHaveBeenCalledWith("report-3");
  });

  it("throws not-found when pending report missing", async () => {
    realtimeMock.getPendingReport.mockResolvedValue(null);

    await expect(
      wrappedDenyReport({ data: { reportId: "missing-deny" }, auth: baseAuth })
    ).rejects.toThrow("Report with ID missing-deny not found in pending reports");
  });
});

describe("deletePendingReport – integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(realtimeMock).forEach((fn: any) => fn.mockReset?.());
    Object.values(imageStorageMock).forEach((fn: any) => fn.mockReset?.());
  });

  it("deletes pending report and associated image", async () => {
    realtimeMock.getPendingReport.mockResolvedValue(pendingReport);

    const result = await wrappedDeletePendingReport({
      data: { reportId: "report-4" },
      auth: baseAuth,
    });

    expect(result).toEqual({
      success: true,
      message: "Report report-4 deleted successfully",
    });
    expect(imageStorageMock.deleteFile).toHaveBeenCalledWith(
      pendingReport.imagePath
    );
    expect(realtimeMock.removePendingReport).toHaveBeenCalledWith("report-4");
  });

  it("throws when pending report missing", async () => {
    realtimeMock.getPendingReport.mockResolvedValue(null);

    await expect(
      wrappedDeletePendingReport({
        data: { reportId: "missing-delete" },
        auth: baseAuth,
      })
    ).rejects.toThrow("Report with ID missing-delete not found in pending reports");
  });
});
afterAll(() => {
  testEnv.cleanup();
});
