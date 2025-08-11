module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'services/**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  testMatch: [
    '**/tests/services/**/*.test.js',
    '**/tests/integration/**/*.test.js'
  ],
  // No setupFilesAfterEnv to avoid database setup
};