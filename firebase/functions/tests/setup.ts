/**
 * Jest setup file for Firebase Functions tests
 * This file is run before all tests and sets up the testing environment
 */

// Extend global types for test mocks
declare global {
  // eslint-disable-next-line no-var
  var mockDatabaseRef: jest.Mock;
  // eslint-disable-next-line no-var
  var mockDatabasePush: jest.Mock;
  // eslint-disable-next-line no-var
  var mockDatabaseSet: jest.Mock;
  // eslint-disable-next-line no-var
  var mockFirestoreCollection: jest.Mock;
  // eslint-disable-next-line no-var
  var mockFirestoreAdd: jest.Mock;
}

// Mock global fetch for any HTTP requests in tests
global.fetch = jest.fn();

// Mock Firebase Admin SDK to prevent real database connections
const mockDatabaseRef = jest.fn();
const mockDatabasePush = jest.fn();
const mockDatabaseSet = jest.fn();
const mockFirestoreCollection = jest.fn();
const mockFirestoreAdd = jest.fn();

// Create mock implementations
mockDatabasePush.mockReturnValue({
  set: mockDatabaseSet,
  key: "mock-key-123",
});

mockDatabaseRef.mockReturnValue({
  push: mockDatabasePush,
});

mockDatabaseSet.mockResolvedValue(undefined);

mockFirestoreAdd.mockResolvedValue({ id: "mock-doc-id" });

mockFirestoreCollection.mockReturnValue({
  add: mockFirestoreAdd,
});

// Mock Firebase Admin before any imports
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  credential: {
    applicationDefault: jest.fn(),
  },
  database: jest.fn(() => ({
    ref: mockDatabaseRef,
  })),
  firestore: jest.fn(() => ({
    collection: mockFirestoreCollection,
  })),
  app: jest.fn(),
}));

// Export mocks for use in tests
global.mockDatabaseRef = mockDatabaseRef;
global.mockDatabasePush = mockDatabasePush;
global.mockDatabaseSet = mockDatabaseSet;
global.mockFirestoreCollection = mockFirestoreCollection;
global.mockFirestoreAdd = mockFirestoreAdd;


// Extend Jest timeout for integration tests
jest.setTimeout(30000);

// Suppress console warnings during tests
const originalWarn = console.warn;
const originalInfo = console.info;
const originalError = console.error;

console.warn = (...args: unknown[]) => {
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

// Suppress Firebase Functions logger output during tests unless it's an actual error
console.info = (...args: unknown[]) => {
  const message = args[0];
  if (
    typeof message === "string" &&
    (message.includes("locationId") ||
      message.includes("POST request received") ||
      message.includes("severity"))
  ) {
    return; // Suppress Firebase logger info messages
  }
  originalInfo(...args);
};

console.error = (...args: unknown[]) => {
  const message = args[0];
  if (
    typeof message === "string" &&
    (message.includes(
      "Error saving to database: Error: Database connection failed"
    ) ||
      message.includes(
        "Error saving negative content to database: Error: Firestore connection failed"
      ))
  ) {
    return; // Suppress expected test error messages
  }
  originalError(...args);
};

// Global test setup
beforeAll(() => {
  // Any global setup can go here
});

afterAll(() => {
  // Restore original console methods
  console.warn = originalWarn;
  console.info = originalInfo;
  console.error = originalError;

  // Any other global cleanup can go here
});
