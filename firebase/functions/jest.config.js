const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  moduleNameMapper: {
    "^@utils/(.*)$": "<rootDir>/src/utils/$1", // Map @utils to src/utils
  },
  moduleDirectories: ["node_modules", "src"], // Allow Jest to resolve modules from src
};
