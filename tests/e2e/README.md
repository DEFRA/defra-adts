# ADTS end-to-end tests

Cross-service Playwright tests that drive the ADTS application through a real browser.

E2E is the top of the testing pyramid — slower and more expensive than unit, component or route tests. We keep this suite deliberately small and stable, focused on the user journeys that must work for ADTS to be useful. Everything else belongs in the per-service test folders inside `services/<service>/tests/`.

See [ADTS Test Strategy v1.3](../../docs/test-strategy.md) for how this layer fits into the overall approach.

## Folder structure

| Folder | What's in it | When it runs |
|---|---|---|
| `smoke/` | Application-level smoke checks — the service is up and the key pages render | Before promotion to Preprod, Prod, and on release pipelines |
| `journeys/` | Full user journeys that cross services (e.g. sick animal submission end-to-end) | On merge to main, nightly, pre-release |
| `dashboard/` | Dashboard-specific journeys and acceptance tests (DASH-* tickets) | On every PR that touches UI, submissions service, or E2E config (see path filters in `.github/workflows/e2e-tests.yml`) |
| `pages/` | Page Object files — selectors and page-level actions in one place | — |
| `fixtures/` | Reusable setup — test users, authenticated states. **Never store real credentials here.** | — |
| `utils/` | Shared helpers (e.g. `axe.js` for WCAG 2.2 AA accessibility checks) | — |
| `test-data/` | Static JSON data used by E2E tests | — |

## Prerequisites

From the repo root:

```bash
# One-off: install deps across root and every service
npm run install:all

# One-off: install Playwright browsers (Chromium is what CI uses)
npx playwright install chromium
```

Node version required: **24.x**.

## Running tests locally

**From the repo root, not from `tests/e2e/`.** Playwright config lives at `./playwright.config.js`.

### The common commands

```bash
# Run everything
npm run test:e2e

# Chromium only (matches CI exactly)
npm run test:e2e:chromium

# Playwright UI mode — step through, see traces, re-run from any step
npm run test:e2e:ui

# After a run, open the HTML report
npm run test:e2e:report
```

### Running a subset

```bash
# One folder (e.g. just smoke)
npx playwright test tests/e2e/smoke

# One file
npx playwright test tests/e2e/dashboard/dash-12-submission-management.spec.js

# By test name
npx playwright test --grep "DASH-02"
npx playwright test --grep "AC6: Submitted date value is preserved"
```

### Debugging a failing test

```bash
# Watch the browser as the test runs
npx playwright test --grep "DASH-02" --headed

# Step through interactively
npx playwright test --grep "AC6" --debug
```

## Services and auto-start

Playwright's `webServer` config auto-starts `adts-ui` and `adts-submissions-service` when they aren't already running locally (`reuseExistingServer: !process.env.CI`). You don't need to start them manually unless you want to watch their logs:

```bash
# Terminal A — submissions service on :3100
npm start --prefix services/adts-submissions-service

# Terminal B — UI on :3000
npm start --prefix services/adts-ui

# Terminal C — run tests, which will reuse the running services
npm run test:e2e
```

If you hit `ERR_CONNECTION_REFUSED` on `http://localhost:3000`, a service hasn't come up — check that port isn't already in use by something else (`lsof -tiTCP:3000`), and check each service was `npm install`ed.

## Accessibility checks

Each page tested should be run through axe via the helper in `utils/axe.js`:

```javascript
import { checkAccessibility } from '../utils/axe.js'

test('page is accessible to WCAG 2.2 AA', async ({ page }) => {
  await page.goto('/')
  await checkAccessibility(page)
})
```

The helper runs an axe scan with WCAG 2.0 A, 2.0 AA, 2.1 A, 2.1 AA, and 2.2 AA rulesets, fails the test on any `critical` or `serious` violation, and reports them with their axe rule ID.

**Known exclusion:** `.govuk-header` is scoped out of axe runs because GOV.UK Frontend 5.14.0 header links fail WCAG 2.5.8 Target Size (17px actual vs 24px required). This is upstream — tracked in the backlog for review when GOV.UK Frontend bumps the header link target size.

## Mocks and test data

External dependencies are stubbed in `../tests/mocks/`:
- `tests/mocks/customer-identity/` — Customer Identity sign-in flow
- `tests/mocks/entra-id/` — Entra ID (staff auth)
- `tests/mocks/graph-api/` — Microsoft Graph lookups
- `tests/mocks/lims/` — LIMS adapter responses

Test fixtures and journey data live here under `fixtures/` and `test-data/`. Keep real customer data out of the repo — use realistic-looking fakes.

## Reports and artefacts

After every run:
- `playwright-report/` — interactive HTML report (open with `npm run test:e2e:report`)
- `test-results/` — screenshots, videos, traces for failed tests
- `test-results/junit.xml` — JUnit XML for CI / dashboards

Both folders are gitignored.

In CI, the Playwright report is uploaded as a workflow artifact (`playwright-report` on failure, `playwright-report-success` on green runs — kept 7 and 3 days respectively).

## When to add a test here vs elsewhere

| Scenario | Where it goes |
|---|---|
| Pure function or helper logic | `services/<service>/tests/unit/` |
| Template rendering, GOV.UK component output | `services/<service>/tests/component/` |
| Hapi route handling, session, error paths | `services/<service>/tests/routes/` |
| Service-internal integration | `services/<service>/tests/integration/` |
| Contract or API-shape checks between services | `tests/api/` |
| User journey that spans UI → submissions service → UI | **Here** (`tests/e2e/journeys/`) |
| Dashboard-specific acceptance tests (DASH-* tickets) | **Here** (`tests/e2e/dashboard/`) |
| Smoke check against a deployed environment | **Here** (`tests/e2e/smoke/`) |

If a test can be written at a lower layer, prefer that — faster, cheaper, less flaky. E2E is for the behaviours only an end-to-end test can prove.

## When this suite runs in CI

Workflow: `.github/workflows/e2e-tests.yml`

Triggers on push/PR to `main` when any of these change:
- `tests/e2e/**`
- `playwright.config.js`
- Root `package.json` / `package-lock.json`
- `services/adts-ui/**`
- `services/adts-submissions-service/**`
- The workflow file itself

Also triggerable manually from Actions → E2E tests (Playwright) → Run workflow.

## Writing new tests

A quick checklist:
1. Does this test actually need E2E, or could it be a route / component test? (See layering table above.)
2. Pick the right folder — `smoke/`, `journeys/`, or `dashboard/`.
3. Use a Page Object from `pages/` if you're interacting with the dashboard; add one if you're exercising a new page.
4. Prefer `getByLabel`, `getByRole`, `getByText` over CSS/XPath selectors — accessible selectors are more stable and test accessibility by default.
5. Add `await checkAccessibility(page)` to any new journey.
6. Keep assertions user-visible: `getByLabel('Status').toHaveValue('draft')` not `.app-status-dropdown[value="draft"]`.
7. Tag the test file with `@story <TICKET>` and `@acs <AC list>` in a JSDoc at the top so traceability back to tickets is clear.