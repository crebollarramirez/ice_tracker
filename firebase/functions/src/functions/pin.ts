import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { GoogleGeocodingService } from "../utils/geocodingService";
import { sanitizeInput, makeAddressKey } from "../utils/addressHandling";
import { isValidISO8601, isDateTodayUTC } from "../utils/utils";
import { PendingReport } from "../types/index";

// Initialize services USING MOCKS FOR TESTING
const geocodingService = new GoogleGeocodingService(true);

const realtimeDb = admin.database();

/**
 * Firebase Cloud Function to pin a location with address validation.
 *
 * This function accepts location data, validates and sanitizes the input, geocodes the address to get precise coordinates, and stores the location in Firebase Realtime Database under the `/pending` collection. It also ensures that the `additionalInfo` field is provided and sanitized to prevent injection attacks.
 *
 * ### Key Features:
 * - **Validation**: Ensures required fields are present and valid, including `addedAt`, `address`, `imagePath`, and `additionalInfo`.
 * - **Image Verification**: Validates that the image file exists in Firebase Storage before processing (currently commented out for testing).
 * - **Sanitization**: Cleans input fields to prevent injection attacks.
 * - **Geocoding**: Converts the address into precise coordinates and a formatted address using Google Maps API.
 * - **Duplicate Handling**: Updates existing entries or creates new ones, incrementing the `reported` count for duplicates.
 * - **Error Handling**: Logs and throws detailed errors for validation, geocoding, and database operations.
 *
 * ### Workflow:
 * 1. Validate required fields (`addedAt`, `address`, `imagePath`, `additionalInfo`).
 * 2. Sanitize the `address` and `additionalInfo` fields to prevent injection attacks.
 * 3. Geocode the sanitized address to retrieve coordinates and a formatted address.
 * 4. Check if the address already exists in the database:
 *    - If it exists, update the entry and increment the `reported` count.
 *    - If it does not exist, create a new entry.
 * 5. Save the location data to Firebase Realtime Database.
 * 6. Return a success message and the formatted address.
 *
 * @async
 * @function pin
 * @param {CallableRequest} request - The Firebase functions request object.
 * @param {object} request.data - The data payload containing location information.
 * @param {string} request.data.addedAt - ISO 8601 timestamp when the location was added (must be today's date in UTC).
 * @param {string} request.data.imagePath - Storage path of the image associated with the location (required).
 * @param {string} request.data.address - The physical address to be pinned (required).
 * @param {string} request.data.additionalInfo - Additional information about the location (required).
 * @returns {Promise<{message: string, formattedAddress: string}>} A promise that resolves to an object containing:
 *   - `message`: Success confirmation message.
 *   - `formattedAddress`: The geocoded and formatted address from Google Maps API.
 * @throws {HttpsError} If validation fails, geocoding fails, or database operations encounter an error.
 */
