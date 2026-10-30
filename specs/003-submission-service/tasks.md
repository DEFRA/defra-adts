---
description: "Implementation tasks for the ADTS Submission Service"
---

# Tasks: ADTS Submission Service

**Input**: Design documents from `specs/003-submission-service/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/submission-service-api.yaml`, `quickstart.md`

**Tests**: Required by FR-015 and the project constitution. Add focused tests before implementation in each story. Run unit, integration, then affected end-to-end tests. New code must meet at least 90% coverage.

**Organization**: Tasks are grouped by user story. LIMS contract discovery is incremental: verify each operation's request/response semantics before implementing that operation, without blocking independent scaffolding or already-verified operations.

## Phase 1: Setup

**Purpose**: Prepare service-owned test and coverage tooling.

- [ ] T001 Add contract-test discovery and include `tests/contract` in the coverage command in `services/adts-submissions-service/package.json`.

---

## Phase 2: Foundational

**Purpose**: Establish shared configuration, authentication, transport, error handling, and test utilities. These capabilities are needed by protected user-story routes.

- [ ] T002 Confirm the approved runtime caller identity, token audience/claims or mTLS identity, LIMS secret injection/rotation, CA trust, and health-probe policy with the platform owner; record the decision and unresolved deployment wiring in `specs/003-submission-service/research.md` and `services/adts-submissions-service/README.md`.
- [ ] T003 Create reusable mocked-LIMS request/response and attempt-count helpers in `services/adts-submissions-service/tests/test-utils/lims.js`.
- [ ] T004 [P] Add environment configuration tests for missing/invalid LIMS origin, prefix, timeout, credentials, and caller-auth settings in `services/adts-submissions-service/tests/unit/config.test.js`.
- [ ] T005 Implement validated environment configuration for LIMS origin/prefix, credentials, request deadline, and platform identity settings in `services/adts-submissions-service/src/config.js`.
- [ ] T006 [P] Add caller-authentication tests for missing identity, invalid identity, wrong audience, and approved Backend identity in `services/adts-submissions-service/tests/unit/backend-auth.test.js`.
- [ ] T007 Implement protected-route Backend identity verification using the platform decision from T002 in `services/adts-submissions-service/src/auth/backend-auth.js`.
- [ ] T008 [P] Add LIMS transport tests for URL/prefix construction, authentication, timeout abort, verified TLS configuration, and single-attempt behavior in `services/adts-submissions-service/tests/unit/lims-client.test.js`.
- [ ] T009 Implement the bounded, authenticated, TLS-validating, no-automatic-retry LIMS transport in `services/adts-submissions-service/src/clients/lims-client.js`.
- [ ] T010 [P] Add normalized-error and redaction tests for validation, authentication, business, upstream HTTP, timeout, transport, unavailable, and outcome-unknown categories in `services/adts-submissions-service/tests/unit/errors.test.js`.
- [ ] T011 Implement stable error envelopes, safe allowlisted LIMS details, correlation IDs, and sensitive-data redaction in `services/adts-submissions-service/src/errors.js`.
- [ ] T012 Register configuration, protected routes, health routes, and shared error handling in `services/adts-submissions-service/src/app.js` without forwarding arbitrary caller-supplied LIMS paths or health-check destinations.

**Checkpoint**: Shared service boundaries are testable; operation schemas can be confirmed and implemented independently by story.

---

## Phase 3: User Story 1 - Find and retrieve LIMS records (Priority: P1)

**Goal**: Let the Backend search reference data and submission records and retrieve editable drafts, submitted records, and draft addresses through the domain API.

**Independent Test**: Against the mocked LIMS, exercise each verified read operation and filter, assert the mapped upstream path/parameters, preserve required identifiers/data, and verify normalized errors.

### Contract discovery and tests

