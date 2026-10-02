
import { defineConfig, devices } from '@playwright/test'

const config = {
  testDir: './tests/e2e',

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: [
  {
    command: 'npm start --prefix services/adts-lims-adapter',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000
  },
  {
    command: 'npm start --prefix services/adts-ui',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
    env: {
      LIMS_ADAPTER_URL: 'http://localhost:3100'
    }
  }
],

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ]
}

export default defineConfig(config)