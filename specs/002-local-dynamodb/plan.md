# Implementation Plan: Local DynamoDB for Integration and E2E Testing

**Branch**: `002-local-dynamodb` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-local-dynamodb/spec.md`

## Summary

Provide a local DynamoDB Local instance, started from Docker Compose, that mirrors the three ADTS tables the backend queries (`adts-reference-data`, `adts-submissions`, `adts-ci-lims-mapping`) with synthetic seed data. Integration and E2E test commands start the container, wait for it to be healthy, reset the tables to a known state (seeded or empty), and then run the tests against `http://localhost:8000`. Most of the local setup already exists in `local/dynamodb/`. The remaining work is a reset path, a shared test-DB script, pinned image tags, a backend integration test layer, Playwright wiring so E2E uses the local endpoint, and CI updates. Decisions are in [research.md](./research.md).

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: JavaScript (ESM) on Node.js 24; POSIX `sh` for the local harness scripts

**Primary Dependencies**: Hapi 21 (`adts-backend`), AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`), Playwright 1.63 (E2E), Jest 30 (backend tests), Docker Compose with `amazon/dynamodb-local` and `amazon/aws-cli` (pinned versions)

**Storage**: DynamoDB Local (in-memory-compatible, persisted to a Docker volume with `-sharedDb -dbPath /data`). No hosted AWS resources.

**Testing**: Jest for backend unit and integration tests (`tests/unit`, `tests/integration`, `tests/routes`); Playwright for E2E (`tests/e2e`). Integration and E2E run against the local DynamoDB endpoint.

**Target Platform**: Developer workstations (macOS, Linux, Windows with Docker Desktop) and GitHub Actions `ubuntu-latest` runners

**Project Type**: Multi-service monorepo (web application with a Hapi backend and a separate submissions service, plus test infrastructure)

**Performance Goals**: Local DB ready and seeded within 5 minutes for a first-time setup (SC-001). Reset and readiness adds only seconds to a test run, since there are three tables and 12 seed items.

**Constraints**: No hosted AWS credentials or endpoints in dev or CI (FR-004, SC-002). Local DB endpoint must not be inherited from ambient AWS config (FR-005). Failures must be visible, never returned as empty results (FR-009). Local configuration must not affect production images (FR-010). Seed data is synthetic only.

**Scale/Scope**: 3 tables, 3 GSIs on reference data and 2 on submissions, 12 seed items, 1 backend service under test that reads the reference table. Existing species route `GET /GetSpecies` is the only data-reading route in the backend today.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Gates from the constitution (v1.2.0):

| Principle | Gate | Pre-design result | Notes |
|-----------|------|-------------------|-------|
| Testing order | Unit, then integration, then E2E; new code covered at ≥90% | PASS (with action) | Adds a backend integration layer (`tests/integration/*.test.js`) between the existing unit/route tests and E2E. Coverage evidence for new code goes in the change review. |
| Independent deployability | Services deploy independently and talk through explicit interfaces | PASS | The backend reaches DynamoDB only through its existing `dynamo.js` client. The local DB is test infrastructure only and is not a runtime dependency of any deployable service. No new coupling between backend and UI. |
| Privacy and security by design | Least privilege, minimal data, synthetic test data | PASS | Dummy credentials for local DynamoDB only. Seed data is synthetic (for example `USER-123`, `LIMS-456789`). Endpoint guard prevents hosted access (see [research.md](./research.md) §3). |
| Reproducibility | Test runs are repeatable | PASS (with action) | Requires pinning image tags (currently `:latest`) and resetting to a known state before each run (research §1, §6). |
| Change review evidence | Compliance is shown in the change review | PASS | Verification steps are recorded in [quickstart.md](./quickstart.md). |

Initial result: no unjustified violations. Actions are tracked in research.md and carried into tasks.

## Project Structure

### Documentation (this feature)

```text
specs/002-local-dynamodb/
├── spec.md              # Feature specification (with clarifications)
├── plan.md              # This file
├── research.md          # Phase 0: decisions and alternatives
├── data-model.md        # Phase 1: tables, keys, indexes, fixture entities
├── quickstart.md        # Phase 1: how to run and verify the local DB and tests
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Created by /speckit-tasks (not part of this plan)
```

**Contracts**: No `contracts/` directory is produced. The local DynamoDB exposes the AWS DynamoDB API, which is an external standard and is not defined by this project. The only project-owned interface affected is `GET /GetSpecies`, which is unchanged. Test-DB commands are documented in [quickstart.md](./quickstart.md).

### Source Code (repository root)

```text
local/dynamodb/                          # Local DynamoDB harness (exists; extended)
├── docker-compose.yml                   # dynamodb + init services; pin image tags
├── init.sh                              # create tables, seed; add RESET mode
├── test-db.sh                           # NEW: up | reset | down for tests and devs
├── tables/*.json                        # table definitions (exists)
├── seed/*.json                          # synthetic fixtures (exists)
└── README.md                            # update reset guidance

services/adts-backend/
├── src/data/dynamo.js                   # client factory (exists; no change expected)
├── src/data/species.js                  # reference-data query (exists)
├── package.json                         # add test:integration script
└── tests/
    ├── routes/species.test.js           # mocked unit/route tests (exists)
    └── integration/
        └── dynamo.integration.test.js   # NEW: real SDK calls against local DynamoDB

tests/e2e/
├── global-setup.js                      # NEW: test-db up + reset before Playwright run
└── README.md                            # document DB prerequisite and reset

playwright.config.js                     # globalSetup; backend env for local DynamoDB; no backend reuse
package.json                             # add test:db:* and test:integration wrappers

.github/workflows/
├── _validation.yml                      # integration test command with DB up and reset
├── _e2e-tests.yml                       # path filter for local/dynamodb/**
└── adts-services_build.yml              # pass integration test command to validation job

docs/test-database.md                    # source of truth for data model (exists)
```

**Structure Decision**: Extend the existing `local/dynamodb/` harness rather than creating a new package. Test infrastructure stays at the repository root and in `tests/e2e/`, and integration tests go beside the backend's existing `tests/` folders. No new service is introduced, so the constitution's independent-deployability rule is unaffected. The backend's data layer under `services/adts-backend/src/data/` is not changed in behaviour.

## Post-Design Constitution Check

Re-checked after research.md, data-model.md, and quickstart.md were written.

| Principle | Result | Evidence |
|-----------|--------|----------|
| Testing order | PASS | Integration layer defined in [research.md](./research.md) §2 and §5. Coverage for new code is required in the change review. |
| Independent deployability | PASS | No runtime change to any deployable service. DynamoDB access is unchanged. |
| Privacy and security by design | PASS | Local-only endpoint guard (research §3). Synthetic seed in [data-model.md](./data-model.md). |
| Reproducibility | PASS | Pinned image tags and reset-before-run (research §1, §6). |
| Change review evidence | PASS | Verification steps in [quickstart.md](./quickstart.md). |

Post-design result: no violations.

## Complexity Tracking

No constitution violations need justification.
