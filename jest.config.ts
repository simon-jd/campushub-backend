import type { Config } from 'jest';

// Lab 7 test runner. Suites live in __tests__ folders beside the code they exercise; the older
// node:test contract suites in src/tests/ are not matched here and still run via `npm run test:contract`.
const config: Config = {
  // Transpile per file: ts-jest's full type-check cannot use the project's Node16 module mode.
  // Types are still enforced for the whole project, tests included, by `npm run typecheck`.
  transform: { '^.+\\.ts$': ['ts-jest', { isolatedModules: true }] },
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  // Starts an in-memory MongoDB per test file and empties it between tests.
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  // The first run may download a mongod binary, and every test file boots its own server.
  testTimeout: 30_000,
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: ['src/services/**/*.ts', 'src/controllers/**/*.ts', '!**/__tests__/**'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: { statements: 80, branches: 80, functions: 80, lines: 80 },
  },
};

// Plain CommonJS export: Node loads this file natively, because Jest's ts-node loader forces
// module=commonjs, which conflicts with the project's Node16 module settings (TS5110).
module.exports = config;
