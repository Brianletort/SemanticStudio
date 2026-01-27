/**
 * Playwright Configuration for Memory System Tests
 * 
 * This configuration is optimized for testing the 4-tier memory system
 * and core chat features with browser automation.
 */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './',
  testMatch: ['**/*.spec.ts'],
  
  // Global timeout for each test
  timeout: 120000, // 2 minutes per test
  
  // Expect timeout for assertions
  expect: {
    timeout: 15000,
  },
  
  // Fail fast in CI
  fullyParallel: false,
  
  // Retry on failure
  retries: process.env.CI ? 2 : 1,
  
  // Single worker for sequential testing
  workers: 1,
  
  // Reporter for detailed output
  reporter: [
    ['list'],
    ['html', { outputFolder: '../test-reports/memory' }],
    ['json', { outputFile: '../test-reports/memory/results.json' }],
  ],
  
  use: {
    // Base URL for tests
    baseURL: 'http://localhost:3000',
    
    // Browser settings
    headless: process.env.CI ? true : false,
    viewport: { width: 1400, height: 900 },
    
    // Screenshots on failure
    screenshot: 'only-on-failure',
    
    // Video recording
    video: 'retain-on-failure',
    
    // Trace for debugging
    trace: 'retain-on-failure',
    
    // Action timeout
    actionTimeout: 30000,
    
    // Navigation timeout
    navigationTimeout: 30000,
  },
  
  projects: [
    {
      name: 'core-chat',
      testMatch: ['**/core-*.spec.ts'],
    },
    {
      name: 'memory-tiers',
      testMatch: ['**/tier*.spec.ts'],
    },
    {
      name: 'compression',
      testMatch: ['**/progressive-*.spec.ts'],
    },
    {
      name: 'stress',
      testMatch: ['stress/**/*.spec.ts'],
    },
    {
      name: 'edge-cases',
      testMatch: ['edge-cases/**/*.spec.ts'],
    },
    {
      name: 'all',
      testMatch: ['**/*.spec.ts'],
    },
  ],
  
  // Web server configuration
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
    timeout: 60000,
  },
});
