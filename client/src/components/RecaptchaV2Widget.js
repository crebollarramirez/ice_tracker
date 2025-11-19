"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadRecaptchaV2,
  renderRecaptchaV2Widget,
  resetRecaptchaV2Widget,
} from "@/utils/formSecurity";

/**
 * reCAPTCHA v2 Widget Component
 * Renders a reCAPTCHA v2 checkbox when needed
 */
export function RecaptchaV2Widget({
  onTokenReceived,
  onError,
  visible = false,
  reset = false,
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load reCAPTCHA v2 script and render widget when visible
  useEffect(() => {
    if (!visible || !containerRef.current) {
      return;
    }

    setLoading(true);
    setError(null);

    loadRecaptchaV2()
      .then(() => {
        // Clear any existing widget
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }

        // Render new widget
        return renderRecaptchaV2Widget(containerRef.current, (token) => {
          if (token) {
            onTokenReceived?.(token);
          } else {
            // Token expired or cleared
            onTokenReceived?.(null);
          }
        });
      })
      .then((widgetId) => {
        widgetIdRef.current = widgetId;
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load reCAPTCHA v2:", err);
        setError(err.message);
        setLoading(false);
        onError?.(err);
      });

    // Cleanup on unmount or when becoming invisible
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      widgetIdRef.current = null;
    };
  }, [visible, onTokenReceived, onError]);

  // Handle reset prop
  useEffect(() => {
    if (reset && widgetIdRef.current !== null && visible) {
      resetRecaptchaV2Widget(widgetIdRef.current);
    }
  }, [reset, visible]);

  if (!visible) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="flex justify-center" />
      {loading && (
        <p className="text-sm text-muted-foreground text-center">
          Loading verification...
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive text-center">
          Verification failed to load. Please refresh and try again.
        </p>
      )}
    </div>
  );
}
