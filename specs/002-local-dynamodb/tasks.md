---
description: "Implementation tasks for local DynamoDB integration and E2E testing"
---

# Tasks: Local DynamoDB for Integration and E2E Testing

**Input**: Design documents from `/specs/002-local-dynamodb/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`

**Tests**: The feature requires a backend integration test against the local database. No separate test-first tasks are specified.

**Organization**: Tasks are grouped by user story so each increment can be implemented and verified independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Make the local database setup reproducible.

- [X] T001 [P] Pin DynamoDB Local and AWS CLI image versions in `local/dynamodb/docker-compose.yml`, and record the selected tags in `specs/002-local-dynamodb/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Provide a deterministic local database lifecycle used by the integration and E2E suites.

- [X] T002 [P] Add `RESET=true` drop-and-recreate behavior and a per-table 25-item seed-batch limit check to `local/dynamodb/init.sh`, preserving idempotent initialization when reset is not requested
- [X] T003 Create the POSIX `up`, `reset`, and `down` commands in `local/dynamodb/test-db.sh`; `up` must wait for Compose health and init completion, and startup failures must report a useful error
- [X] T004 Add root npm scripts `test:db:up`, `test:db:reset`, and `test:db:down` in `package.json` to call `local/dynamodb/test-db.sh`

**Checkpoint**: Shared database startup and seeded reset are available to both backend integration and E2E runs.

---

## Phase 3: User Story 1 - Run backend tests with local data (Priority: P1) 🎯 MVP

**Goal**: Run backend integration tests against repeatable local fixtures without hosted AWS access, including filtering Draft submissions stored in local DynamoDB.

**Independent Test**: Run `npm run test:integration --prefix services/adts-backend` without AWS credentials or connectivity; confirm `GET /GetSpecies` returns the seeded species in the established response shape and order, and submission search returns the expected Draft records for client, clinician, and date filters. Database failures must be reported as errors rather than successful empty results. Non-Draft submission coverage remains out of scope until a local LIMS mock exists.

### Implementation for User Story 1

- [X] T005 [P] [US1] Add `services/adts-backend/tests/integration/dynamo.integration.test.js` to exercise the backend's real DynamoDB species lookup against the local endpoint and verify expected fixture results and query failure handling
- [X] T006 [P] [US1] Add a `test:integration` npm script to `services/adts-backend/package.json` that starts and resets the local database before running the backend integration tests
- [X] T007 [P] [US1] Add synthetic Draft submissions with distinct client, clinician, and submission-date values to `local/dynamodb/seed/adts-submissions.json`, retaining the table's required keys and index attributes
- [X] T008 [P] [US1] Document the Draft fixtures and their client, clinician, and date filter values in `specs/002-local-dynamodb/data-model.md`
- [X] T009 [US1] Create `services/adts-backend/src/data/submissions.js` with a `getSubmissions` data-access method that reads Draft submissions from DynamoDB through the shared client, honours supported search filters, and uses the existing `DYNAMODB_ENDPOINT` configuration without affecting production defaults
- [X] T010 [US1] Wire the backend `/submissions` route in `services/adts-backend/src/app.js` so Draft searches use DynamoDB and non-Draft submissions retain their existing submissions-service/LIMS path and response contract
- [X] T011 [US1] Set `DYNAMODB_ENDPOINT=http://localhost:8000` explicitly in the backend `test:integration` command in `services/adts-backend/package.json` so the test run targets local DynamoDB regardless of ambient AWS endpoint settings
- [X] T012 [US1] Extend `services/adts-backend/tests/integration/dynamo.integration.test.js` to verify exact Draft search results for client, clinician, date, and combined filters using the seeded submissions
- [X] T013 [US1] Add the root `test:integration` wrapper in `package.json` to invoke the backend integration script
- [X] T014 [US1] Update `.github/workflows/adts-services_build.yml` to run the backend integration script after backend validation tests and include `local/dynamodb/**` in the backend and E2E change filters

**Checkpoint**: The backend integration suite uses only local DynamoDB fixtures and can be run independently of E2E.

---

## Phase 4: User Story 2 - Run end-to-end tests without cloud data (Priority: P2)

**Goal**: Start the local database before Playwright and force backend requests to use its local endpoint.

**Independent Test**: With hosted AWS access unavailable, run `npm run test:e2e:chromium`; verify setup starts and resets the local database, the backend uses its localhost endpoint and dummy credentials, and the fixture-backed journey completes.

### Implementation for User Story 2

- [X] T015 [P] [US2] Create `tests/e2e/global-setup.js` to run `local/dynamodb/test-db.sh up` and reset the seeded fixture state once before each Playwright invocation
- [X] T016 [US2] Configure `playwright.config.js` to use `tests/e2e/global-setup.js`, set the backend's DynamoDB endpoint, region, and dummy credentials explicitly, and disable reuse of an existing backend server
- [X] T017 [P] [US2] Update `tests/e2e/README.md` with the local DynamoDB prerequisite, automatic startup/reset behavior, and local-only backend configuration

