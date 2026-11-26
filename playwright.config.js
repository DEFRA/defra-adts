
import { defineConfig, devices } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const testRunId = `${Date.now()}-${randomUUID()}`
process.env.TEST_RUN_ID = testRunId

const config = {
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.js',

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
    command: 'node tests/mocks/lims/lims-server.js',
    url: 'http://127.0.0.1:3300/health',
    reuseExistingServer: false,
    timeout: 30 * 1000,
    env: {
      PORT: '3300'
    }
  },
  {
    command: 'node tests/mocks/lims/server.js',
    url: 'http://127.0.0.1:8500/health',
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
    env: {
      PORT: '8500'
    }
  },
  {
    command: 'npm start --prefix services/adts-submissions-service',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 60 * 1000,
    env: {
      PORT: '3100',
      LIMS_BASE_URL: 'http://127.0.0.1:8500',
      LIMS_PREFIX: '/LIMSRestAPi/',
      LIMS_TIMEOUT_MS: '1000',
      LIMS_ALLOW_HTTP: 'true',
      LIMS_API_URL: 'http://127.0.0.1:3300',
      LIMS_PVS_ID: 'E2E-PVS-001'
    }
  },
  {
    command: 'npm start --prefix services/adts-backend',
    url: 'http://127.0.0.1:3200/health',
    reuseExistingServer: false,
    timeout: 60 * 1000,
    env: {
      PORT: '3200',
      NODE_ENV: 'development',
      SUBMISSIONS_SERVICE_URL: 'http://127.0.0.1:3100',
      LOCAL_DRAFT_OWNER_ID: 'local-e2e',
      LIMS_PVS_ID: 'PVS001',
      DYNAMODB_ENDPOINT: 'http://localhost:8000',
      AWS_REGION: 'eu-west-2',
      AWS_ACCESS_KEY_ID: 'local',
      AWS_SECRET_ACCESS_KEY: 'local',
      TEST_RUN_ID: testRunId
    }
  },
  {
    command: 'npm run build --prefix services/adts-ui && npm start --prefix services/adts-ui',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
    env: {
      PORT: '3000',
      NODE_ENV: 'test',
      AUTH_MODE: 'mock',
      SESSION_SECRET: 'e2e-test-session-secret-with-at-least-32-characters',
      BACKEND_SERVICE_URL: 'http://127.0.0.1:3200'
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