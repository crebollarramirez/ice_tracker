/**
 * Form Security Utilities
 * Handles reCAPTCHA v3/v2, honeypot, and minimum fill time for forms
 */

let recaptchaV3Loaded = false;
let recaptchaV2Loaded = false;

/**
 * Load reCAPTCHA v3 script
 */
export const loadRecaptchaV3 = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Window not available"));
      return;
    }

    if (recaptchaV3Loaded && window.grecaptcha) {
      resolve();
      return;
    }

    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHAV3_SITE_KEY;
    if (!siteKey) {
      console.warn("NEXT_PUBLIC_RECAPTCHAV3_SITE_KEY not found");
      reject(new Error("reCAPTCHA v3 site key not configured"));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.onload = () => {
      recaptchaV3Loaded = true;
      resolve();
    };
    script.onerror = () => {
      reject(new Error("Failed to load reCAPTCHA v3"));
    };
    document.head.appendChild(script);
  });
};

/**
 * Load reCAPTCHA v2 script
 */
export const loadRecaptchaV2 = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Window not available"));
      return;
    }

    if (recaptchaV2Loaded && window.grecaptcha) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js";
    script.async = true;
    script.onload = () => {
      recaptchaV2Loaded = true;
      resolve();
    };
    script.onerror = () => {
      reject(new Error("Failed to load reCAPTCHA v2"));
    };
    document.head.appendChild(script);
  });
};

/**
 * Execute reCAPTCHA v3 and get token
 */
export const getRecaptchaV3Token = async (action = "submit") => {
  try {
    if (
      typeof window === "undefined" ||
      !window.grecaptcha ||
      !window.grecaptcha.execute
    ) {
      console.warn("reCAPTCHA v3 not available");
      return null;
    }

    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHAV3_SITE_KEY;
    if (!siteKey) {
      console.warn("NEXT_PUBLIC_RECAPTCHAV3_SITE_KEY not found");
      return null;
    }

    const token = await window.grecaptcha.execute(siteKey, { action });
    return token;
  } catch (error) {
    console.warn("Failed to get reCAPTCHA v3 token:", error);
    return null;
  }
};

/**
 * Render reCAPTCHA v2 widget
 */
export const renderRecaptchaV2Widget = (containerId, callback) => {
  return new Promise((resolve, reject) => {
    if (
      typeof window === "undefined" ||
      !window.grecaptcha ||
      !window.grecaptcha.render
    ) {
      reject(new Error("reCAPTCHA v2 not available"));
      return;
    }

    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHAV2_SITE_KEY;
    if (!siteKey) {
      reject(new Error("NEXT_PUBLIC_RECAPTCHAV2_SITE_KEY not found"));
      return;
    }

    try {
      const widgetId = window.grecaptcha.render(containerId, {
        sitekey: siteKey,
        callback: callback,
        "expired-callback": () => {
          // Clear token when expired
          if (callback) callback(null);
        },
      });
      resolve(widgetId);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Reset reCAPTCHA v2 widget
 */
export const resetRecaptchaV2Widget = (widgetId) => {
  if (
    typeof window !== "undefined" &&
    window.grecaptcha &&
    window.grecaptcha.reset
  ) {
    window.grecaptcha.reset(widgetId);
  }
};

/**
 * Get honeypot field props
 */
export const getHoneypotProps = () => ({
  name: "website",
  autoComplete: "off",
  tabIndex: -1,
  style: {
    position: "absolute",
    left: "-10000px",
    width: "1px",
    height: "1px",
    overflow: "hidden",
  },
  "aria-hidden": "true",
});

/**
 * Check if error indicates CAPTCHA is required
 */
export const isCaptchaRequiredError = (error) => {
  if (!error) return false;

  // Check various possible error structures
  const errorCode = error.code || error.details?.code;
  const errorMessage = error.message || "";

  // Check for Firebase function permission-denied errors related to reCAPTCHA
  if (errorCode === "functions/permission-denied") {
    return (
      errorMessage.includes("requires_v2_challenge") ||
      errorMessage.includes("Low reCAPTCHA score") ||
      errorMessage.includes("Invalid reCAPTCHA")
    );
  }

  // Check for other reCAPTCHA-related errors
  return (
    errorCode === "captcha-required" ||
    errorCode === "unauthenticated" ||
    (typeof errorMessage === "string" &&
      errorMessage.toLowerCase().includes("captcha"))
  );
};

/**
 * Get minimum fill time validation
 */
export const getMinFillTime = () => 2000; // 2 seconds

/**
 * Check if minimum fill time has elapsed
 */
export const hasMinFillTimeElapsed = (
  startedAt,
  minTime = getMinFillTime()
) => {
  if (!startedAt) return true;
  return Date.now() - startedAt >= minTime;
};

/**
 * Create security payload for form submission
 */
export const createSecurityPayload = (
  honeypotValue,
  startedAt,
  v3Token = null,
  v2Token = null
) => ({
  recaptchaV3Token: v3Token,
  recaptchaV2Token: v2Token,
  honeypot: honeypotValue || "",
  startedAt: startedAt || Date.now(),
});
