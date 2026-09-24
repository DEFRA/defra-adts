# E2E Tests

This folder is for cross-service Playwright end-to-end tests.

E2E tests validate ADTS behaviour through the browser, across the UI, backend, authentication, mocks, APIs and environment configuration.

## Folder structure

- `smoke/`
  Application-level smoke checks that confirm the deployed ADTS application is basically available and usable. These are intended to run before promotion to Preprod or release environments, not as full regression tests.

- `journeys/`  
  Fuller end-to-end user journeys. These are slower and should usually run on merge to main, nightly, or pre-release.

- `pages/`  
  Page Object files. These keep selectors and page actions in one place.

- `fixtures/`  
  Reusable test setup, such as test users or authenticated states. Do not store real credentials here.

- `test-data/`  
  Static data used by E2E tests.

## Example pipeline usage

Run smoke tests only:

```bash
npx playwright test tests/e2e/smoke
