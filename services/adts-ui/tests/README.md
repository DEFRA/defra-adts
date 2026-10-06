# adts-ui

Hapi,Jest + Nunjucks UI for the Animal Disease Testing Service, built with GOV.UK Frontend.

## First-time setup

From the repo root:

```bash
npm install                               # root (Playwright, axe-core)
npm install --prefix services/adts-ui     # this service's deps
```

Or install everything in one go:

```bash
npm run install:all
```

Node version required: **24.x**.

## Running the service

From this folder (`services/adts-ui`):

```bash
# Start the UI on http://localhost:3000
npm start

# Start with live reload on template changes
npm run start:watch

# Build assets (CSS + JS)
npm run build

# Lint
npm run lint

# Kill anything already bound to port 3000
npm run kill
```

The UI expects `adts-submissions-service` on port 3100. Start it in a separate terminal:

```bash
npm start --prefix services/adts-submissions-service
```

## Running tests

All commands below should be run from `services/adts-ui`.

### Run all configured tests

```bash
npm test
```

The `npm test` command runs the configured test suites in this order — stopping at the first failing suite:

| Command | Purpose | Runner |
|---|---|---|
| `npm run test:unit` | Pure functions and helpers (no server) | Jest |
| `npm run test:component` | Template rendering (Nunjucks blocks, GOV.UK components) | Jest |
| `npm run test:integration` | Multiple parts of the app together, below the HTTP layer | Jest |
| `npm run test:routes` | Hapi routes exercised via `server.inject` — page responses, session behaviour, request handling, route-level error handling | Hapi Lab |

### Run a single suite

```bash
npm run test:unit
npm run test:component
npm run test:integration
npm run test:routes
```

### Run a single file or test

Jest suites:

```bash
npx jest tests/component/dashboard-filter-block.test.js
npx jest -t "renders the Status dropdown"
```

Hapi Lab (routes):

```bash
npx lab tests/routes/home.lab.test.js
```

### Coverage

```bash
npm run test:unit -- --coverage
```

Reports land in `coverage/` (gitignored).

### End-to-end tests

Playwright E2E tests exercise the UI as part of a cross-service journey and live at the repo root, not inside this service.

→ See [`tests/e2e/README.md`](../../tests/e2e/README.md) for how to run them, debug failures, and write new ones.

Running `npm test` from this folder does **not** run E2E tests. For the full gate across all services + E2E, run `npm test` from the repo root.

## Troubleshooting

**`ERR_MODULE_NOT_FOUND: Cannot find package '@hapi/hapi'`** — service deps aren't installed. Run `npm install` from this folder, or `npm run install:all` from the repo root.

**Port 3000 already in use** — run `npm run kill` to free it, or find the culprit with `lsof -tiTCP:3000`.
