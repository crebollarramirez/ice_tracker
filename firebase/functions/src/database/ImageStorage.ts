import * as dotenv from "dotenv";
import * as logger from "firebase-functions/logger";
import { Bucket, File } from "@google-cloud/storage";

dotenv.config();

export class ImageStorage {
  private bucket: Bucket;

  constructor(bucket: Bucket) {
    this.bucket = bucket;
  }

  /**
   * Checks if a file exists in the configured storage bucket.
   *
   * @param {string} filePath - The path of the file to check.
   * @returns {Promise<boolean>} - Resolves to `true` if the file exists, otherwise `false`.
   * @throws {Error} - Logs an error if the existence check fails.
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      const file = this.bucket.file(filePath);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      logger.error("Error checking file existence:", { filePath, error });
      return false;
    }
  }

  /**
   * Copies a file within the storage bucket to a new location.
   *
   * @param {string} sourcePath - The path of the source file to copy.
   * @param {string} destinationPath - The path where the file should be copied.
   * @returns {Promise<File>} - Resolves with the destination file handle.
   * @throws {Error} - Throws an error if the copy operation fails.
   */
  async copyFile(sourcePath: string, destinationPath: string): Promise<File> {
    const sourceFile = this.bucket.file(sourcePath);
    const destinationFile = this.bucket.file(destinationPath);

    await sourceFile.copy(destinationFile);
    logger.info("File copied successfully:", {
      source: sourcePath,
      destination: destinationPath,
    });

    return destinationFile;
  }

  /**
   * Deletes a file from the storage bucket.
   *
   * @param {string} filePath - The path of the file to delete.
   * @returns {Promise<void>} - Resolves when the file is successfully deleted.
   * @throws {Error} - Throws an error if the deletion fails.
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      const file = this.bucket.file(filePath);
      await file.delete();
      logger.info("File deleted successfully:", { filePath });
    } catch (error) {
      logger.error("Error deleting file:", { filePath, error });
      throw error;
    }
  }

  /**
   * Retrieves or generates a download token for a file in the storage bucket.
   *
   * @param {File} file - The file object to retrieve or generate a token for.
   * @returns {Promise<string>} - Resolves with the download token.
   * @throws {Error} - Throws an error if the metadata update fails.
   */
  async getOrCreateDownloadToken(file: File): Promise<string> {
    const [metadata] = await file.getMetadata();
    let downloadToken = metadata.metadata
      ?.firebaseStorageDownloadTokens as string;

    if (!downloadToken) {
      // Generate a new UUID token if one doesn't exist
      downloadToken = require("crypto").randomUUID();
      await file.setMetadata({
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      });
      logger.info("Generated new download token for file:", {
        filePath: file.name,
        token: downloadToken,
      });
    }

    return downloadToken;
  }

  /**
   * Constructs a public download URL for a file in the storage bucket.
   *
   * @param {string} filePath - The path of the file in the bucket.
   * @param {string} downloadToken - The download token associated with the file.
   * @returns {string} - The constructed download URL.
   */
  constructDownloadUrl(filePath: string, downloadToken: string): string {
    const bucketName = this.bucket.name;
    const encodedPath = encodeURIComponent(filePath);
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;
  }

  /**
   * Moves a file to a new location, generates a permanent download token, and deletes the source file.
   *
   * @param {string} sourcePath - The path of the source file to move.
   * @param {string} destinationPath - The path where the file should be moved.
   * @returns {Promise<{ imageUrl: string; file: File }>} - Resolves with the new file's URL and handle.
   * @throws {Error} - Throws an error if the move operation fails.
   */
  async moveImageAndGenerateUrl(
    sourcePath: string,
    destinationPath: string
  ): Promise<{ imageUrl: string; file: File }> {
    // Check if source file exists
    const sourceExists = await this.fileExists(sourcePath);
    if (!sourceExists) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }

    // Copy file to new location
    const newFile = await this.copyFile(sourcePath, destinationPath);

    // Generate or get download token
    const downloadToken = await this.getOrCreateDownloadToken(newFile);

    // Construct permanent URL
    const imageUrl = this.constructDownloadUrl(destinationPath, downloadToken);

    // Delete original file
    await this.deleteFile(sourcePath);

    return { imageUrl, file: newFile };
  }

  /**
   * Moves a pending report image to the `/reports/verified/{id}` folder and generates its public URL.
   *
   * @param {object} report - The report object containing the image path.
   * @param {string} report.imagePath - The path of the image to move.
   * @param {string} reportId - The ID of the report.
   * @returns {Promise<{ imageUrl: string }>} - Resolves with the public URL of the moved image.
   * @throws {Error} - Throws an error if the move operation fails.
   */
  async moveImageToVerified(
    report: { imagePath: string },
    reportId: string
  ): Promise<{ imageUrl: string }> {
    // Extract original filename from the image path
    const originalFileName = report.imagePath.split("/").pop() || "image";

    // Generate new path for verified reports
    const verifiedImagePath = `reports/verified/${reportId}/${originalFileName}`;

    // Use existing method to handle the move and URL generation
    const { imageUrl } = await this.moveImageAndGenerateUrl(
      report.imagePath,
      verifiedImagePath
    );

    return { imageUrl };
  }

  /**
   * Moves a pending report image to the `/reports/denied/` folder and returns the new storage path.
   *
   * @param {object} report - The report object containing the image path.
   * @param {string} report.imagePath - The path of the image to move.
   * @returns {Promise<string>} - Resolves with the new storage path of the moved image.
   * @throws {Error} - Throws an error if the move operation fails.
   */
  async moveImageToDenied(report: { imagePath: string }): Promise<string> {
    // Extract original filename from the image path
    const originalFileName = report.imagePath.split("/").pop() || "image";

    // Generate new path for denied reports
    const deniedImagePath = `reports/denied/${originalFileName}`;

    // Check if source file exists
    const sourceExists = await this.fileExists(report.imagePath);
    if (!sourceExists) {
      throw new Error(`Source file not found: ${report.imagePath}`);
    }

    // Copy file to denied location
    await this.copyFile(report.imagePath, deniedImagePath);

    // Delete original file from pending
    await this.deleteFile(report.imagePath);

    // Return the new path (not URL, as denied reports don't need public URLs)
    return deniedImagePath;
  }
  /**
   * Retrieves the name of the configured storage bucket.
   *
   * @returns {string} - The name of the storage bucket.
   */
  getBucketName(): string {
    return this.bucket.name;
  }
}
