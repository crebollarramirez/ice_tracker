/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFiles: ["<rootDir>/src/tests/jest.setup.ts"],
  roots: ["<rootDir>/src"],
  modulePathIgnorePatterns: ["<rootDir>/lib"],
  moduleNameMapper: {
    "^@utils/(.*)$": "<rootDir>/src/utils/$1",
  },
  testMatch: [
    "**/*.test.ts", // Include unit and integration tests
    "**/*.e2e.ts", // Include end-to-end tests
  ],
};
