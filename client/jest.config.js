module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.[jt]sx?$": ["babel-jest", {
      presets: [
        ["@babel/preset-env", {
          targets: {
            node: "current"
          }
        }]
      ]
    }]
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testMatch: ["**/__tests__/**/*.test.js", "**/**/tests/**/*.test.js"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/"]
};