import { JestConfigWithTsJest } from 'ts-jest/dist/types';

const config: JestConfigWithTsJest = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  forceExit: true,
  prettierPath: null, // HACK: https://github.com/jestjs/jest/issues/14305
  testPathIgnorePatterns: ['dist', 'config', 'old-src'],
  coveragePathIgnorePatterns: [
    'src/wrappers/',
    'src/app_shutdown',
    '<rootDir>/config/',
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  reporters: ['<rootDir>/jest-reporters/emit-only-failures.js'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // https://stackoverflow.com/questions/45087018/jest-simple-tests-are-slow
        isolatedModules: true,
        tsconfig: {
          // https://github.com/kulshekhar/ts-jest/issues/4198#issuecomment-1699539680
          moduleResolution: 'classic',
        },
      },
    ],
  },
};

export default config;
