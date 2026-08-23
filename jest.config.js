/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/nodes', '<rootDir>/credentials'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.build.json' }],
  },
  // v8 maps back through ts-jest source maps and avoids babel instrumentation.
  coverageProvider: 'v8',
  collectCoverageFrom: ['nodes/**/*.ts', 'credentials/**/*.ts', '!**/*.spec.ts'],
  coverageReporters: ['text', 'text-summary'],
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
};
