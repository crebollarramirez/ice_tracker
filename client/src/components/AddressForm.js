"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { pinFunction } from "../firebase";
import Notification from "./Notification";
import { useDonate } from "@/contexts/DonateContext";

export default function AddressForm() {
  const t = useTranslations();
  const { showDonatePopup } = useDonate();
  const [address, setAddress] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
  const [notification, setNotification] = useState(null);

  // Get cooldown durations from environment variables (in minutes) and convert to milliseconds
  const SUCCESS_COOLDOWN_MINUTES =
    parseInt(process.env.NEXT_PUBLIC_SUCCESS_COOLDOWN_MINUTES, 10) || 3; // Default: 3 minutes
  const NEGATIVE_COOLDOWN_MINUTES =
    parseInt(process.env.NEXT_PUBLIC_NEGATIVE_COOLDOWN_MINUTES, 10) || 60; // Default: 60 minutes

  // Convert minutes to milliseconds
  const SUCCESS_COOLDOWN = SUCCESS_COOLDOWN_MINUTES * 60 * 1000;
  const NEGATIVE_COOLDOWN = NEGATIVE_COOLDOWN_MINUTES * 60 * 1000;

  // Helper function to check block status (only called when needed)
  const isBlocked = () => {
    if (typeof window === "undefined") return false;

    const blockedUntil = localStorage.getItem("blockedUntil");
    if (blockedUntil) {
      const blockedTime = parseInt(blockedUntil, 10);
      const currentTime = Date.now();

      if (currentTime < blockedTime) {
        return true; // User is still blocked
      } else {
        // Block has expired, remove from localStorage
        localStorage.removeItem("blockedUntil");
        return false; // Block has expired
      }
    }
    return false; // No block exists
  };

  // Helper function to get remaining time for user feedback
  const getRemainingMinutes = () => {
    if (typeof window === "undefined") return 0;

    const blockedUntil = localStorage.getItem("blockedUntil");
    if (blockedUntil) {
      const blockedTime = parseInt(blockedUntil, 10);
      const currentTime = Date.now();

      if (currentTime < blockedTime) {
        return Math.ceil((blockedTime - currentTime) / (60 * 1000));
      }
    }
    return 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!address.trim()) {
      setNotification(
        t("form.errors.addressRequired") || "Address is required"
      );
      return;
    }

    // Check if user is currently blocked (only when they try to submit)
    if (isBlocked()) {
      const remainingMinutes = getRemainingMinutes();
      setNotification(
        t("form.errors.cooldown", { minutes: remainingMinutes }) ||
          `Please wait ${remainingMinutes} more minutes before submitting another report.`
      );
      return;
    }

    setIsLoading(true);

    console.log({
      addedAt: new Date().toISOString(),
      address: address.trim(),
      additionalInfo: additionalInfo.trim(),
    });

    try {
      const result = await pinFunction({
        addedAt: new Date().toISOString(),
        address: address.trim(),
        additionalInfo: additionalInfo.trim(),
      });

      console.log("Pin function result:", result);

      // Clear form on success
      setAddress("");
      setAdditionalInfo("");
      setShowAdditionalInfo(false);

      // Set cooldown after successful post using environment variable
      const cooldownUntil = Date.now() + SUCCESS_COOLDOWN;
      localStorage.setItem("blockedUntil", cooldownUntil.toString());

      // Show donate popup after successful submission
      showDonatePopup();
    } catch (error) {
      // Handle Firebase callable function errors
      console.error("Error calling pin function:", error);

      if (error.code) {
        // Firebase function error codes
        switch (error.code) {
          case "functions/invalid-argument":
            setNotification(
              error.message ||
                t("form.errors.invalidAddress") ||
                "Please provide a valid address that can be found on the map"
            );
            break;
          case "functions/failed-precondition":
            // Negative content detected - set block using environment variable
            const blockUntil = Date.now() + NEGATIVE_COOLDOWN;
            localStorage.setItem("blockedUntil", blockUntil.toString());

            setNotification(
              error.message ||
                t("form.errors.negativeContent") ||
                "Please avoid using negative or abusive language. You are now blocked from submitting for 1 hour."
            );
            break;
          case "functions/not-found":
            setNotification(
              error.message ||
                t("form.errors.invalidAddress") ||
                "Please provide a valid address that can be found on the map"
            );
            break;
          case "functions/internal":
            setNotification(
              error.message ||
                t("form.errors.generic") ||
                "An error occurred while submitting the form"
            );
            break;
          default:
            setNotification(
              error.message ||
                t("form.errors.generic") ||
                "An error occurred while submitting the form"
            );
        }
      } else {
        // Network error or other issues
        setNotification(
          t("form.errors.network") ||
            "Network error. Please check your connection and try again."
        );
      }
    } finally {
      setIsLoading(false);
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
        <h3 className="text-base md:text-lg font-semibold text-red-600">
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
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded w-full font-medium text-sm"
          >
            {isLoading ? t("form.buttons.locating") : t("form.buttons.submit")}
          </button>
        </div>
      </div>

      {/* Notification Component - Always Rendered */}
      {notification && (
        <Notification
          message={notification}
          onClose={() => setNotification(null)}
        />
      )}
    </form>
  );
}