- [ ] T013 [US1] Confirm product search fields, filters, and response mapping from the legacy callers and authoritative LIMS contract; update `specs/003-submission-service/contracts/submission-service-api.yaml` and `specs/003-submission-service/data-model.md` before implementing product search.
- [ ] T014 [P] [US1] Add product-search contract and route tests for required `filter`, optional `species`, response mapping, validation, LIMS business errors, and unavailable LIMS in `services/adts-submissions-service/tests/contract/products-api.test.js`.
- [ ] T015 [US1] Implement the verified product-search endpoint and LIMS mapping in `services/adts-submissions-service/src/routes/reference-data.js` and `services/adts-submissions-service/src/clients/lims-mapping.js`.
- [ ] T016 [US1] Confirm client/PVS fields, PVS scoping, filters, and response schemas from legacy callers and authoritative LIMS evidence; update `specs/003-submission-service/contracts/submission-service-api.yaml` and `specs/003-submission-service/data-model.md` before implementing these operations.
- [ ] T017 [P] [US1] Add client-search and practice/PVS-retrieval contract tests, including authenticated access, invalid identifiers, LIMS rejection, and unavailable responses, in `services/adts-submissions-service/tests/contract/clients-api.test.js`.
- [ ] T018 [US1] Implement verified client search and practice/PVS retrieval routes and mappings in `services/adts-submissions-service/src/routes/reference-data.js` and `services/adts-submissions-service/src/clients/lims-mapping.js`.
- [ ] T019 [US1] Confirm submission-ID search, supported record filters, editable-draft retrieval, submitted-record viewing, and delivery/sample-address schemas from legacy callers and authoritative LIMS evidence; update `specs/003-submission-service/contracts/submission-service-api.yaml` and `specs/003-submission-service/data-model.md` before implementing each affected read operation.
- [ ] T020 [P] [US1] Add contract tests for submission-ID search, filtered submission search, draft retrieval, submitted-record view, and draft-address retrieval in `services/adts-submissions-service/tests/contract/submissions-read-api.test.js`.
- [ ] T021 [US1] Implement the verified submission search/retrieval and draft-address routes with explicit legacy parameter mapping in `services/adts-submissions-service/src/routes/submissions-read.js` and `services/adts-submissions-service/src/clients/lims-mapping.js`.

### Backend adapter

- [ ] T022 [US1] Adapt existing Backend client and submission-search proxies to call the versioned domain endpoints, pass the approved Backend identity, preserve local DynamoDB draft search, and update proxy tests in `services/adts-backend/src/app.js` and `services/adts-backend/tests/routes/submissions-proxy.test.js`.

**Checkpoint**: User Story 1 works independently for all schema-verified read operations; unverified read operations remain explicitly blocked rather than guessed.

---

## Phase 4: User Story 2 - Save, confirm, or cancel a submission (Priority: P1)

**Goal**: Create/update LIMS drafts, confirm drafts, and request cancellation while returning accurate identifiers and outcomes without unsafe retries.

**Independent Test**: Use mocked LIMS success, business rejection, timeout, transport failure, and lost-response scenarios; assert one upstream attempt for ambiguous mutations and no false success.

### Draft contract discovery and tests

- [ ] T023 [US2] Locate the complete legacy `Submission` model and draft-save callers; verify create/update fields and validation against authoritative LIMS evidence; update `specs/003-submission-service/contracts/submission-service-api.yaml`, `specs/003-submission-service/data-model.md`, and `specs/003-submission-service/research.md` before implementing draft save.
- [ ] T024 [P] [US2] Add draft create/update contract tests for complete verified payload mapping, rejected input, returned draft ID, timeout, and no retry after an ambiguous create in `services/adts-submissions-service/tests/contract/drafts-api.test.js`.
- [ ] T025 [US2] Implement verified LIMS draft create/update operations and return the draft ID only when confirmed in `services/adts-submissions-service/src/routes/drafts.js` and `services/adts-submissions-service/src/clients/lims-mapping.js`.

### Confirmation and cancellation discovery and tests

- [ ] T026 [US2] Verify confirmation and cancellation request/response fields, business rejection semantics, and available reconciliation lookup against legacy callers and authoritative LIMS evidence; document the no-automatic-retry policy and update `specs/003-submission-service/contracts/submission-service-api.yaml` and `specs/003-submission-service/research.md` before implementing these operations.
- [ ] T027 [P] [US2] Add confirmation/cancellation tests for successful IDs, `hasErrors`/`errorMessages` business rejection, timeout, lost response, and exactly one upstream attempt in `services/adts-submissions-service/tests/contract/submission-actions-api.test.js`.
- [ ] T028 [US2] Implement draft confirmation and map a submission ID only after confirmed LIMS success in `services/adts-submissions-service/src/routes/submission-actions.js` and `services/adts-submissions-service/src/clients/lims-mapping.js`.
- [ ] T029 [US2] Implement cancellation with accurate business-level rejection and indeterminate-outcome handling in `services/adts-submissions-service/src/routes/submission-actions.js` and `services/adts-submissions-service/src/clients/lims-mapping.js`.
- [ ] T030 [US2] Add Backend adapters for draft save/update, confirmation, and cancellation that propagate authenticated caller identity and do not automatically resubmit unknown outcomes in `services/adts-backend/src/app.js` and `services/adts-backend/tests/routes/submission-actions-proxy.test.js`.

