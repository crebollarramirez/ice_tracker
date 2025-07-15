import { useState } from "react";
import { database } from "../firebase";
import { ref, push } from "firebase/database";
import { useTranslations } from "next-intl";

// Input sanitization function to prevent XSS
const sanitizeInput = (input) => {
  if (!input || typeof input !== "string") return "";
  // Remove HTML tags and potentially dangerous characters
  return input
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/[<>\"'&]/g, "") // Remove dangerous characters
    .trim()
    .substring(0, 500); // Limit length to prevent abuse
};

export default function AddressForm() {
  const t = useTranslations();
  const [address, setAddress] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);

  const testGoogleGeocodingAPI = async (query) => {
    try {
      setIsLoading(true);
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        query
      )}&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const result = data.results[0];

        return {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          address: result.formatted_address,
        };
      } else {
        alert(
          t("form.validation.noResults", { status: data.status || "Unknown" })
        );
        return null;
      }
    } catch (error) {
      console.error("Google Geocoding API error:", error);
      alert(t("form.validation.apiError"));
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to save location to Firebase
  const saveLocationToFirebase = async (locationData) => {
    try {
      // Basic validation
      if (!locationData.address || !locationData.lat || !locationData.lng) {
        throw new Error("Invalid location data");
      }

      // Sanitize user inputs before saving
      const sanitizedAddress = sanitizeInput(locationData.address);
      const sanitizedAdditionalInfo = sanitizeInput(
        locationData.additionalInfo || ""
      );

      // Validate coordinates are within reasonable bounds
      if (Math.abs(locationData.lat) > 90 || Math.abs(locationData.lng) > 180) {
        throw new Error("Invalid coordinates");
      }

      // Rate limiting - prevent spam (store last submission time)
      const lastSubmission = localStorage.getItem("lastICEReport");
      const now = Date.now();
      if (lastSubmission && now - parseInt(lastSubmission) < 60000) {
        // 1 minute cooldown
        alert(t("form.validation.rateLimitError"));
        return null;
      }

      const locationsRef = ref(database, "locations");
      const newLocationRef = await push(locationsRef, {
        address: sanitizedAddress,
        additionalInfo: sanitizedAdditionalInfo,
        addedAt: new Date().toISOString(),
        lat: Number(locationData.lat),
        lng: Number(locationData.lng),
      });

      // Set rate limiting
      localStorage.setItem("lastICEReport", now.toString());
      return newLocationRef.key;
    } catch (error) {
      alert(t("form.validation.saveError"));
      return null;
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Sanitize input before processing
    const sanitizedAddress = sanitizeInput(address);
    const sanitizedAdditionalInfo = sanitizeInput(additionalInfo);

    if (!sanitizedAddress.trim()) {
      alert(t("form.validation.enterAddress"));
      return;
    }
    const location = await testGoogleGeocodingAPI(sanitizedAddress);

    if (location) {
      // Show confirmation dialog with the geocoded address
      const confirmReport = confirm(
        `${t("form.confirmation.title")}\n\n` +
          `${t("form.confirmation.question")}\n\n` +
          `${t("form.confirmation.address", {
            address: location.address,
          })}\n\n` +
          `${t("form.confirmation.instructions")}`
      );

      if (!confirmReport) {
        return; // User cancelled, don't submit the report
      }

      const newMarker = {
        lat: location.lat,
        lng: location.lng,
        address: location.address,
        additionalInfo: sanitizedAdditionalInfo,
      };

      // Save to Firebase
      const firebaseId = await saveLocationToFirebase(newMarker);

      if (firebaseId) {
        setAddress("");
        setAdditionalInfo("");
        setShowAdditionalInfo(false);
        alert(
          `${t("form.success.title")}\n\n` +
            `${t("form.success.location", { address: location.address })}\n\n` +
            `${t("form.success.thanks")}`
        );
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col p-3 md:p-4 border border-gray-300 rounded-lg bg-white shadow-md text-black min-h-80 md:h-96"
    >
      {/* Compact Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🚨</span>
        <h3 className="text-sm md:text-base font-semibold text-red-600">
          {t("form.title")}
        </h3>
      </div>

      {/* Compact Instructions - Always Visible */}
      <div className="text-xs text-gray-600 mb-3 bg-red-50 p-2 rounded">
        <p className="font-medium text-red-700 mb-1">
          {t("form.guidelines.title")}
        </p>
        <div className="text-xs text-red-600 mb-2">
          {t("form.guidelines.activities")}
        </div>
        <div className="text-xs text-gray-500">
          <span className="font-medium">{t("form.guidelines.examples")}</span>
        </div>
      </div>

      {/* Form Fields - Flex Grow */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        {/* Address Field */}
        <div className="flex-shrink-0">
          <label
            htmlFor="address"
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            {t("form.fields.locationLabel")}{" "}
            <span className="text-red-500">*</span>
          </label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t("form.fields.locationPlaceholder")}
            className="px-3 py-2 border border-gray-300 rounded w-full text-sm"
            disabled={isLoading}
            required
          />
        </div>

        {/* Expandable Additional Information */}
        <div className="flex-shrink-0">
          {!showAdditionalInfo ? (
            <button
              type="button"
              onClick={() => setShowAdditionalInfo(true)}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              + {t("form.fields.addDetails")}
            </button>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="additionalInfo"
                  className="text-xs font-medium text-gray-700"
                >
                  {t("form.fields.detailsLabel")}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdditionalInfo(false);
                    setAdditionalInfo("");
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  {t("form.buttons.hide")}
                </button>
              </div>
              <textarea
                id="additionalInfo"
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                placeholder={t("form.fields.detailsPlaceholder")}
                className="px-3 py-2 border border-gray-300 rounded w-full text-sm resize-none"
                rows="2"
                disabled={isLoading}
                maxLength="200"
              />
              <div className="text-xs text-gray-400 mt-1">
                {t("form.fields.charactersCount", {
                  count: additionalInfo.length,
                })}
              </div>
            </div>
          )}
        </div>

        {/* Submit Button - Always at Bottom */}
        <div className="mt-auto pt-1 flex-shrink-0">
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 w-full font-medium text-sm"
          >
            {isLoading ? t("form.buttons.locating") : t("form.buttons.submit")}
          </button>
        </div>
      </div>
    </form>
  );
}
