import { onSubmitReport } from "../submission";

describe("onSubmitReport", () => {
  const UID = "test-uid";
  const FIXED_NOW = "2025-01-01T12:34:56.000Z";
  const FIXED_TIMESTAMP = 1700000000000;
  const IMAGE_FILE = { type: "image/jpeg", name: "test.jpg" };

  let auth;
  let storage;
  let signInAnonymously;
  let storageRef;
  let uploadBytes;
  let deleteObject;
  let pinFunction;
  let toast;
  let now;

  beforeEach(() => {
    // Freeze Date.now() so storage path is deterministic
    jest.spyOn(Date, "now").mockReturnValue(FIXED_TIMESTAMP);

    auth = { currentUser: { uid: UID } };
    storage = {};

    signInAnonymously = jest.fn();

    storageRef = jest.fn().mockImplementation((_storage, path) => ({ path }));
    uploadBytes = jest.fn().mockResolvedValue({});
    deleteObject = jest.fn().mockResolvedValue();

    // Simulate a successful callable function
    pinFunction = jest.fn().mockResolvedValue({
      data: {
        reportId: "report-123",
        message: "Data logged and saved successfully",
      },
    });

    toast = jest.fn();
    now = jest.fn(() => FIXED_NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const makeData = (overrides = {}) => ({
    address: "  123 Main St  ",
    additionalInfo: "  some info  ",
    image: [IMAGE_FILE],
    ...overrides,
  });

  const buildDeps = (overrides = {}) => ({
    auth,
    storage,
    pinFunction,
    toast,
    signInAnonymously,
    storageRef,
    uploadBytes,
    deleteObject,
    now,
    ...overrides,
  });

  test("uploads image, calls pinFunction, and returns report data on success", async () => {
    const data = makeData();

    const result = await onSubmitReport({ data, ...buildDeps() });

    // Correct storage path & upload
    expect(storageRef).toHaveBeenCalledWith(
      storage,
      `reports/pending/${UID}/${FIXED_TIMESTAMP}.jpg`
    );
    const uploadedRef = storageRef.mock.results[0].value;

    expect(uploadBytes).toHaveBeenCalledWith(uploadedRef, IMAGE_FILE, {
      contentType: IMAGE_FILE.type,
    });

    // Correct payload to pinFunction (no imageUrl - backend handles it)
    expect(pinFunction).toHaveBeenCalledWith({
      addedAt: FIXED_NOW,
      address: "123 Main St", // trimmed
      additionalInfo: "some info", // trimmed
      imagePath: `reports/pending/${UID}/${FIXED_TIMESTAMP}.jpg`,
    });

    // Success toast
    expect(toast).toHaveBeenCalledWith({
      title: "Report submitted successfully",
      description: "Thank you for helping keep the community informed.",
    });

    // Return value (no imageUrl - backend handles it)
    expect(result).toEqual({
      reportId: "report-123",
      imagePath: `reports/pending/${UID}/${FIXED_TIMESTAMP}.jpg`,
    });
  });

  test("signs in anonymously when there is no current user and uses that uid", async () => {
    auth.currentUser = null;
    const anonUser = { uid: "anon-uid" };
    signInAnonymously.mockResolvedValue({ user: anonUser });

    const data = makeData();
    await onSubmitReport({ data, ...buildDeps() });

    expect(signInAnonymously).toHaveBeenCalledWith(auth);
    expect(storageRef).toHaveBeenCalledWith(
      storage,
      `reports/pending/${anonUser.uid}/${FIXED_TIMESTAMP}.jpg`
    );
  });

  test("shows auth error and rethrows when anonymous sign-in fails", async () => {
    auth.currentUser = null;
    const error = Object.assign(new Error("sign-in failed"), {
      code: "auth/network-request-failed",
    });
    signInAnonymously.mockRejectedValue(error);

    const data = makeData();

    await expect(onSubmitReport({ data, ...buildDeps() })).rejects.toBe(error);

    // No upload, so no cleanup
    expect(deleteObject).not.toHaveBeenCalled();

    expect(toast).toHaveBeenCalledWith({
      title: "Submission failed",
      description: "Authentication failed. Please refresh and try again.",
      variant: "destructive",
    });
  });

  test("maps storage/unauthorized error, cleans up, and rethrows", async () => {
    const storageError = Object.assign(new Error("unauthorized"), {
      code: "storage/unauthorized",
    });
    uploadBytes.mockRejectedValue(storageError);

    const data = makeData();

    await expect(onSubmitReport({ data, ...buildDeps() })).rejects.toBe(
      storageError
    );

    const uploadedRef = storageRef.mock.results[0].value;
    expect(deleteObject).toHaveBeenCalledWith(uploadedRef);

    expect(toast).toHaveBeenCalledWith({
      title: "Submission failed",
      description:
        "You don't have permission to upload images. Please refresh and try again.",
      variant: "destructive",
    });
  });

  test("maps functions/invalid-argument to address error and cleans up", async () => {
    // This corresponds to: missing addedAt/address, bad date format, date not today, etc.
    const fnError = Object.assign(new Error(), {
      code: "functions/invalid-argument",
      message: undefined, // triggers default message
    });
    pinFunction.mockRejectedValue(fnError);

    const data = makeData();

    await expect(onSubmitReport({ data, ...buildDeps() })).rejects.toBe(
      fnError
    );

    const uploadedRef = storageRef.mock.results[0].value;
    expect(deleteObject).toHaveBeenCalledWith(uploadedRef);

    expect(toast).toHaveBeenCalledWith({
      title: "Submission failed",
      description:
        "Please provide a valid address that can be found on the map",
      variant: "destructive",
    });
  });

  test("maps functions/not-found to address error (location not found)", async () => {
    const fnError = Object.assign(new Error(), {
      code: "functions/not-found",
      message: undefined,
    });
    pinFunction.mockRejectedValue(fnError);

    const data = makeData();

    await expect(onSubmitReport({ data, ...buildDeps() })).rejects.toBe(
      fnError
    );

    expect(toast).toHaveBeenCalledWith({
      title: "Submission failed",
      description:
        "Please provide a valid address that can be found on the map",
      variant: "destructive",
    });
  });

  test("maps functions/failed-precondition to negative language error", async () => {
    // This corresponds to negative content in additionalInfo
    const fnError = Object.assign(new Error(), {
      code: "functions/failed-precondition",
      message: undefined,
    });
    pinFunction.mockRejectedValue(fnError);

    const data = makeData();

    await expect(onSubmitReport({ data, ...buildDeps() })).rejects.toBe(
      fnError
    );

    expect(toast).toHaveBeenCalledWith({
      title: "Submission failed",
      description: "Please avoid using negative or abusive language.",
      variant: "destructive",
    });
  });

  test("uses backend error.message when provided for functions errors", async () => {
    const customMessage = "Custom backend validation message";
    const fnError = Object.assign(new Error(customMessage), {
      code: "functions/failed-precondition",
      message: customMessage,
    });
    pinFunction.mockRejectedValue(fnError);

    const data = makeData();

    await expect(onSubmitReport({ data, ...buildDeps() })).rejects.toBe(
      fnError
    );

    expect(toast).toHaveBeenCalledWith({
      title: "Submission failed",
      description: customMessage,
      variant: "destructive",
    });
  });

  test("falls back to generic message when error has no code", async () => {
    const genericError = new Error("weird error");
    uploadBytes.mockRejectedValue(genericError);

    const data = makeData();

    await expect(onSubmitReport({ data, ...buildDeps() })).rejects.toBe(
      genericError
    );

    expect(toast).toHaveBeenCalledWith({
      title: "Submission failed",
      description: "Please try again later.",
      variant: "destructive",
    });
  });

  test("uses correct file extension mapping and default", async () => {
    const pngFile = { type: "image/png" };
    const webpFile = { type: "image/webp" };
    const unknownFile = { type: "image/gif" };

    // jpeg (default branch for image/jpeg)
    await onSubmitReport({
      data: makeData({ image: [IMAGE_FILE] }),
      ...buildDeps(),
    });
    expect(storageRef).toHaveBeenNthCalledWith(
      1,
      storage,
      `reports/pending/${UID}/${FIXED_TIMESTAMP}.jpg`
    );

    // png
    await onSubmitReport({
      data: makeData({ image: [pngFile] }),
      ...buildDeps(),
    });
    expect(storageRef).toHaveBeenNthCalledWith(
      2,
      storage,
      `reports/pending/${UID}/${FIXED_TIMESTAMP}.png`
    );

    // webp
    await onSubmitReport({
      data: makeData({ image: [webpFile] }),
      ...buildDeps(),
    });
    expect(storageRef).toHaveBeenNthCalledWith(
      3,
      storage,
      `reports/pending/${UID}/${FIXED_TIMESTAMP}.webp`
    );

    // unknown type -> default jpg
    await onSubmitReport({
      data: makeData({ image: [unknownFile] }),
      ...buildDeps(),
    });
    expect(storageRef).toHaveBeenNthCalledWith(
      4,
      storage,
      `reports/pending/${UID}/${FIXED_TIMESTAMP}.jpg`
    );
  });
});
