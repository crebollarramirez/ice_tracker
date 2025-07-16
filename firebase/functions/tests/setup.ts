/**
 * Jest setup file for Firebase Functions tests
 * This file is run before all tests and sets up the testing environment
 */

// Mock global fetch for any HTTP requests in tests
global.fetch = jest.fn();

// Set up environment variables for tests
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: "test-project-id",
  databaseURL: "http://localhost:9000?ns=test-project-id-default-rtdb",
  storageBucket: "test-project-id.appspot.com",
});

process.env.GCLOUD_PROJECT = "test-project-id";
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_DATABASE_EMULATOR_HOST = "localhost:9000";

// Mock external API keys for tests
process.env.GOOGLE_MAPS_API_KEY = "test-google-maps-api-key";
process.env.OPENAI_API_KEY = "test-openai-api-key";

// Extend Jest timeout for integration tests
jest.setTimeout(30000);

// Suppress console warnings during tests
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  // Filter out Firebase emulator warnings that are expected in tests
  const message = args[0];
  if (
    typeof message === "string" &&
    (message.includes("detected Firebase config") ||
      message.includes("emulator") ||
      message.includes("FIREBASE_CONFIG"))
  ) {
    return;
  }
  originalWarn(...args);
};

// Global test setup
beforeAll(() => {
  // Any global setup can go here
});

afterAll(() => {
  // Any global cleanup can go here
});
