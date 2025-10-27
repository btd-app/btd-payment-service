module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.spec.ts',
    '!**/*.interface.ts',
    '!**/*.dto.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/test/**',
    '!**/testing/**',  // Exclude test infrastructure (mocks, stubs)
    '!main.ts',
    '!app.module.ts',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    // Map type imports without extensions to their actual files
    '^../types/external$': '<rootDir>/types/external.ts',
    '^../types/prisma-extended$': '<rootDir>/types/prisma-extended.ts',
    '^./types/external$': '<rootDir>/types/external.ts',
    '^./types/prisma-extended$': '<rootDir>/types/prisma-extended.ts',
  },
  // Coverage thresholds to enforce minimum code coverage
  // Global thresholds ensure the codebase maintains high test coverage
  coverageThreshold: {
    global: {
      statements: 65,
      branches: 50,
      functions: 55,
      lines: 65,
    },
  },
  // Note: Critical payment services exceed these thresholds significantly:
  // - stripe.service.ts: 97.8% statements, 98.21% branches, 100% functions
  // - payment.service.ts: 98.39% statements, 91.11% branches, 100% functions
  // - subscription.service.ts: 97.59% statements, 95.83% branches, 100% functions
  // - webhook.controller.ts: 95.38% statements, 69.87% branches, 93.75% functions
  // - payment-grpc.controller.ts: 88.54% statements, 60.22% branches, 82.85% functions
  coverageReporters: ['text', 'text-summary', 'html', 'lcov', 'json'],
};