export const pin = onCall(async (request) => {
  logger.info("pin called", { data: request.data });

  const { data } = request;

  /** -------------------------------------------
   *  STEP 1 — Extract CAPTCHA tokens from client
   * --------------------------------------------*/
  const { v3Token, v2Token, siteKeyV3, preVerified } = data;

  // Skip reCAPTCHA verification if this is a pre-verified submission
  if (preVerified) {
    logger.info("Skipping reCAPTCHA verification for pre-verified submission");
  } else {
    // Must have either v3 token with site key, or v2 token
    if ((!v3Token || !siteKeyV3) && !v2Token) {
      throw new HttpsError(
        "failed-precondition",
        "Missing reCAPTCHA verification fields: must provide either v3Token+siteKeyV3 or v2Token"
      );
    }
  }

  const projectId = process.env.GCLOUD_PROJECT || "";
  const enterpriseApiKey = process.env.RECAPTCHA_ENTERPRISEV3_API_KEY || "";
  const v2Secret = process.env.RECAPTCHA_V2_SECRET_KEY || "";

  // Only perform reCAPTCHA verification if not pre-verified
  if (!preVerified) {
    // Check which verification method to use
    if (v3Token && siteKeyV3) {
      /** -------------------------------------------
       *  STEP 2 — Verify reCAPTCHA v3 Enterprise
       * --------------------------------------------*/
      logger.info("Verifying reCAPTCHA v3 token");
      const v3Response = await fetch(
        `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments?key=${enterpriseApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: {
              token: v3Token,
              siteKey: siteKeyV3,
              expectedAction: "submit",
            },
          }),
        }
      ).then((res) => res.json());

      if (v3Response.tokenProperties?.valid !== true) {
        throw new HttpsError(
          "permission-denied",
          `Invalid reCAPTCHA v3 token: ${v3Response.tokenProperties?.invalidReason}`
        );
      }

      const score = v3Response.riskAnalysis?.score ?? 0;
      logger.info("reCAPTCHA v3 score:", score);

      // If score is good, proceed
      if (score < 0.5) {
        // Low score → require v2 fallback
        if (!v2Token) {
          throw new HttpsError(
            "permission-denied",
            "Low reCAPTCHA score: requires_v2_challenge"
          );
        }

        /** -------------------------------------------
         *  STEP 3 — Verify reCAPTCHA v2 Checkbox (fallback)
         * --------------------------------------------*/
        logger.info("Low v3 score, verifying v2 token as fallback");
        const v2Verify = await fetch(
          `https://www.google.com/recaptcha/api/siteverify?secret=${v2Secret}&response=${v2Token}`,
          { method: "POST" }
        ).then((res) => res.json());

        if (!v2Verify.success) {
          throw new HttpsError(
            "permission-denied",
            "Invalid reCAPTCHA v2 challenge"
          );
        }
        logger.info("reCAPTCHA v2 verification successful (fallback)");
      } else {
        logger.info("reCAPTCHA v3 verification successful");
      }
    } else if (v2Token) {
      /** -------------------------------------------
       *  STEP 2 — Verify reCAPTCHA v2 Only
       * --------------------------------------------*/
      logger.info("Verifying reCAPTCHA v2 token only");
      const v2Verify = await fetch(
        `https://www.google.com/recaptcha/api/siteverify?secret=${v2Secret}&response=${v2Token}`,
        { method: "POST" }
      ).then((res) => res.json());

      if (!v2Verify.success) {
        throw new HttpsError(
          "permission-denied",
          "Invalid reCAPTCHA v2 challenge"
        );
      }
      logger.info("reCAPTCHA v2 verification successful");
    } else {
      throw new HttpsError(
        "failed-precondition",
        "No valid reCAPTCHA verification method provided"
      );
    }
  }

  // other logic

  if (!data.imagePath) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required field: imagePath"
    );
  }

  if (!data.addedAt || !data.address) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required fields: addedAt and address"
    );
  }

  if (isValidISO8601(data.addedAt) === false) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid date format for addedAt. Must be ISO 8601 format."
    );
  }

  if (isDateTodayUTC(data.addedAt) === false) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid date format for addedAt. Must be today's date in ISO 8601 format."
    );
  }

  if (!data.additionalInfo) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required fields: additionalInfo"
    );
  }

  const sanitizedAddress = sanitizeInput(data.address);
  const sanitizedAdditionalInfo = sanitizeInput(data.additionalInfo || "");

  if (!sanitizedAddress.trim()) {
    throw new HttpsError("invalid-argument", "Invalid address provided");
  }

  const geocodeResult = await geocodingService.geocodeAddress(sanitizedAddress);

  if (!geocodeResult) {
    throw new HttpsError(
      "not-found",
      "Please provide a valid address that can be found on the map"
    );
  }

  try {
    const addressKey = makeAddressKey(geocodeResult.formattedAddress);

    if (!addressKey) {
      throw new HttpsError(
        "invalid-argument",
        "Could not generate valid address key"
      );
    }

    const existingLocationRef = realtimeDb.ref(`pending/${addressKey}`);
    const existingSnapshot = await existingLocationRef.once("value");

    const locationId = addressKey;

    const finalLocationData: PendingReport = {
      addedAt: data.addedAt,
      address: geocodeResult.formattedAddress,
      additionalInfo: sanitizedAdditionalInfo,
      lat: geocodeResult.lat,
      lng: geocodeResult.lng,
      reported: existingSnapshot.exists()
        ? existingSnapshot.val().reported + 1
        : 1,
      imagePath: data.imagePath || "",
    };

    let isNewLocation = true;

    if (existingSnapshot.exists()) {
      logger.info("Updating existing location:", {
        addressKey,
        formattedAddress: geocodeResult.formattedAddress,
      });
      isNewLocation = false;
    } else {
      logger.info("Creating new location:", {
        addressKey,
        formattedAddress: geocodeResult.formattedAddress,
      });
    }

    await existingLocationRef.set(finalLocationData);

    logger.info("POST request received and saved to database:", {
      locationId,
      ...finalLocationData,
    });

    return {
      message: isNewLocation
        ? "Data logged and saved successfully"
        : "Location updated successfully",
      formattedAddress: finalLocationData.address,
    };
  } catch (error) {
    logger.error("Error saving to database:", error);
    throw new HttpsError("internal", "Internal server error");
  }
});
