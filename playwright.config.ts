import path from 'path';
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Constellation-V E2E: static HTML app served locally or pointed at deployed BASE_URL.
 * Run seed first (or use project dependency) to capture Supabase session in tests/.auth/user.json
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /seed\.spec\.ts$/,
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      testMatch: /e2e\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, 'tests', '.auth', 'user.json'),
      },
    },
    {
      name: 'smoke-public',
      testMatch: /smoke\/public\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'smoke-crm',
      dependencies: ['setup'],
      testMatch: /smoke\/crm-pages\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, 'tests', '.auth', 'user.json'),
      },
    },
  ],
  webServer: process.env.SKIP_WEB_SERVER
    ? undefined
    : {
        command: 'npx --yes serve -l 4173 .',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
