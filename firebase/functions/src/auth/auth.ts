import { HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

/**
 * Auth context from a Firebase callable request
 */
export interface AuthContext {
  uid: string;
  token?: {
    email?: string;
    role?: string;
    [key: string]: unknown;
  };
}

/**
 * Validates that the user is authenticated and has the verifier role.
 *
 * @param {AuthContext | undefined} auth - The authentication context from the request
 * @throws {HttpsError} If user is not authenticated or lacks verifier role
 * @return {object} The authenticated user's context (uid, email, role)
 */
export function requireVerifierRole(auth: AuthContext | undefined) {
  // Check if user is authenticated
  if (!auth || !auth.uid) {
    logger.error("Authentication failed - no auth object");
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const userRole = auth.token?.role;

  // Check if user has verifier role
  if (userRole !== "verifier") {
    logger.error("Permission denied - insufficient role:", {
      userRole,
      requiredRole: "verifier",
      uid: auth.uid,
    });
    throw new HttpsError(
      "permission-denied",
      "Insufficient permissions. Verifier role required."
    );
  }

  logger.info("User authenticated with verifier role:", {
    uid: auth.uid,
    email: auth.token?.email || null,
    role: userRole,
  });

  return {
    uid: auth.uid,
    email: auth.token?.email || null,
    role: userRole as "verifier",
  };
}
