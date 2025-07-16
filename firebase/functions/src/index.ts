import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { sanitizeInput } from "./utils/addressHandling";
import { GoogleGeocodingService } from "./utils/geocodingService";
import { OpenAIService } from "./utils/aiFilter";

// Initialize Firebase Admin
admin.initializeApp();

setGlobalOptions({ maxInstances: 10 });

// Create geocoding service instance
const geocodingService = new GoogleGeocodingService();

// Create AI filter service instance
const aiFilterService = new OpenAIService();

interface GivenPinData {
  addedAt: string;
  additionalInfo: string;
  address: string;
}

/**
 * HTTP Cloud Function for creating and storing location pins with geocoding and content filtering.
 * 
 * This function accepts POST requests to create location pins with the following features:
 * - Input validation and sanitization for XSS protection
 * - Address geocoding using Google Maps API
 * - Content filtering for inappropriate language using OpenAI
 * - Storage in Firebase Realtime Database
 * 
 * @route POST /pin
 * 
 * @param {Object} req.body - The request body containing pin data
 * @param {string} req.body.addedAt - ISO 8601 timestamp when the pin was created (required)
 * @param {string} req.body.address - Street address to be geocoded (required)
 * @param {string} req.body.additionalInfo - Optional additional information about the location
 * 
 * @returns {Object} Response object with the following structure:
 * 
 * @success {200} Success - Pin created successfully
 * @success {Object} response - Success response
 * @success {string} response.message - Success message
 * @success {string} response.formattedAddress - Google-formatted address
 * 
 * @error {405} Method Not Allowed - Non-POST requests
 * @error {string} response - "Method Not Allowed"
 * 
 * @error {400} Bad Request - Missing required fields
 * @error {string} response - "Missing required fields: addedAt and address"
 * 
 * @error {400} Bad Request - Invalid address after sanitization
 * @error {string} response - "Invalid address provided"
 * 
 * @error {422} Unprocessable Entity - Inappropriate content detected
 * @error {Object} response - Error response with details
 * @error {string} response.error - "Negative content detected"
 * @error {string} response.message - User-friendly error message
 * 
 * @error {400} Bad Request - Address not found during geocoding
 * @error {Object} response - Error response with details
 * @error {string} response.error - "Could not geocode the provided address"
 * @error {string} response.message - User-friendly error message
 * 
 * @error {500} Internal Server Error - Database or unexpected errors
 * @error {string} response - "Internal server error"
 * 
 * @example
 * // Example request body:
 * {
 *   "addedAt": "2025-07-15T12:00:00.000Z",
 *   "address": "1600 Amphitheatre Parkway, Mountain View, CA",
 *   "additionalInfo": "2 vans outside"
 * }
 * 
 * @example
 * // Example success response:
 * {
 *   "message": "Data logged and saved successfully",
 *   "formattedAddress": "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA"
 * }
 * 
 * @security
 * - All user inputs are sanitized to prevent XSS attacks
 * - HTML tags and dangerous characters are removed from inputs
 * - Content is filtered for inappropriate language using AI
 * - Input length is limited to prevent abuse
 * 
 * @dependencies
 * - Google Maps Geocoding API (requires GOOGLE_MAPS_API_KEY environment variable)
 * - OpenAI API (requires OPENAI_API_KEY environment variable)
 * - Firebase Realtime Database
 */
export const pin = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const data = req.body as GivenPinData;

  // Validate the data structure
  if (!data.addedAt || !data.address) {
    res.status(400).send("Missing required fields: addedAt and address");
    return;
  }

  // Sanitize the address input
  const sanitizedAddress = sanitizeInput(data.address);

  // Sanitize additionalInfo to prevent injection attacks, default to empty string if not provided
  const sanitizedAdditionalInfo = sanitizeInput(data.additionalInfo || "");

  if (!sanitizedAddress.trim()) {
    res.status(400).send("Invalid address provided");
    return;
  }

  const isNegative = await aiFilterService.isNegative(sanitizedAdditionalInfo);

  if (isNegative) {

    // Log negative content to separate database for monitoring
    try {
      const db = admin.firestore();
      await db.collection("negative").add({
        addedAt: data.addedAt,
        address: sanitizedAddress,
        additionalInfo: sanitizedAdditionalInfo,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error saving negative content to database:", error);
    }
    res.status(422).json({
      error: "Negative content detected",
      message: "Please avoid using negative or abusive language in the additional info",
    });
    return;
  }

  const geocodeResult = await geocodingService.geocodeAddress(sanitizedAddress);

  if (!geocodeResult) {
    res.status(400).json({
      error: "Could not geocode the provided address",
      message: "Please provide a valid address that can be found on the map",
    });
    return;
  }

  // Create final location data with geocoded coordinates and formatted address
  const finalLocationData = {
    addedAt: data.addedAt,
    address: geocodeResult.formattedAddress,
    additionalInfo: sanitizedAdditionalInfo,
    lat: geocodeResult.lat,
    lng: geocodeResult.lng,
  };

  // Database operations need error handling since they can throw exceptions
  try {
    const db = admin.database();
    const newLocationRef = db.ref("locations").push();
    await newLocationRef.set(finalLocationData);

    logger.info("POST request received and saved to database:", {
      locationId: newLocationRef.key,
      ...finalLocationData,
    });

    res.status(200).json({
      message: "Data logged and saved successfully",
      formattedAddress: finalLocationData.address,
    });
  } catch (error) {
    logger.error("Error saving to database:", error);
    res.status(500).send("Internal server error");
  }
});