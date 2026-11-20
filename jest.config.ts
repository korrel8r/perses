import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  testEnvironment: 'jsdom',
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  // @perses-dev/components re-exports ECharts, which ships ESM only, and
  // imports font CSS that Jest cannot parse.
  transformIgnorePatterns: ['/node_modules/(?!(echarts|zrender)/)'],
  moduleNameMapper: { '\\.css$': '<rootDir>/src/test-stubs/style-mock.ts' },
  transform: {
    '^.+\\.[jt]sx?$': [
      '@swc/jest',
      {
        swcrc: false,
        jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } },
        module: { type: 'commonjs' },
      },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/src/setup-tests.ts'],
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx', '<rootDir>/demo/**/*.test.tsx'],
};

export default config;
