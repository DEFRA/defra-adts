# Quickstart: Local DynamoDB for Integration and E2E Tests

Use this guide to start the local DynamoDB, load or reset the test data, run the tests against it, and check that the feature works. Table details are in [data-model.md](./data-model.md). Design choices are in [research.md](./research.md).

## Prerequisites

- Docker with the Compose plugin (Docker Desktop, or Docker Engine on Linux). Confirm with `docker compose version`.
- Node.js 24 and npm, with dependencies installed (`npm ci` at the root and in `services/adts-backend`).
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

If the database cannot start, the command exits non-zero with a message naming the cause (Docker not running, port in use, or health check timeout). It never proceeds to tests with a database that is not ready.

## 2. Reset to a known state

```bash
npm run test:db:reset             # tables recreated and seeded (default)
SEED_DATA=false npm run test:db:reset   # tables recreated and empty
```

Expected outcome: all three tables are dropped and recreated, then loaded with the chosen state. Running the reset twice produces the same result.

The integration and E2E commands run a reset automatically before each suite (see step 4), so you normally do not need this step.

## 3. Run the backend integration tests

```bash
npm run test:integration --prefix services/adts-backend
```

Or from the root: `npm run test:integration`.

Expected outcome: the command starts the database, resets it, runs the integration tests in `services/adts-backend/tests/integration/` against `http://localhost:8000`, and exits `0`. Records are read from the seeded state, for example the three `REF#SPECIES` items.

## 4. Run the E2E tests

```bash
npm run test:e2e:chromium
```

Expected outcome: a global setup starts the database and resets it, then Playwright starts the submissions service, the backend (pointed at the local endpoint, never reusing an existing backend process), and the UI, and runs the tests. The species list in the UI matches the seeded species (Chicken, Cow, Sheep).

## 5. Stop the database

```bash
npm run test:db:down           # stops containers; keeps data in the Docker volume
docker compose -f local/dynamodb/docker-compose.yml down -v   # stops and wipes all data
```

## Verifying the feature

Run these checks to confirm each success criterion in [spec.md](./spec.md):

| Check | How | Pass condition |
|-------|-----|----------------|
| SC-001 (setup in 5 min) | Follow steps 1 and 3 on a clean machine | Tests run and pass within 5 minutes, excluding image download time |
| SC-002 (no cloud credentials) | Unset `AWS_*` variables, run step 3 | Passes without AWS access |
| SC-003 (repeatability) | Run step 3 ten times in a row | Identical results every time |
| SC-004 (known state) | Add a record with the AWS CLI, then run step 3 | Test sees the seeded state, not the added record |
| SC-005 (failure reported) | Run `npm run test:db:down`, then step 3 | Command fails with a clear message; no test reports an empty result as a pass |

## Failure modes

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| "Docker is not running" | Docker Desktop is stopped | Start Docker, then retry |
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

Image tags are pinned in [docker-compose.yml](../../local/dynamodb/docker-compose.yml). Update them only as a deliberate change, since repeatability (SC-003) depends on them.
