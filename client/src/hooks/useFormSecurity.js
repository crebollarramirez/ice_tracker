"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  loadRecaptchaV3,
  getRecaptchaV3Token,
  getHoneypotProps,
  createSecurityPayload,
  isCaptchaRequiredError,
  hasMinFillTimeElapsed,
} from "@/utils/formSecurity";

/**
 * Custom hook for form security
 * Handles reCAPTCHA v3/v2, honeypot, and minimum fill time
 */
export function useFormSecurity() {
  const [startedAt] = useState(Date.now());
  const [honeypotValue, setHoneypotValue] = useState("");
  const [showRecaptchaV2, setShowRecaptchaV2] = useState(false);
  const [recaptchaV2Token, setRecaptchaV2Token] = useState(null);
  const [isSecurityReady, setIsSecurityReady] = useState(false);
  const [securityError, setSecurityError] = useState(null);
  const honeypotRef = useRef(null);

  // Load reCAPTCHA v3 on mount
  useEffect(() => {
    loadRecaptchaV3()
      .then(() => {
        setIsSecurityReady(true);
      })
      .catch((error) => {
        console.warn("Failed to load reCAPTCHA v3:", error);
        setSecurityError(error.message);
        // Still allow form submission without v3
        setIsSecurityReady(true);
      });
  }, []);

  // Get honeypot component props
  const honeypotProps = {
    ...getHoneypotProps(),
    ref: honeypotRef,
    value: honeypotValue,
    onChange: (e) => setHoneypotValue(e.target.value),
  };

  // Create security payload
  const createPayload = useCallback(
    async (originalData) => {
      console.log("🔐 Creating security payload...");
      const currentHoneypotValue = honeypotRef.current?.value || honeypotValue;

      console.log("Security state:", {
        showRecaptchaV2,
        hasV2Token: !!recaptchaV2Token,
        honeypotValue: currentHoneypotValue,
        startedAt,
        isSecurityReady,
      });

      // Get v3 token if not showing v2
      let v3Token = null;
      if (!showRecaptchaV2) {
        try {
          console.log("🎯 Getting reCAPTCHA v3 token...");
          v3Token = await getRecaptchaV3Token("submit");
          console.log(
            "✅ Got v3 token:",
            v3Token ? `${v3Token.substring(0, 20)}...` : null
          );
        } catch (error) {
          console.warn("❌ Failed to get v3 token:", error);
        }
      } else {
        console.log(
          "🔄 Using v2 token instead of v3:",
          recaptchaV2Token ? `${recaptchaV2Token.substring(0, 20)}...` : null
        );
      }

      const securityData = createSecurityPayload(
        currentHoneypotValue,
        startedAt,
        v3Token,
        recaptchaV2Token
      );

      console.log("📦 Security payload created:", {
        hasV3Token: !!securityData.recaptchaV3Token,
        hasV2Token: !!securityData.recaptchaV2Token,
        honeypot: securityData.honeypot,
        startedAt: securityData.startedAt,
      });

      return {
        ...originalData,
        ...securityData,
      };
    },
    [
      honeypotValue,
      startedAt,
      showRecaptchaV2,
      recaptchaV2Token,
      isSecurityReady,
    ]
  );

  // Handle submission with security checks
  const submitWithSecurity = useCallback(
    async (originalData, submitFunction) => {
      try {
        console.log("🚀 Starting secure submission...");

        // Check if security is ready
        if (!isSecurityReady) {
          throw new Error(
            "Security system is not ready. Please wait and try again."
          );
        }

        // If showing v2 but no token, don't allow submission
        if (showRecaptchaV2 && !recaptchaV2Token) {
          throw new Error("Please complete the verification to continue.");
        }

        // Check minimum fill time (optional client-side check)
        if (!hasMinFillTimeElapsed(startedAt, 2000)) {
          console.warn("Submission too fast, but allowing anyway");
        }

        // Create payload with security data
        const payload = await createPayload(originalData);

        // Validate that we have some form of reCAPTCHA token
        if (!payload.recaptchaV3Token && !payload.recaptchaV2Token) {
          console.error("❌ No reCAPTCHA tokens available!");
          throw new Error(
            "Security verification failed. Please refresh and try again."
          );
        }

        console.log("📡 Submitting with security data...");
        // Submit with security data
        const result = await submitFunction(payload);

        // Reset v2 state on success
        setShowRecaptchaV2(false);
        setRecaptchaV2Token(null);

        return result;
      } catch (error) {
        // Check if we need to show reCAPTCHA v2
        if (isCaptchaRequiredError(error) && !showRecaptchaV2) {
          setShowRecaptchaV2(true);
          setRecaptchaV2Token(null);
          throw new Error("Please complete the verification to continue.");
        }

        throw error;
      }
    },
    [createPayload, startedAt, showRecaptchaV2]
  );

  // Handle v2 token received
  const handleV2TokenReceived = useCallback((token) => {
    setRecaptchaV2Token(token);
  }, []);

  // Handle v2 error
  const handleV2Error = useCallback((error) => {
    console.error("reCAPTCHA v2 error:", error);
    setRecaptchaV2Token(null);
  }, []);

  // Reset v2 state
  const resetV2 = useCallback(() => {
    setShowRecaptchaV2(false);
    setRecaptchaV2Token(null);
  }, []);

  return {
    // Security state
    isSecurityReady,
    securityError,
    startedAt,

    // Honeypot
    honeypotProps,
    honeypotValue,

    // reCAPTCHA v2
    showRecaptchaV2,
    recaptchaV2Token,
    handleV2TokenReceived,
    handleV2Error,
    resetV2,

    // Main functions
    createPayload,
    submitWithSecurity,
  };
}
