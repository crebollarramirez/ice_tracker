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

    // 3) First, verify reCAPTCHA with backend BEFORE uploading image
    console.log("🔒 Starting reCAPTCHA verification before image upload...");
    console.log("Security data available:", {
      hasV3Token:
        data.recaptchaV3Token !== undefined && data.recaptchaV3Token !== null,
      hasV2Token:
        data.recaptchaV2Token !== undefined && data.recaptchaV2Token !== null,
      hasHoneypot: data.honeypot !== undefined,
      hasStartedAt: data.startedAt !== undefined,
      v3TokenLength: data.recaptchaV3Token?.length || 0,
      v2TokenLength: data.recaptchaV2Token?.length || 0,
    });

    const verificationPayload = {
      addedAt: now(),
      address,
      additionalInfo,
      imagePath: "temp", // Temporary placeholder for verification
    };

    // Add security data for verification
    if (data.recaptchaV3Token !== undefined) {
      verificationPayload.v3Token = data.recaptchaV3Token;
      verificationPayload.siteKeyV3 =
        process.env.NEXT_PUBLIC_RECAPTCHAV3_SITE_KEY;
    }
    if (data.recaptchaV2Token !== undefined) {
      verificationPayload.v2Token = data.recaptchaV2Token;
    }
    if (data.honeypot !== undefined)
      verificationPayload.honeypot = data.honeypot;
    if (data.startedAt !== undefined)
      verificationPayload.startedAt = data.startedAt;

    console.log("📤 Sending verification payload:", {
      ...verificationPayload,
      v3Token: verificationPayload.v3Token
        ? `${verificationPayload.v3Token.substring(0, 20)}...`
        : null,
      v2Token: verificationPayload.v2Token
        ? `${verificationPayload.v2Token.substring(0, 20)}...`
        : null,
    });

    // Verify with backend first (this will throw if reCAPTCHA fails)
    try {
      await pinFunction(verificationPayload);
      console.log(
        "✅ reCAPTCHA verification successful, proceeding with image upload"
      );
    } catch (verificationError) {
      console.error("❌ reCAPTCHA verification failed:", verificationError);
      throw verificationError; // Re-throw to prevent image upload
    }

    // 4) Only upload image AFTER reCAPTCHA verification passes
    console.log(
      "📁 Starting image upload after successful reCAPTCHA verification..."
    );
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

    console.log(
      "📤 Uploading image to:",
      storagePath,
      "Size:",
      imageFile.size,
      "Type:",
      imageFile.type
    );
    uploadedRef = storageRef(storage, storagePath);
    await uploadBytes(uploadedRef, imageFile, { contentType: imageFile.type });
    console.log("✅ Image upload successful");

    // 5) Call function again with real image path for final submission
    console.log("🎯 Starting final submission with uploaded image...");
    const finalPayload = {
      addedAt: now(),
      address,
      additionalInfo,
      imagePath: storagePath,
    };

    // Add security data for final submission
    if (data.recaptchaV3Token !== undefined) {
      finalPayload.v3Token = data.recaptchaV3Token;
      finalPayload.siteKeyV3 = process.env.NEXT_PUBLIC_RECAPTCHAV3_SITE_KEY;
    }
    if (data.recaptchaV2Token !== undefined) {
      finalPayload.v2Token = data.recaptchaV2Token;
    }
    if (data.honeypot !== undefined) finalPayload.honeypot = data.honeypot;
    if (data.startedAt !== undefined) finalPayload.startedAt = data.startedAt;

    console.log("📤 Sending final payload:", {
      ...finalPayload,
      v3Token: finalPayload.v3Token
        ? `${finalPayload.v3Token.substring(0, 20)}...`
        : null,
      v2Token: finalPayload.v2Token
        ? `${finalPayload.v2Token.substring(0, 20)}...`
        : null,
    });

    const result = await pinFunction(finalPayload);
    console.log("✅ Final submission successful:", result?.data?.reportId);

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
    };
  } catch (error) {
    console.error("💥 Submission failed at stage:", error);
    console.error("Error details:", {
      code: error?.code,
      message: error?.message,
      stack: error?.stack?.split("\n")[0],
    });

    // Best-effort orphan cleanup if upload succeeded but pin failed
    if (uploadedRef) {
      console.log("🧹 Cleaning up uploaded image due to error...");
      try {
        await deleteObject(uploadedRef);
        console.log("✅ Image cleanup successful");
      } catch (cleanupError) {
        console.warn("⚠️ Image cleanup failed:", cleanupError);
      }
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
            // Check for reCAPTCHA-related errors
            if (error.message && error.message.includes("reCAPTCHA")) {
              // This will trigger the v2 fallback in the security hook
              throw error;
            }
            errorMessage =
              error.message ||
              "Please avoid using negative or abusive language.";
            break;
          case "functions/permission-denied":
            // Handle reCAPTCHA verification failures
            if (
              error.message &&
              (error.message.includes("requires_v2_challenge") ||
                error.message.includes("Low reCAPTCHA score") ||
                error.message.includes("Invalid reCAPTCHA"))
            ) {
              // This will trigger the v2 fallback in the security hook
              throw error;
            }
            errorMessage =
              error.message || "Permission denied. Please try again.";
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
