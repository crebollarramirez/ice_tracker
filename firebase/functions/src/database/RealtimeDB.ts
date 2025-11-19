import { Database } from "firebase-admin/database";
import * as logger from "firebase-functions/logger";
import { VerifiedReport, PendingReport } from "../types/index";

/**
 * The `RealtimeDB` class provides utility methods to interact with Firebase Realtime Database.
 * It includes operations for fetching, saving, updating, and deleting reports, as well as
 * generic methods for reading, writing, and deleting data at specified paths.
 *
 * This class is designed to encapsulate database operations for better reusability and maintainability.
 */
export class RealtimeDB {
  private db: Database;

  /**
   * Constructs a new instance of the `RealtimeDB` class.
   *
   * @param {Database} db - The Firebase Realtime Database instance to use for operations.
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Fetches a pending report from `/pending/{id}`.
   *
   * @param {string} reportId - The ID of the pending report to retrieve.
   * @return {Promise<PendingReport | null>} - Resolves with the pending report data, or `null` if not found.
   * @throws {Error} - Throws an error if the database operation fails.
   */
  async getPendingReport(reportId: string): Promise<PendingReport | null> {
    try {
      const pendingRef = this.db.ref(`pending/${reportId}`);
      const snapshot = await pendingRef.once("value");

      if (!snapshot.exists()) {
        logger.warn("Pending report not found:", { reportId });
        return null;
      }

      const report = snapshot.val() as PendingReport;
      logger.info("Retrieved pending report:", {
        reportId,
        address: report.address,
      });
      return report;
    } catch (error) {
      logger.error("Failed to retrieve pending report:", { reportId, error });
      throw error;
    }
  }

  /**
   * Fetches a verified report from `/verified/{id}`.
   *
   * @param {string} reportId - The ID of the verified report to retrieve.
   * @return {Promise<VerifiedReport | null>} - Resolves with the verified report data, or `null` if not found.
   * @throws {Error} - Throws an error if the database operation fails.
   */
  async getVerifiedReport(reportId: string): Promise<VerifiedReport | null> {
    try {
      const verifiedRef = this.db.ref(`verified/${reportId}`);
      const snapshot = await verifiedRef.once("value");

      if (!snapshot.exists()) {
        logger.warn("Verified report not found:", { reportId });
        return null;
      }

      const report = snapshot.val() as VerifiedReport;
      logger.info("Retrieved verified report:", {
        reportId,
        address: report.address,
      });
      return report;
    } catch (error) {
      logger.error("Failed to retrieve verified report:", { reportId, error });
      throw error;
    }
  }

  /**
   * Saves a verified report to the `/verified` collection.
   *
   * @param {string} reportId - The ID of the report to save.
   * @param {VerifiedReport} verifiedData - The verified report data to save.
   * @return {Promise<void>} - Resolves when the operation is successful.
   * @throws {Error} - Throws an error if the database operation fails.
   */
  async saveVerifiedReport(
    reportId: string,
    verifiedData: VerifiedReport
  ): Promise<void> {
    try {
      const verifiedRef = this.db.ref(`verified/${reportId}`);
      await verifiedRef.set(verifiedData);
      logger.info("Saved verified report to Realtime Database:", { reportId });
    } catch (error) {
      logger.error("Failed to save verified report:", { reportId, error });
      throw error;
    }
  }

  /**
   * Deletes a pending report from `/pending/{id}`.
   *
   * @param {string} reportId - The ID of the pending report to delete.
   * @return {Promise<void>} - Resolves when the operation is successful.
   * @throws {Error} - Throws an error if the database operation fails.
   */
  async removePendingReport(reportId: string): Promise<void> {
    try {
      const pendingRef = this.db.ref(`pending/${reportId}`);
      await pendingRef.remove();
      logger.info("Removed report from pending collection:", { reportId });
    } catch (error) {
      logger.error("Failed to remove pending report:", { reportId, error });
      throw error;
    }
  }

  /**
   * Updates a verified report by incrementing the `reported` count and refreshing the `addedAt` timestamp.
   *
   * @param {string} reportId - The ID of the verified report to update.
   * @return {Promise<boolean>} - Resolves to `true` if the update is successful, or `false` if the report does not exist.
   * @throws {Error} - Throws an error if the database operation fails.
   */
  async updateReport(reportId: string): Promise<boolean> {
    try {
      const verifiedRef = this.db.ref(`verified/${reportId}`);
      const snapshot = await verifiedRef.once("value");

      if (!snapshot.exists()) {
        logger.warn(
          "Cannot increment reported count - verified report not found:",
          { reportId }
        );
        return false;
      }

      const reportedRef = verifiedRef.child("reported");
      const reportedSnapshot = await reportedRef.once("value");
      const currentCount = reportedSnapshot.exists()
        ? reportedSnapshot.val()
        : 1;

      const now = new Date().toISOString();

      await verifiedRef.update({
        reported: currentCount + 1,
        addedAt: now,
      });

      logger.info("Updated verified report:", {
        reportId,
        newCount: currentCount + 1,
        addedAt: now,
      });
      return true;
    } catch (error) {
      logger.error("Failed to update verified report:", { reportId, error });
      return false;
    }
  }

  /**
   * Reads data from a specified path in the Realtime Database.
   *
   * @param {string} path - The path to read data from.
   * @return {Promise<T | null>} - Resolves with the data at the specified path, or `null` if it does not exist.
   * @throws {Error} - Throws an error if the database operation fails.
   */
  async read<T>(path: string): Promise<T | null> {
    try {
      const snapshot = await this.db.ref(path).once("value");
      return snapshot.exists() ? (snapshot.val() as T) : null;
    } catch (error) {
      logger.error("Failed to read from Realtime Database:", { path, error });
      throw error;
    }
  }

  /**
   * Writes data to a specified path in the Realtime Database.
   *
   * @param {string} path - The path to write data to.
   * @param {T} data - The data to write.
   * @return {Promise<void>} - Resolves when the operation is successful.
   * @throws {Error} - Throws an error if the database operation fails.
   */
  async write<T>(path: string, data: T): Promise<void> {
    try {
      await this.db.ref(path).set(data);
      logger.info("Wrote data to Realtime Database:", { path });
    } catch (error) {
      logger.error("Failed to write to Realtime Database:", { path, error });
      throw error;
    }
  }

  /**
   * Deletes data from a specified path in the Realtime Database.
   *
   * @param {string} path - The path to delete data from.
   * @return {Promise<void>} - Resolves when the operation is successful.
   * @throws {Error} - Throws an error if the database operation fails.
   */
  async delete(path: string): Promise<void> {
    try {
      await this.db.ref(path).remove();
      logger.info("Deleted data from Realtime Database:", { path });
    } catch (error) {
      logger.error("Failed to delete from Realtime Database:", { path, error });
      throw error;
    }
  }
}
