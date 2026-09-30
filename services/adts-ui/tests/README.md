## Running tests

All commands should be run from the `services/adts-ui` folder.

### Run all configured tests

```bash
npm test
```

The `npm test` command runs the configured test suites in this order:

```bash
npm run test:unit
npm run test:component
npm run test:integration
npm run test:routes
```

This means `npm test` currently runs:

| Command | Purpose | Runner |
|---|---|---|
| `npm run test:unit` | Runs unit tests | Jest |
| `npm run test:component` | Runs component test placeholder checks | Node test runner for now. Intended to use Playwright later |
| `npm run test:integration` | Runs integration test placeholder checks | Node test runner use Playwright later |
| `npm run test:routes` | Runs Hapi route tests | Hapi Lab |

### Run unit tests only

```bash
npm run test:unit
```

Unit tests use Jest. These tests should cover small isolated functions or helper logic that does not need the full Hapi server.

### Run component tests only

```bash
npm run test:component
```

Component tests are currently wired using the Node test runner so the folder and pipeline structure exists.

As per the test strategy, component tests are expected to move to Playwright once Playwright is configured.

### Run integration tests only

```bash
npm run test:integration
```

Integration tests are intended for checks where multiple parts of the application are tested together.

### Run route tests only

```bash
npm run test:routes
```

Route tests use Hapi Lab and are intended for Hapi route behaviour using `server.inject`.

Examples include page responses, session behaviour, request handling and route level error handling.

### Run future E2E tests

```bash
npm run test:e2e
```

E2E tests are not enabled yet. This command is currently a placeholder for future Playwright browser based tests.