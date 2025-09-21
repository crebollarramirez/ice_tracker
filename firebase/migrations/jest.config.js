/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testMatch: ["<rootDir>/tests/**/*.test.ts", "<rootDir>/tests/**/*.e2e.ts", "<rootDir>/tests/**/*.spec.ts"],
  collectCoverageFrom: ["migrations.ts", "!tests/**", "!node_modules/**"],
  clearMocks: true,
  restoreMocks: true,
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
};
