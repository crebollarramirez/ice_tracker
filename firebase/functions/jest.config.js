/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFiles: ["<rootDir>/src/tests/jest.setup.ts"],
  roots: ["<rootDir>/src"],
  modulePathIgnorePatterns: ["<rootDir>/lib"],
  moduleNameMapper: {
    "^@utils/(.*)$": "<rootDir>/src/utils/$1", // Map @utils/* to src/utils/*
  },
};
