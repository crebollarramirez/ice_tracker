export async function onSubmitReport({
  data, // { address, additionalInfo, image: FileList }
  auth,
  storage,
  pinFunction, // callable fn (already wrapped with httpsCallable)
  toast, // optional: ({title, description, variant}) => void

  // Inject ALL external deps so they're mockable:
  signInAnonymously,
  storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,

  // Optional injectable clock for testability
  now = () => new Date().toISOString(),
}) {
  let uploadedRef = null;

  try {
    // 1) Ensure (anonymous) auth
    let currentUser = auth.currentUser;
    if (!currentUser) {
      const cred = await signInAnonymously(auth);
      currentUser = cred.user;
    }
    const uid = currentUser.uid;

    // 2) Gather form data
    const imageFile = data.image[0];
    const address = data.address.trim();
    const additionalInfo = data.additionalInfo.trim();

    // 3) Build storage path with timestamp (backend will generate reportId)
    const timestamp = Date.now();
    const extMap = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/webp": "webp",
      "image/heic": "jpg",
    };
    const fileExtension = extMap[imageFile.type] || "jpg";
    const storagePath = `reports/pending/${uid}/${timestamp}.${fileExtension}`;

    // 4) Upload image (set contentType)
    uploadedRef = storageRef(storage, storagePath);
    await uploadBytes(uploadedRef, imageFile, { contentType: imageFile.type });

    // 5) Get download URL
    const imageUrl = await getDownloadURL(uploadedRef);

    // 6) Call function with payload (backend generates reportId)
    const result = await pinFunction({
      addedAt: now(),
      address,
      additionalInfo,
      imageUrl,
      imagePath: storagePath,
    });

    // 7) Optional UX feedback (injectable)
    if (toast) {
      toast({
        title: "Report submitted successfully",
        description: "Thank you for helping keep the community informed.",
      });
    }

    // Return useful data for the caller (backend-generated reportId)
    return {
      reportId: result.data?.reportId,
      imagePath: storagePath,
      imageUrl,
    };
  } catch (error) {
    // Best-effort orphan cleanup if upload succeeded but pin failed
    if (uploadedRef) {
      try {
        await deleteObject(uploadedRef);
      } catch {}
    }

    let errorMessage = "Please try again later.";
    if (error && typeof error.code === "string") {
      if (error.code.startsWith("storage/")) {
        switch (error.code) {
          case "storage/unauthorized":
            errorMessage =
              "You don't have permission to upload images. Please refresh and try again.";
            break;
          case "storage/canceled":
            errorMessage = "Upload was canceled.";
            break;
          case "storage/unknown":
            errorMessage = "An unknown error occurred during upload.";
            break;
          default:
            errorMessage = `Upload failed: ${error.message}`;
        }
      } else if (error.code.startsWith("functions/")) {
        switch (error.code) {
          case "functions/invalid-argument":
            errorMessage =
              error.message ||
              "Please provide a valid address that can be found on the map";
            break;
          case "functions/failed-precondition":
            errorMessage =
              error.message ||
              "Please avoid using negative or abusive language.";
            break;
          case "functions/not-found":
            errorMessage =
              error.message ||
              "Please provide a valid address that can be found on the map";
            break;
          case "functions/internal":
            errorMessage =
              error.message || "An error occurred while submitting the form";
            break;
          default:
            errorMessage =
              error.message || "An error occurred while submitting the form";
        }
      } else if (error.code.startsWith("auth/")) {
        errorMessage = "Authentication failed. Please refresh and try again.";
      }
    }

    if (toast) {
      toast({
        title: "Submission failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
    throw error; // let caller handle UI state/reset
  }
}