**Checkpoint**: User Story 2 reports confirmed IDs only on evidence, preserves business errors, and never automatically repeats an ambiguous create, confirmation, or cancellation.

---

## Phase 5: User Story 4 - Operate and diagnose the integration (Priority: P1)

**Goal**: Keep process health, readiness, LIMS connectivity, and safe diagnostics independently observable.

**Independent Test**: Run the service with LIMS available and unavailable; verify process health/readiness separately, LIMS probe status, error categories, and that logs/response bodies contain no credentials or sensitive payloads.

- [ ] T031 [P] [US4] Add health/readiness tests proving `/health` is process-only, `/ready` does not depend on LIMS, and the configured LIMS probe reports dependency failure separately in `services/adts-submissions-service/tests/routes/health.test.js`.
- [ ] T032 [US4] Implement process health, configuration readiness, and configured LIMS connectivity routes with bounded timeout and no caller-supplied destination in `services/adts-submissions-service/src/routes/health.js` and `services/adts-submissions-service/src/app.js`.
- [ ] T033 [P] [US4] Add route tests for unauthenticated/invalid callers, business-level LIMS errors, credential rejection, upstream HTTP errors, timeouts, transport failures, and unavailable LIMS in `services/adts-submissions-service/tests/routes/errors-and-auth.test.js`.
- [ ] T034 [US4] Add structured correlation-aware operational logging that excludes credentials, authorization headers, and sensitive request/response bodies in `services/adts-submissions-service/src/observability.js` and `services/adts-submissions-service/tests/unit/observability.test.js`.
- [ ] T035 [US4] Document required runtime identity, LIMS secret injection/rotation, CA trust, health probes, configuration, and reconciliation operations in `services/adts-submissions-service/README.md`.
- [ ] T036 [US4] Add cross-service integration coverage proving the Backend authenticates to the Submission Service and only the Submission Service is configured to contact LIMS in `services/adts-backend/tests/integration/submissions-service.integration.test.js`.

**Checkpoint**: Operators can distinguish service and dependency health; Backend identity and safe failure diagnostics are verified end to end.

---

## Phase 6: User Story 3 - Retrieve results and reports (Priority: P2)

**Goal**: Return latest released results, charges, release summaries, and report content with verified fields and media types.

**Independent Test**: Use representative verified LIMS responses, including structured and binary content where applicable, and assert content, media type, identifiers, empty/unavailable distinctions, and normalized errors.

- [ ] T037 [US3] Confirm latest-result and charge fields, release-summary schema, report/attachment media types, and unavailable/empty semantics from current callers and authoritative LIMS evidence; update `specs/003-submission-service/contracts/submission-service-api.yaml` and `specs/003-submission-service/data-model.md` before implementing each affected operation.
- [ ] T038 [P] [US3] Add contract tests for latest results/charges and distinguish empty, unreleased, and unavailable data in `services/adts-submissions-service/tests/contract/results-api.test.js`.
- [ ] T039 [US3] Implement verified latest released results and charges in `services/adts-submissions-service/src/routes/results.js` and `services/adts-submissions-service/src/clients/lims-mapping.js`.
- [ ] T040 [P] [US3] Add tests for release-summary/report success, media type/content preservation, empty content, unavailable reports, and safe upstream errors in `services/adts-submissions-service/tests/contract/reports-api.test.js`.
- [ ] T041 [US3] Implement verified release-summary and report responses while preserving upstream content type and bytes in `services/adts-submissions-service/src/routes/reports.js` and `services/adts-submissions-service/src/clients/lims-mapping.js`.
- [ ] T042 [US3] Add Backend adapters and tests for results, release summaries, and report retrieval without adding UI changes in `services/adts-backend/src/app.js` and `services/adts-backend/tests/routes/results-proxy.test.js`.

**Checkpoint**: User Story 3 returns the verified released data and report representations without confusing unavailable content with success.

---

## Phase 7: Polish and Cross-Cutting Validation