**Checkpoint**: Playwright E2E runs do not depend on ambient AWS configuration or a pre-existing backend process.

---

## Phase 5: User Story 3 - Reset or run without sample data (Priority: P3)

**Goal**: Let developers select seeded or empty tables and restore that known state manually or automatically.

**Independent Test**: Run `npm run test:db:reset` and confirm the seeded fixtures are restored; run `SEED_DATA=false npm run test:db:reset` and confirm the tables exist but contain no items. Repeat each mode and verify it produces the same state.

### Implementation for User Story 3

- [X] T018 [US3] Extend `local/dynamodb/test-db.sh` and `tests/e2e/global-setup.js` to pass through `SEED_DATA=true|false`, default to seeded data, and export a unique `TEST_RUN_ID` for each test run
- [X] T019 [P] [US3] Replace the stale initialization guidance in `local/dynamodb/README.md` with the `test-db.sh` startup, seeded/empty reset, and shutdown procedures
- [X] T020 [US3] Update `specs/002-local-dynamodb/quickstart.md` with the finalized commands, prerequisites, connection settings, seed-mode behavior, and verification steps for the measurable success criteria, including Draft submission search filters

**Checkpoint**: Developers can restore either supported test-data state manually, and suites honor the selected state.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate repeatability, failure visibility, and the documented testing workflow.

- [X] T021 Run the documented test sequence and verify ten consecutive clean integration runs return identical seeded species and Draft submission filter results, an unavailable database fails visibly, and the applicable new code meets the constitution's 90% coverage requirement; record evidence in the change review using `specs/002-local-dynamodb/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; image pinning can begin immediately.
- **Foundational (Phase 2)**: T003 depends on T002; T004 depends on T003. Complete this phase before the user-story phases.
- **User Stories (Phase 3+)**: US1 and US2 can proceed in parallel after the foundation. US3's automatic selected-mode behavior depends on both US1's integration command and US2's Playwright global setup.
- **Polish (Phase 6)**: Depends on the desired stories being complete.

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 only; no dependency on another story.
- **US2 (P2)**: Depends on Phase 2 only; no dependency on another story.
- **US3 (P3)**: Manual empty/seeded reset depends on Phase 2; applying the selected mode to both suites depends on US1 and US2.

### Within Each User Story

- US1: Existing species integration coverage and the backend npm script can be implemented in parallel. Draft fixtures and their documentation can also be implemented in parallel; backend `getSubmissions` and route wiring follow the fixture/schema decisions. T011 follows T006 because both edit `services/adts-backend/package.json`; T012 follows the fixture, route, and endpoint changes. The root wrapper follows the backend script, then CI invokes the completed command.
- US2: Global setup and documentation can be implemented in parallel; Playwright configuration follows global setup.
- US3: The reset-mode and global-setup changes follow their respective US1/US2 files; README and quickstart updates follow the documented command behavior.

### Parallel Opportunities

- T001 and T002 edit separate files and can proceed in parallel.
- After Phase 2, US1 and US2 can proceed in parallel.
- T005 and T006 are independent files; T007 and T008 are independent files; T011 can proceed alongside the backend data-access and route changes.
- T015 and T017 are independent files.
- Within US3, T018 and T019 can proceed in parallel; T020 should reflect the final command interface.

## Parallel Examples

### User Story 1

```text
Parallel after Phase 2:
- T005: Add the real local-DynamoDB integration coverage in services/adts-backend/tests/integration/dynamo.integration.test.js
- T006: Add the backend test:integration script in services/adts-backend/package.json
Parallel:
- T007: Seed synthetic Draft submissions in local/dynamodb/seed/adts-submissions.json
- T008: Document the Draft fixture fields in specs/002-local-dynamodb/data-model.md
Then complete T009 and T010, set the explicit local endpoint in T011, extend the integration assertions in T012, and complete T013 and T014.
```

### User Story 2

```text
Parallel after Phase 2:
- T015: Add Playwright global setup in tests/e2e/global-setup.js
- T017: Document local database behavior in tests/e2e/README.md
Then complete T016 after T015.
```

### User Story 3

```text
After the US1 and US2 command interfaces are available:
- T018: Add selected seed mode and TEST_RUN_ID handling to the harness and global setup
- T019: Update local/dynamodb/README.md with manual reset instructions
Then complete T020 with the final commands and run T021.
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2 to pin the images and provide a ready, deterministic database lifecycle.
2. Complete Phase 3 to run the backend's real integration test against local fixtures.
3. **Stop and validate**: run the backend integration command without AWS credentials and confirm seeded results and visible failure behavior.

### Incremental Delivery

1. Complete Setup and Foundational phases.
2. Deliver US1 as the MVP and verify it independently.
3. Deliver the Draft submission fixture-backed search checks as part of US1; non-Draft/LIMS coverage remains deferred until a local LIMS mock exists.
4. Deliver US2 to make E2E use the same local-only data source.
5. Deliver US3 to select and restore seeded or empty state.
6. Run the final repeatability and coverage validation.
