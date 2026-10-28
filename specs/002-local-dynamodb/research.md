# Research: Local DynamoDB Testing

Resolves the open design questions for [plan.md](./plan.md). Each entry records the decision, why it was chosen, and the alternatives considered.

## 1. How suites reset the database to a known state

**Decision**: Reset by dropping and recreating the three ADTS tables from `local/dynamodb/tables/*.json`, then loading the selected fixture set (`seeded` or `empty`). Implemented as a `RESET=true` mode in the existing `init` service (`init.sh`).

**Rationale**:
- `batch-write-item` (used by `init.sh`) never deletes items. Re-running init therefore cannot remove records a previous run added or changed, so it cannot guarantee a known state.
- Drop and recreate gives a deterministic result with no residual items, and it reuses the table definitions and seed files already in the repo.
- The table count is three and the seed is 12 items, so the cost per suite is a few seconds.

**Alternatives considered**:
- *Scan and batch-delete every item, then reseed.* Needs pagination and the 25-item batch limit handled in code. Slower on large tables and more moving parts than the tables need.
- *Re-run `init.sh` only.* Idempotent, but does not remove extra or modified items. Rejected because it does not meet FR-007 / SC-004.
- *`docker compose down -v` and restart before each suite.* Correct but slow, and it restarts the container for every suite. Kept as the documented manual reset path only.

## 2. Test command lifecycle (start, wait, fail clearly)

**Decision**: A single POSIX script, `local/dynamodb/test-db.sh`, with three subcommands:
- `up`: runs `docker compose up -d --wait`. `--wait` blocks until the `dynamodb` healthcheck passes and the `init` job completes. On failure it prints a clear message (Docker not running, or port 8000 in use) and exits non-zero.
- `reset`: runs `docker compose run --rm -e RESET=true -e SEED_DATA=<mode> init`.
- `down`: runs `docker compose down`.

npm scripts and test harnesses call these subcommands. Backend integration tests call them through an npm script. The Playwright `globalSetup` calls them too.

**Rationale**: One script is shared by developers, the Jest integration run, the Playwright run, and CI, so they behave the same. `--wait` already provides the readiness gate required by FR-001 and the Edge Cases. Keeping the logic in shell means no Node dependency is added to `local/dynamodb/`.

**Alternatives considered**:
- *Put the orchestration in each test framework separately.* Duplicates logic and risks drift between Jest and Playwright.
- *Require the developer to start the container first.* Rejected by the clarification (Q5).

## 3. Enforcing local-only data access (FR-005, FR-010)

**Decision**: Test runs set the backend's data endpoint and credentials explicitly, not by inheritance:
- `DYNAMODB_ENDPOINT=http://localhost:8000`
- `AWS_REGION=eu-west-2`
- `AWS_ACCESS_KEY_ID=local`, `AWS_SECRET_ACCESS_KEY=local`

The test setup also asserts that `DYNAMODB_ENDPOINT` points at `localhost` or `127.0.0.1` and fails the run if it does not. This prevents hosted data being queried even when AWS variables are present in the environment (Edge Cases).

**Rationale**: The SDK honours `DYNAMODB_ENDPOINT` only where it is set, and the production container images do not set it, so production config is unaffected (FR-010). The assertion gives a hard guard against accidental hosted access.

**Alternatives considered**:
- *Rely on ambient `AWS_ENDPOINT_URL_DYNAMODB`.* Could be overridden or absent. Rejected.

## 4. Backend server reuse during E2E

**Decision**: Set `reuseExistingServer: false` for the backend `webServer` entry in `playwright.config.js`. Keep reuse for the UI and submissions services as today.

**Rationale**: A backend already running on port 3200 may have been started with hosted AWS settings. Reusing it would bypass the local endpoint guarantee (FR-005). The backend is cheap to start, so a fresh start costs little.

**Alternatives considered**:
- *Keep reuse and document it.* Leaves a silent path to hosted data. Rejected.

## 5. Where the E2E reset runs

**Decision**: Playwright `globalSetup` (new file under `tests/e2e/`) runs `test-db.sh up` and `test-db.sh reset` once per `playwright test` invocation.

**Rationale**: Reset happens before any test runs (FR-007). The backend creates its DynamoDB client lazily, so starting it in parallel with the container start is safe.

**Interpretation**: "Each suite" is taken to mean one integration run and one E2E run (one command invocation). It does not mean every spec file, which would make the run slow for little gain. Recorded as an assumption in plan.md.

**Alternatives considered**:
- *Per-spec reset via fixtures.* More isolation but slower. Deferred until a test needs it.

## 6. Container images and reproducibility (SC-003)

**Decision**: Pin `amazon/dynamodb-local` and `amazon/aws-cli` to explicit version tags in `docker-compose.yml` (replacing `:latest`). The exact tags are chosen during implementation and recorded in quickstart.md.

**Rationale**: Unpinned `latest` images can change behaviour between runs and undermine the 10-run repeatability requirement.

## 7. Fixture scope and batch limits

**Decision**: Keep the existing 12 synthetic seed items (9 reference, 2 CI-LIMS mapping, 1 submission). They are below the 25-item `batch-write-item` limit, so no chunking is needed.

**Rationale**: The clarification (Q3) requires all three tables. The existing seed covers them with synthetic data. Checked: the reference seed contains three `REF#SPECIES` records (CHICKEN, COW, SHEEP), which is what `getSpecies` reads.

**Note**: `init.sh` should fail fast if a future seed file exceeds 25 items, so the limit is not hit silently. Added to the tasks rather than built now.

## 8. Test-run identifier

**Decision**: The harness exports `TEST_RUN_ID` (a timestamp plus random suffix) for each run. Tests that write records must include it in their keys. No current test writes records, so this is a convention only.

**Rationale**: Deferred from clarification and resolved here, following the test-data strategy. It costs one environment variable and avoids a later migration.

## 9. CI wiring

**Decision**:
- Backend validation: `_validation.yml` gets an integration test command that runs `test-db.sh up` and `reset` before Jest. Coverage for new integration tests is included.
- E2E: `_e2e-tests.yml` needs no change beyond what `globalSetup` already does, since `ubuntu-latest` runners include Docker. Add `local/dynamodb/**` to the workflow path filters.

**Rationale**: The same container and scripts run in CI and locally (Q4).

## 10. Documentation

**Decision**: Update `local/dynamodb/README.md`. Its current guidance says "re-running init re-applies sample data", which does not reset data. Replace it with the `test-db.sh` reset procedure and state that the seeded state is restored by reset.
