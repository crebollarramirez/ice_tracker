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
      const currentHoneypotValue = honeypotRef.current?.value || honeypotValue;

      // Get v3 token if not showing v2
      let v3Token = null;
      if (!showRecaptchaV2) {
        try {
          v3Token = await getRecaptchaV3Token("submit");
        } catch (error) {
          console.warn("Failed to get v3 token:", error);
        }
      }

      const securityData = createSecurityPayload(
        currentHoneypotValue,
        startedAt,
        v3Token,
        recaptchaV2Token
      );

      return {
        ...originalData,
        ...securityData,
      };
    },
    [honeypotValue, startedAt, showRecaptchaV2, recaptchaV2Token]
  );

  // Handle submission with security checks
  const submitWithSecurity = useCallback(
    async (originalData, submitFunction) => {
      try {
        // Check minimum fill time (optional client-side check)
        if (!hasMinFillTimeElapsed(startedAt, 2000)) {
          console.warn("Submission too fast, but allowing anyway");
        }

        // Create payload with security data
        const payload = await createPayload(originalData);

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
