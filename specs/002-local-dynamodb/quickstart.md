# Quickstart: Local DynamoDB for Integration and E2E Tests

Use this guide to start the local DynamoDB, load or reset the test data, run the tests against it, and check that the feature works. Table details are in [data-model.md](./data-model.md). Design choices are in [research.md](./research.md).

## Windows setup (WSL 2)

The local database harness uses POSIX shell scripts. On Windows, run the commands in this guide from a WSL 2 Linux distribution rather than PowerShell or Command Prompt.

1. In an elevated PowerShell window, install WSL 2 and Ubuntu if they are not already installed:

   ```powershell
   wsl --install -d Ubuntu
   ```

   Restart Windows if prompted, then launch Ubuntu and create its Linux user.
2. Install Docker Desktop for Windows, enable its WSL 2 engine, and enable WSL integration for the Ubuntu distribution in Docker Desktop settings.
3. In the Ubuntu terminal, install Node.js 24 and npm using the [official Node.js download instructions](https://nodejs.org/en/download). Install Node.js inside Ubuntu rather than relying on a Windows installation, which may not be available on the WSL `PATH`. Clone the repository into the Linux filesystem (for example, under `~/projects`, not `/mnt/c`) and change into the repository directory.
4. Confirm the WSL terminal can use Docker Compose and Node.js:

   ```bash
   docker compose version
   # Or use Podman Compose:
   podman compose version
   node --version
   npm --version
   ```

   `node --version` should report version 24. Install repository dependencies from that same terminal:

   ```bash
   npm ci
   npm ci --prefix services/adts-backend
   npm ci --prefix services/adts-ui
   npm ci --prefix services/adts-submissions-service
   ```
5. Continue with the steps below from the Ubuntu terminal. The test commands start and reset DynamoDB automatically; no AWS account or credentials are required.

## Prerequisites

- Docker Compose or Podman Compose with a running container engine (Docker Desktop/Engine or Podman Desktop/Engine). The database harness also supports the standalone `docker-compose` client. If using a standalone Compose client with Podman, configure its Docker-compatible socket through `DOCKER_HOST`.
- Node.js 24 and npm, with root and service dependencies installed.
- Port `8000` free on the host (DynamoDB Local). Port `8001` only if you use the optional admin UI.
- No AWS account or credentials are needed.

## 1. Start the local database

From the repository root:

```bash
npm run test:db:up
```

Expected outcome: the `dynamodb` container becomes healthy, the `init` job creates the three tables and loads the seeded state, and the command exits `0` within about a minute on a first run (less after images are cached). Confirm the tables:

```bash
aws dynamodb list-tables --endpoint-url http://localhost:8000 --region eu-west-2
```

Expected output lists `adts-reference-data`, `adts-submissions`, and `adts-ci-lims-mapping`. The dummy credentials `local` / `local` are enough.

If the database cannot start, the command exits non-zero with a message naming the cause (container engine not running, port in use, or health check timeout). It never proceeds to tests with a database that is not ready.

## 2. Reset to a known state

```bash
npm run test:db:reset             # tables recreated and seeded (default)
SEED_DATA=false npm run test:db:reset   # tables recreated and empty
```

Expected outcome: all three tables are dropped and recreated, then loaded with the chosen state. Running the reset twice produces the same result.

`SEED_DATA` accepts only `true` or `false` and defaults to `true`. Each integration or E2E run exports a unique `TEST_RUN_ID`; the same ID is passed through database setup, and Playwright also provides it to the backend. Tests that write data should include this ID in their record keys or attributes.

The integration and E2E commands run a reset automatically before each suite (see step 4), so you normally do not need this step.

## 3. Run the backend integration tests

```bash
npm run test:integration --prefix services/adts-backend
```

Or from the root: `npm run test:integration`.

Expected outcome: the command starts the database, resets it, runs the integration tests in `services/adts-backend/tests/integration/` against `http://localhost:8000`, and exits `0`. Species are returned in order as Chicken, Cow, Sheep. Draft search assertions cover:

| Filter | Expected Draft IDs |
|---|---|
| `client=Acme` | `draft-001`, `draft-002` |
| `clinician=Alice` | `draft-001`, `draft-003` |
| `submitted-date=6_months` | `draft-001`, `draft-002` |
| `client=Acme&clinician=Alice&submitted-date=6_months` | `draft-001` |

## 4. Run the E2E tests

```bash
npm run test:e2e:chromium
```

Expected outcome: a global setup starts the database and resets it, then Playwright starts the submissions service, the backend (pointed at the local endpoint, never reusing an existing backend process), and the UI, and runs the tests. The species list in the UI matches the seeded species (Chicken, Cow, Sheep).

## 5. Stop the database

```bash
npm run test:db:down           # stops containers; keeps volume data
docker compose -f local/dynamodb/docker-compose.yml down -v   # Docker: stop and wipe all data
# Or: podman compose -f local/dynamodb/docker-compose.yml down -v
```

## Verifying the feature

Run these checks to confirm each success criterion in [spec.md](./spec.md):

| Check | How | Pass condition |
|-------|-----|----------------|
| SC-001 (setup in 5 min) | Follow steps 1 and 3 on a clean machine | Tests run and pass within 5 minutes, excluding image download time |
| SC-002 (no cloud credentials) | Unset `AWS_*` variables, run step 3 | Passes without AWS access |
| SC-003 (repeatability) | Run step 3 ten times in a row | Identical results every time |
| SC-004 (known state) | Add a record with the AWS CLI, then run step 3 | Test sees the seeded state, not the added record |
| SC-005 (failure reported) | Stop the database, then run the integration tests directly without their startup wrapper | Jest exits non-zero on connection failure; no test reports an empty result as a pass |

For SC-005, run the tests directly from the backend directory so the command does not start the database:

```bash
npm run test:db:down
cd services/adts-backend
DYNAMODB_ENDPOINT=http://localhost:8000 node --experimental-vm-modules \
  node_modules/jest/bin/jest.js tests/integration
cd ../..
npm run test:db:up
npm run test:db:reset
```

The direct Jest command is expected to exit non-zero and report DynamoDB connection errors. Restart and reset the database after the check.

## Verification evidence

Evidence collected on 2026-10-29:

| Check | Result |
|---|---|
| Seeded integration repeatability | Ten consecutive runs passed; each ran 7 tests asserting the ordered species results, Draft client/clinician/date/combined filters, and visible query failure handling. |
| Empty reset repeatability | Two `SEED_DATA=false` resets each produced table item counts `0, 0, 0`; the default seeded reset restored counts `9, 4, 2`. |
| New Draft data-access coverage | `submissions.js`: 100% statements, 100% functions, 100% lines, 96.87% branches. Unit and integration suites passed 19 tests. |
| Database unavailable | Direct integration Jest run exited 1 (5 expected failures, 2 passed) and logged DynamoDB errors rather than returning successful empty results. |
| Chromium E2E | 11 tests passed after the seed-mode changes. |

## Failure modes

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Container engine is unavailable | Docker or Podman is stopped | Start the engine, then retry |
| Port 8000 already in use | Another DynamoDB or service is bound to the port | Stop it, or change the host port mapping in `docker-compose.yml` |
| Health check timed out | Container started but DynamoDB did not respond | Run `docker compose -f local/dynamodb/docker-compose.yml logs dynamodb` |
| Backend integration tests fail with `ResourceNotFoundException` | Reset did not run or tables were removed | Run `npm run test:db:reset` |
| Tests see unexpected records | Previous run wrote data | Run `npm run test:db:reset`; tests reset automatically |

## Configuration reference

| Setting | Value used by tests | Source |
|---------|---------------------|--------|
| Endpoint | `http://localhost:8000` | Set by the test harness; guarded to localhost |
| Region | `eu-west-2` | Set by the test harness |
| Credentials | `local` / `local` | Set by the test harness; not read from the environment |
| Seed mode | `seeded` (default) | `SEED_DATA` environment variable |
| Run identifier | Unique per integration or E2E run | Generated by the backend npm script or Playwright config |

Image tags are pinned in [docker-compose.yml](../../local/dynamodb/docker-compose.yml). Update them only as a deliberate change, since repeatability (SC-003) depends on them.

The pinned images are `amazon/dynamodb-local:3.3.2` and `amazon/aws-cli:2.38.5`.
