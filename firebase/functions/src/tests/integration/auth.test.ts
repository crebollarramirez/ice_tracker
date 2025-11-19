import { requireVerifierRole, AuthContext } from "../../auth/auth";
import { HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

// Mock the logger to avoid console output during tests
jest.mock("firebase-functions/logger", () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe("Auth Module - requireVerifierRole", () => {
  // Clear all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication Validation", () => {
    it("should throw unauthenticated error when auth is undefined", () => {
      expect(() => requireVerifierRole(undefined)).toThrow(HttpsError);

      try {
        requireVerifierRole(undefined);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpsError);
        expect((error as HttpsError).code).toBe("unauthenticated");
        expect((error as HttpsError).message).toBe("Authentication required");
      }

      expect(logger.error).toHaveBeenCalledWith(
        "Authentication failed - no auth object"
      );
    });

    it("should throw unauthenticated error when auth is null", () => {
      expect(() => requireVerifierRole(null as any)).toThrow(HttpsError);

      try {
        requireVerifierRole(null as any);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpsError);
        expect((error as HttpsError).code).toBe("unauthenticated");
      }
    });

    it("should throw unauthenticated error when auth is empty object", () => {
      expect(() => requireVerifierRole({} as any)).toThrow(HttpsError);

      try {
        requireVerifierRole({} as any);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpsError);
        expect((error as HttpsError).code).toBe("unauthenticated");
      }
    });
  });

  describe("Role Validation", () => {
    const validUid = "test-user-123";

    it("should throw permission-denied error when user has no token", () => {
      const auth: AuthContext = {
        uid: validUid,
      };

      expect(() => requireVerifierRole(auth)).toThrow(HttpsError);

      try {
        requireVerifierRole(auth);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpsError);
        expect((error as HttpsError).code).toBe("permission-denied");
        expect((error as HttpsError).message).toContain(
          "Insufficient permissions"
        );
      }

      expect(logger.error).toHaveBeenCalledWith(
        "Permission denied - insufficient role:",
        expect.objectContaining({
          userRole: undefined,
          requiredRole: "verifier",
          uid: validUid,
        })
      );
    });

    it("should throw permission-denied error when user has no role", () => {
      const auth: AuthContext = {
        uid: validUid,
        token: {
          email: "user@example.com",
        },
      };

      expect(() => requireVerifierRole(auth)).toThrow(HttpsError);

      try {
        requireVerifierRole(auth);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpsError);
        expect((error as HttpsError).code).toBe("permission-denied");
      }

      expect(logger.error).toHaveBeenCalledWith(
        "Permission denied - insufficient role:",
        expect.objectContaining({
          userRole: undefined,
          requiredRole: "verifier",
          uid: validUid,
        })
      );
    });

    it("should throw permission-denied error when user role is empty string", () => {
      const auth: AuthContext = {
        uid: validUid,
        token: {
          email: "user@example.com",
          role: "",
        },
      };

      expect(() => requireVerifierRole(auth)).toThrow(HttpsError);

      try {
        requireVerifierRole(auth);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpsError);
        expect((error as HttpsError).code).toBe("permission-denied");
      }
    });

    it("should throw permission-denied error when user has 'user' role", () => {
      const auth: AuthContext = {
        uid: validUid,
        token: {
          email: "user@example.com",
          role: "user",
        },
      };

      expect(() => requireVerifierRole(auth)).toThrow(HttpsError);

      try {
        requireVerifierRole(auth);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpsError);
        expect((error as HttpsError).code).toBe("permission-denied");
        expect((error as HttpsError).message).toContain(
          "Verifier role required"
        );
      }

      expect(logger.error).toHaveBeenCalledWith(
        "Permission denied - insufficient role:",
        expect.objectContaining({
          userRole: "user",
          requiredRole: "verifier",
          uid: validUid,
        })
      );
    });

    it("should throw permission-denied error when user has 'admin' role", () => {
      const auth: AuthContext = {
        uid: validUid,
        token: {
          email: "admin@example.com",
          role: "admin",
        },
      };

      expect(() => requireVerifierRole(auth)).toThrow(HttpsError);

      try {
        requireVerifierRole(auth);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpsError);
        expect((error as HttpsError).code).toBe("permission-denied");
      }
    });

    it("should throw permission-denied error for case-sensitive role mismatch", () => {
      const auth: AuthContext = {
        uid: validUid,
        token: {
          email: "user@example.com",
          role: "Verifier", // Capital V
        },
      };

      expect(() => requireVerifierRole(auth)).toThrow(HttpsError);

      try {
        requireVerifierRole(auth);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpsError);
        expect((error as HttpsError).code).toBe("permission-denied");
      }
    });

    it("should throw permission-denied error for role with extra whitespace", () => {
      const auth: AuthContext = {
        uid: validUid,
        token: {
          email: "user@example.com",
          role: " verifier ",
        },
      };

      expect(() => requireVerifierRole(auth)).toThrow(HttpsError);
    });
  });

  describe("Successful Authentication", () => {
    const validUid = "test-verifier-456";
    const validEmail = "verifier@example.com";

    it("should return user context when user has verifier role", () => {
      const auth: AuthContext = {
        uid: validUid,
        token: {
          email: validEmail,
          role: "verifier",
        },
      };

      const result = requireVerifierRole(auth);

      expect(result).toEqual({
        uid: validUid,
        email: validEmail,
        role: "verifier",
      });

      expect(logger.info).toHaveBeenCalledWith(
        "User authenticated with verifier role:",
        {
          uid: validUid,
          email: validEmail,
          role: "verifier",
        }
      );

      expect(logger.error).not.toHaveBeenCalled();
    });

    it("should return user context with null email when email is missing", () => {
      const auth: AuthContext = {
        uid: validUid,
        token: {
          role: "verifier",
        },
      };

      const result = requireVerifierRole(auth);

      expect(result).toEqual({
        uid: validUid,
        email: null,
        role: "verifier",
      });

      expect(logger.info).toHaveBeenCalledWith(
        "User authenticated with verifier role:",
        {
          uid: validUid,
          email: null,
          role: "verifier",
        }
      );
    });

    it("should return user context with null email when email is undefined", () => {
      const auth: AuthContext = {
        uid: validUid,
        token: {
          email: undefined,
          role: "verifier",
        },
      };

      const result = requireVerifierRole(auth);

      expect(result).toEqual({
        uid: validUid,
        email: null,
        role: "verifier",
      });
    });

    it("should handle token with additional custom properties", () => {
      const auth: AuthContext = {
        uid: validUid,
        token: {
          email: validEmail,
          role: "verifier",
          customClaim1: "value1",
          customClaim2: 123,
          customClaim3: true,
        },
      };

      const result = requireVerifierRole(auth);

      expect(result).toEqual({
        uid: validUid,
        email: validEmail,
        role: "verifier",
      });

      // Should only return the essential fields, not custom claims
      expect(result).not.toHaveProperty("customClaim1");
      expect(result).not.toHaveProperty("customClaim2");
      expect(result).not.toHaveProperty("customClaim3");
    });
  });

  describe("Edge Cases", () => {
    it("should handle auth with very long uid", () => {
      const longUid = "a".repeat(1000);
      const auth: AuthContext = {
        uid: longUid,
        token: {
          role: "verifier",
        },
      };

      const result = requireVerifierRole(auth);
      expect(result.uid).toBe(longUid);
    });

    it("should handle auth with special characters in email", () => {
      const specialEmail = "user+test@example.co.uk";
      const auth: AuthContext = {
        uid: "test-123",
        token: {
          email: specialEmail,
          role: "verifier",
        },
      };

      const result = requireVerifierRole(auth);
      expect(result.email).toBe(specialEmail);
    });

    it("should handle auth with empty string uid", () => {
      const auth: AuthContext = {
        uid: "",
        token: {
          role: "verifier",
        },
      };

      // Empty uid should now be treated as unauthenticated
      expect(() => requireVerifierRole(auth)).toThrow(HttpsError);

      try {
        requireVerifierRole(auth);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpsError);
        expect((error as HttpsError).code).toBe("unauthenticated");
      }
    });

    it("should handle token with null role explicitly", () => {
      const auth: AuthContext = {
        uid: "test-123",
        token: {
          role: null as any,
        },
      };

      expect(() => requireVerifierRole(auth)).toThrow(HttpsError);
    });
  });

  describe("Type Safety", () => {
    it("should properly type the return value", () => {
      const auth: AuthContext = {
        uid: "test-123",
        token: {
          email: "verifier@example.com",
          role: "verifier",
        },
      };

      const result = requireVerifierRole(auth);

      // TypeScript should enforce these types
      const uid: string = result.uid;
      const email: string | null = result.email;
      const role: "verifier" = result.role;

      expect(typeof uid).toBe("string");
      expect(typeof role).toBe("string");
      expect(email === null || typeof email === "string").toBe(true);
    });
  });

  describe("Logger Integration", () => {
    it("should log error with correct context when authentication fails", () => {
      try {
        requireVerifierRole(undefined);
      } catch (error) {
        // Expected to throw
      }

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        "Authentication failed - no auth object"
      );
    });

    it("should log error with user details when role check fails", () => {
      const auth: AuthContext = {
        uid: "test-user-789",
        token: {
          email: "user@example.com",
          role: "user",
        },
      };

      try {
        requireVerifierRole(auth);
      } catch (error) {
        // Expected to throw
      }

      expect(logger.error).toHaveBeenCalledWith(
        "Permission denied - insufficient role:",
        {
          userRole: "user",
          requiredRole: "verifier",
          uid: "test-user-789",
        }
      );
    });

    it("should log info with user details on successful authentication", () => {
      const auth: AuthContext = {
        uid: "test-verifier-999",
        token: {
          email: "verifier@example.com",
          role: "verifier",
        },
      };

      requireVerifierRole(auth);

      expect(logger.info).toHaveBeenCalledWith(
        "User authenticated with verifier role:",
        {
          uid: "test-verifier-999",
          email: "verifier@example.com",
          role: "verifier",
        }
      );
    });

    it("should not log info when authentication fails", () => {
      const auth: AuthContext = {
        uid: "test-user",
        token: {
          role: "user",
        },
      };

      try {
        requireVerifierRole(auth);
      } catch (error) {
        // Expected
      }

      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe("Error Message Quality", () => {
    it("should provide clear error message for unauthenticated users", () => {
      try {
        requireVerifierRole(undefined);
        fail("Should have thrown an error");
      } catch (error) {
        expect((error as HttpsError).message).toBe("Authentication required");
        expect((error as HttpsError).message).not.toContain("undefined");
        expect((error as HttpsError).message).not.toContain("null");
      }
    });

    it("should provide clear error message for insufficient permissions", () => {
      const auth: AuthContext = {
        uid: "test-123",
        token: {
          role: "user",
        },
      };

      try {
        requireVerifierRole(auth);
        fail("Should have thrown an error");
      } catch (error) {
        expect((error as HttpsError).message).toContain(
          "Insufficient permissions"
        );
        expect((error as HttpsError).message).toContain(
          "Verifier role required"
        );
      }
    });
  });

  describe("Performance and Consistency", () => {
    it("should handle multiple consecutive calls correctly", () => {
      const validAuth: AuthContext = {
        uid: "test-123",
        token: {
          role: "verifier",
        },
      };

      const invalidAuth: AuthContext = {
        uid: "test-456",
        token: {
          role: "user",
        },
      };

      // First call - valid
      const result1 = requireVerifierRole(validAuth);
      expect(result1.role).toBe("verifier");

      // Second call - invalid
      expect(() => requireVerifierRole(invalidAuth)).toThrow(HttpsError);

      // Third call - valid again
      const result3 = requireVerifierRole(validAuth);
      expect(result3.role).toBe("verifier");

      // Fourth call - undefined
      expect(() => requireVerifierRole(undefined)).toThrow(HttpsError);
    });

    it("should not mutate the input auth object", () => {
      const auth: AuthContext = {
        uid: "test-123",
        token: {
          email: "verifier@example.com",
          role: "verifier",
        },
      };

      const originalAuth = JSON.parse(JSON.stringify(auth));
      requireVerifierRole(auth);

      expect(auth).toEqual(originalAuth);
    });
  });
});
