import * as logger from "firebase-functions/logger";
import { DeniedReport, VerifiedExtension } from "../types/index";

/**
 * The `Collections` class provides methods to interact with Firestore collections
 * for logging verification and denial events. It encapsulates Firestore operations
 * to ensure consistent and reusable database interactions.
 */
export class Collections {
  private firestoreDb: FirebaseFirestore.Firestore;

  /**
   * Constructs a new instance of the `Collections` class.
   *
   * @param {FirebaseFirestore.Firestore} firestoreDb - The Firestore database instance to use for operations.
   */
  constructor(firestoreDb: FirebaseFirestore.Firestore) {
    this.firestoreDb = firestoreDb;
  }

  /**
   * Writes a verification event to Firestore with the report ID, verifier ID, and timestamp.
   *
   * @param {VerifiedExtension} reportData - An object containing the minimal verification metadata, including:
   *   - `reportId` (string): The ID of the report being verified.
   *   - `verifierUid` (string): The UID of the verifier performing the verification.
   *
   * @return {Promise<void>} A promise that resolves when the verification log is successfully written to Firestore.
   *
   * @throws {Error} Throws an error if the Firestore operation fails.
   *
   */
  async logVerification(reportData: VerifiedExtension): Promise<void> {
    try {
      await this.firestoreDb.collection("verificationLogs").add({
        reportId: reportData.reportId,
        verifierUid: reportData.verifierUid,
        verifiedAt: new Date().toISOString(),
      });

      logger.info("Created verification log:", {
        reportId: reportData.reportId,
        verifierUid: reportData.verifierUid,
      });
    } catch (error) {
      logger.error("Failed to create verification log:", {
        reportId: reportData.reportId,
        error: error,
        verifierUid: reportData.verifierUid,
      });
      throw error;
    }
  }

  /**
   * Persists a denial event, including when it happened and the denied image name, to Firestore.
   *
   * @param {DeniedReport} reportData - An object containing details about the denied report and the verifier, including:
   *   - `reportId` (string): The ID of the report being denied.
   *   - `verifierUid` (string): The UID of the verifier performing the denial.
   *   - `imagePath` (string): The path of the denied image.
   *   - `reason` (string): The reason for the denial.
   *
   * @return {Promise<void>} A promise that resolves when the denial log is successfully written to Firestore.
   *
   * @throws {Error} Throws an error if the Firestore operation fails.
   */
  async logDenial(reportData: DeniedReport): Promise<void> {
    try {
      const deniedLogData = {
        ...reportData,
        deniedAt: new Date().toISOString(),
        imageName: reportData.imagePath.split("/").pop() || "image",
      };

      await this.firestoreDb.collection("deniedLogs").add(deniedLogData);

      logger.info("Created denial log:", {
        imageName: deniedLogData.imageName,
        verifierUid: reportData.verifierUid,
      });
    } catch (error) {
      logger.error("Failed to create denial log:", {
        imageName: reportData.imagePath.split("/").pop() || "image",
        error: error,
        verifierUid: reportData.verifierUid,
      });
      throw error;
    }
  }
}