**Purpose**: Complete cross-story quality gates and verify the documented validation workflow.

- [ ] T043 [P] Update `services/adts-submissions-service/README.md` and `specs/003-submission-service/quickstart.md` with final verified operation schemas, configuration names, test commands, and any remaining release gates.
- [ ] T044 Run service lint, unit, integration, contract, and affected E2E tests in constitution order; achieve at least 90% coverage for new code and record results in `specs/003-submission-service/quickstart.md`.
- [ ] T045 Run the completed quickstart from a clean local environment and record expected outcomes and any platform-only validation that remains in `specs/003-submission-service/quickstart.md`.

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; update service test/coverage discovery.
- **Foundational (Phase 2)**: Depends on Setup. Auth, configuration, outbound transport, errors, and test helpers block protected user-story routes.
- **User stories (Phases 3-6)**: Depend on shared foundation. For each operation, its contract-discovery task must complete before its contract tests and implementation. Other operations with verified contracts can proceed independently.
- **Polish (Phase 7)**: Depends on all selected stories and platform release gates being assessed.

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2; read-operation contract discovery and implementation are grouped into independently verifiable product/client/PVS and submission/read/address slices.
- **US2 (P1)**: Starts after Phase 2; draft schema discovery precedes draft mutation, while confirmation/cancellation contract discovery precedes their implementation. Backend-local drafts remain distinct.
- **US4 (P1)**: Starts after Phase 2; health and operational checks can be validated independently of domain operations, while cross-service auth verification uses the Backend adapters from US1/US2/US3 when available.
- **US3 (P2)**: Starts after Phase 2; results and report schemas are confirmed incrementally before their respective implementations. Backend adapters can follow service routes.
- Stories may be staffed in parallel after Phase 2, subject to each operation's schema task and shared-file conflicts.

### Within Each User Story

- Confirm the operation contract first; do not infer missing LIMS fields from examples.
- Add contract/route tests before operation implementation and verify the expected failure first.
- Implement the LIMS mapping and service route, then the Backend adapter where required.
- Keep each operation's test and implementation in separate files where feasible to enable parallel work.
- Do not automatically retry ambiguous create, confirm, or cancel operations.

## Parallel Opportunities

- In Phase 2, configuration, auth, transport, and error tests can be prepared in parallel after the common test helper; their implementation follows the platform decision and each test.
- In US1, product/client/PVS/submission contract tests (T014, T017, T020) can be authored in parallel after their respective discovery tasks; route and mapping implementation is serialized where tasks share `lims-mapping.js`.
- In US2, draft and confirmation/cancellation tests (T024, T027) can be authored in parallel after both discovery tasks; route/mapping implementation is serialized where files are shared.
- In US4, health tests (T031) and auth/error tests (T033) can be prepared in parallel after the shared middleware exists.
- In US3, result/charge tests (T038) and report/media tests (T040) can be authored in parallel after T037; implementation integration is coordinated because both use `lims-mapping.js`.
- Different user stories can proceed in parallel after foundational tasks if each operation's contract is verified and shared-file changes are coordinated.

## Parallel Example: User Story 1

After the relevant schema-discovery tasks are complete, separate contributors can author the independent contract-test files in parallel:

```text
Workstream A: T014 (product-search contract/route tests)
Workstream B: T017 (client/PVS contract tests)
Workstream C: T020 (submission-read/address contract tests)
Then integrate route/mapping implementation in T015, T018, and T021, followed by Backend adapter T022.
```

## Implementation Strategy

### MVP First

Deliver User Story 1 as the first functional increment after the shared foundation: verified product/client/PVS lookup and submission read operations, with Backend adapters and independent tests. Ship only operations whose schemas have been confirmed; do not claim unverified operations are complete.

### Incremental Delivery

1. Complete setup and shared foundation.
2. Deliver verified US1 read capabilities and validate independently.
3. Deliver US2 draft/create/update/confirm/cancel slices as their contracts are confirmed.
4. Deliver US4 health, error, and integration evidence (some shared foundation is already present).
5. Deliver US3 results and report slices as media and response contracts are confirmed.
6. Run cross-story coverage, E2E, and release-gate checks.

### Format Validation

All task entries use `- [ ] Tnnn`, optional `[P]`, the required `[USn]` label in story phases, a concrete action, and at least one repository file path. IDs are sequential and tasks are listed in dependency order.
