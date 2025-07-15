import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { sanitizeInput } from "./utils/addressHanding";
import { GoogleGeocodingService } from "./utils/geocodingService";

// Initialize Firebase Admin
admin.initializeApp();

setGlobalOptions({ maxInstances: 10 });

// Create geocoding service instance
const geocodingService = new GoogleGeocodingService();

interface GivenPinData {
  addedAt: string;
  additionalInfo: string;
  address: string;
}

export const pin = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const data = req.body as GivenPinData;

    // Validate the data structure
    if (!data.addedAt || !data.address) {
      res.status(400).send("Missing required fields: addedAt and address");
      return;
    }

    // Sanitize the address input
    const sanitizedAddress = sanitizeInput(data.address);
    const sanitizedAdditionalInfo = sanitizeInput(data.additionalInfo || "");

    if (!sanitizedAddress.trim()) {
      res.status(400).send("Invalid address provided");
      return;
    }
    
    const geocodeResult = await geocodingService.geocodeAddress(
      sanitizedAddress
    );

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

    // Get a reference to the Realtime Database
    const db = admin.database();

    // Add the location data to the database
    // This will generate a unique key for each entry
    const newLocationRef = db.ref("locations").push();
    await newLocationRef.set(finalLocationData);

    logger.info("POST request received and saved to database:", {
      locationId: newLocationRef.key,
      ...finalLocationData
    });

    res.status(200).json({
      message: "Data logged and saved successfully",
      formattedAddress: finalLocationData.address,
    });
  } catch (error) {
    logger.error("Error processing request:", error);
    res.status(500).send("Internal server error");
  }
});
