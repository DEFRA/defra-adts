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

- [X] T001 Add contract-test discovery and include `tests/contract` in the coverage command in `services/adts-submissions-service/package.json`.

---

## Phase 2: Foundational

**Purpose**: Establish shared configuration, authentication, transport, error handling, and test utilities. These capabilities are needed by protected user-story routes.

- [ ] T002 Confirm the private Backend-to-service HTTPS route, security-group/network policy restricted to the Backend workload, workload IAM roles for AWS resource permissions, LIMS secret injection/rotation, and health-probe policy. Record that no request-level SigV4 check or API Gateway is used in this release in `specs/003-submission-service/research.md` and `services/adts-submissions-service/README.md`. Record accountable risk acceptance and mitigations for both network-only caller trust and current production LIMS HTTP before release; no CA configuration is needed until LIMS enables HTTPS.
- [X] T003 Create reusable mocked-LIMS request/response and attempt-count helpers in `services/adts-submissions-service/tests/test-utils/lims.js`.
- [X] T004 [P] Add environment configuration tests for missing/invalid LIMS origin, prefix, timeout, credentials, and explicit HTTP-exception settings in `services/adts-submissions-service/tests/unit/config.test.js`.
- [X] T005 Implement validated environment configuration for LIMS origin/prefix, credentials, request deadline, and the explicit HTTP-exception flag in `services/adts-submissions-service/src/config.js`; leave platform identity configuration to T002/T007 once the hosting decision is supplied.
- [X] T006 [P] Superseded for initial scope: record that no per-request SigV4 check is performed and that network policy/security groups are the Backend access boundary in `specs/003-submission-service/spec.md`.
- [X] T007 Deferred to a future spec: do not add in-service SigV4 middleware in this release; record the possible future authentication extension in `specs/003-submission-service/research.md`.
- [X] T008 [P] Add LIMS transport tests for URL/prefix construction, authentication, timeout abort, explicit HTTP exception scoping, HTTPS certificate/hostname validation, redirect rejection, and single-attempt behavior in `services/adts-submissions-service/tests/unit/lims-client.test.js`.
- [X] T009 Implement the bounded, authenticated, single-attempt LIMS transport in `services/adts-submissions-service/src/clients/lims-client.js`; permit HTTP only for the configured LIMS origin while the FR-011 exception is active, and validate TLS whenever HTTPS is configured.
- [X] T010 [P] Add normalized-error and redaction tests for validation, authentication, business, upstream HTTP, timeout, transport, unavailable, and outcome-unknown categories in `services/adts-submissions-service/tests/unit/errors.test.js`.
- [X] T011 Implement stable error envelopes, safe allowlisted LIMS details, correlation IDs, and sensitive-data redaction in `services/adts-submissions-service/src/errors.js`.
- [X] T012 Register domain routes, health routes, configuration, and shared error handling in `services/adts-submissions-service/src/app.js` without forwarding arbitrary caller-supplied LIMS paths or health-check destinations; do not add request-level SigV4 checks in this release.

**Checkpoint**: Shared service boundaries are testable; operation schemas can be confirmed and implemented independently by story.

---

## Phase 3: User Story 1 - Find and retrieve LIMS records (Priority: P1)

**Goal**: Let the Backend search reference data and submission records and retrieve editable drafts, submitted records, and draft addresses through the domain API.

**Independent Test**: Against the mocked LIMS, exercise each verified read operation and filter, assert the mapped upstream path/parameters, preserve required identifiers/data, and verify normalized errors.

### Contract discovery and tests
- [X] T013 [US1] Record the observed product request contract (`filter` required, `species` optional, LIMS path `general/getProducts`) in `specs/003-submission-service/contracts/submission-service-api.yaml` and `specs/003-submission-service/research.md`; keep response records pass-through and their exact fields explicitly unconfirmed until authoritative LIMS evidence is available.
- [X] T014 [P] [US1] Add product-search contract and route tests for required `filter`, optional `species`, response mapping, validation, LIMS business errors, and unavailable LIMS in `services/adts-submissions-service/tests/contract/products-api.test.js`.
- [X] T015 [US1] Implement the observed product-search endpoint and LIMS mapping in `services/adts-submissions-service/src/routes/reference-data.js`; product response fields remain pass-through pending authoritative evidence.
- [X] T016 [US1] Record observed client/PVS request semantics (`general/getClients` with `pvsId` and `filter`; `general/getPVS` with `pvsId`) in `specs/003-submission-service/contracts/submission-service-api.yaml` and `specs/003-submission-service/data-model.md`; leave response fields pass-through and explicitly unconfirmed pending authoritative evidence.
- [X] T017 [P] [US1] Add client-search and practice/PVS-retrieval contract tests, including PVS validation, LIMS rejection, and unavailable responses, in `services/adts-submissions-service/tests/contract/clients-api.test.js`.
- [X] T018 [US1] Implement observed client search and practice/PVS retrieval paths with pass-through response records in `services/adts-submissions-service/src/routes/reference-data.js`; response field schemas remain open pending authoritative LIMS evidence.
- [X] T019 [US1] Record observed submission-ID/search/view/address request mappings from the LIMS reference in `specs/003-submission-service/contracts/submission-service-api.yaml` and `specs/003-submission-service/research.md` (`pvsid`, `submissionId`, `isDraft`, and `submissionDraftId`); keep response records pass-through and their exact fields unconfirmed until authoritative evidence is available.
- [X] T020 [P] [US1] Add contract tests for submission-ID search, filtered submission search, draft retrieval, submitted-record view, and draft-address retrieval in `services/adts-submissions-service/tests/contract/submissions-read-api.test.js`.
- [X] T021 [US1] Implement observed submission search/retrieval and draft-address routes with explicit legacy parameter mapping and pass-through response records in `services/adts-submissions-service/src/routes/submissions-read.js` using shared forwarding in `services/adts-submissions-service/src/routes/reference-data.js`; response field schemas remain open pending authoritative evidence.


- [ ] T022 [US1] Extend the existing Backend adapter to versioned Submission Service endpoints and preserve local DynamoDB draft search in `services/adts-backend/src/app.js` and `services/adts-backend/tests/routes/submissions-proxy.test.js`. The non-PVS `/v1/products` proxy is implemented; complete PVS-scoped client/submission adapters only after their authorized PVS context is defined. Do not trust an unverified browser-supplied `pvsId`.

**Checkpoint**: User Story 1 works independently for all schema-verified read operations; unverified read operations remain explicitly blocked rather than guessed.

---

## Phase 4: User Story 2 - Save, confirm, or cancel a submission (Priority: P1)

**Goal**: Create/update LIMS drafts, confirm drafts, and request cancellation while returning accurate identifiers and outcomes without unsafe retries.

**Independent Test**: Use mocked LIMS success, business rejection, timeout, transport failure, and lost-response scenarios; assert one upstream attempt for ambiguous mutations and no false success.

### Draft contract discovery and tests

- [X] T023 [US2] Record the release 12.1.6 legacy draft serializer's exact 52-key shape, caller population rules, and nested `products[]` structure in `specs/003-submission-service/contracts/submission-service-api.yaml`, `specs/003-submission-service/data-model.md`, and `specs/003-submission-service/research.md`; retain LIMS-only validation/idempotency questions as open.
- [X] T024 [P] [US2] Add draft create/update contract tests for all 52 required serialized keys, nested product/sample mapping, rejected input, returned draft ID, missing-ID outcome, timeout, and one attempt after an ambiguous create in `services/adts-submissions-service/tests/contract/drafts-api.test.js`.
- [X] T025 [US2] Implement LIMS draft create/update in `services/adts-submissions-service/src/routes/drafts.js`; return the domain draft ID only when LIMS confirms it and report ambiguous outcomes without retrying.

### Confirmation and cancellation discovery and tests

- [X] T026 [US2] Record release 12.1.6 confirmation (`draftSubmissionId`, `pvsId` -> `submissionId`) and cancellation (`pvsId`, `submissionDraftId`, `clinician` -> `hasErrors`, `errorMessages`) wire shapes in `specs/003-submission-service/contracts/submission-service-api.yaml` and `specs/003-submission-service/research.md`; retain LIMS idempotency, rejection status, and cancellation-state questions as unknown.
- [X] T027 [P] [US2] Add confirmation/cancellation tests for the observed request/response shapes, LIMS business rejection, missing confirmation ID, timeout, lost response, and exactly one upstream attempt in `services/adts-submissions-service/tests/contract/submission-actions-api.test.js`.
- [X] T028 [US2] Implement draft confirmation and map a submission ID only after confirmed LIMS success in `services/adts-submissions-service/src/routes/submission-actions.js`.
- [X] T029 [US2] Implement cancellation with accurate business-level rejection and indeterminate-outcome handling in `services/adts-submissions-service/src/routes/submission-actions.js`.
- [ ] T030 [US2] Add Backend adapters for draft save/update, confirmation, and cancellation over the configured private HTTPS route; do not automatically resubmit unknown outcomes in `services/adts-backend/src/app.js` and `services/adts-backend/tests/routes/submission-actions-proxy.test.js`.

**Checkpoint**: User Story 2 reports confirmed IDs only on evidence, preserves business errors, and never automatically repeats an ambiguous create, confirmation, or cancellation.

---

## Phase 5: User Story 4 - Operate and diagnose the integration (Priority: P1)

**Goal**: Keep process health, readiness, LIMS connectivity, and safe diagnostics independently observable.

**Independent Test**: Run the service with LIMS available and unavailable; verify process health/readiness separately, LIMS probe status, error categories, and that logs/response bodies contain no credentials or sensitive payloads.

- [X] T031 [P] [US4] Add health/readiness tests proving `/health` is process-only, `/ready` does not depend on LIMS, and the configured LIMS probe reports dependency failure separately in `services/adts-submissions-service/tests/routes/health.test.js`.
- [X] T032 [US4] Implement process health, configuration readiness, and configured LIMS connectivity routes with bounded timeout and no caller-supplied destination in `services/adts-submissions-service/src/routes/health.js` and `services/adts-submissions-service/src/app.js`.
- [X] T033 [P] [US4] Add route tests for invalid input, LIMS credential rejection, upstream HTTP errors, timeouts, transport failures, and unavailable LIMS in `services/adts-submissions-service/tests/routes/upstream-errors.test.js`; request-level Backend authentication is outside this release.
- [X] T034 [US4] Add structured correlation-aware operational logging that excludes credentials, authorization headers, and sensitive request/response bodies in `services/adts-submissions-service/src/observability.js` and `services/adts-submissions-service/tests/unit/observability.test.js`.
- [X] T035 [US4] Document the private HTTPS route and security-group boundary, the absence of request-level authentication in this release, IAM roles for AWS resource permissions, LIMS secret injection/rotation, the temporary production HTTP exception and risk acceptance, HTTPS CA trust when enabled, health probes, configuration, and reconciliation operations in `services/adts-submissions-service/README.md`.
- [X] T036 [US4] Add cross-service integration coverage proving the Backend calls only the configured Submission Service URL, sends no LIMS credentials, and the service alone invokes the LIMS client in `services/adts-backend/tests/integration/submissions-service.integration.test.js`; local tests use loopback HTTP, while production must use the private HTTPS route.

**Checkpoint**: Operators can distinguish service and dependency health; Backend identity and safe failure diagnostics are verified end to end.

---

## Phase 6: User Story 3 - Retrieve results and reports (Priority: P2)

**Goal**: Return latest released results, charges, release summaries, and report content with verified fields and media types.

**Independent Test**: Use representative verified LIMS responses, including structured and binary content where applicable, and assert content, media type, identifiers, empty/unavailable distinctions, and normalized errors.

- [X] T037 [US3] Record source-derived `getLatestReleasedResults` summary fields and `getReleaseSummaryAndReport` JSON/base64 `LastReportString` behavior in `specs/003-submission-service/contracts/submission-service-api.yaml`, `specs/003-submission-service/data-model.md`, and `specs/003-submission-service/research.md`; retain LIMS-only size/empty/error semantics as unknown.
- [X] T038 [P] [US3] Add contract tests for latest results/charges and distinguish empty, unreleased, and unavailable data in `services/adts-submissions-service/tests/contract/results-api.test.js`.
- [X] T039 [US3] Implement observed latest released results and charges using pass-through JSON in `services/adts-submissions-service/src/routes/results.js`; exact result fields remain open pending authoritative evidence.
- [X] T040 [P] [US3] Add tests for release-summary/report success, media type/content preservation, empty content, unavailable reports, and safe upstream errors in `services/adts-submissions-service/tests/contract/reports-api.test.js`.
- [X] T041 [US3] Implement source-derived release-summary JSON and base64 PDF decoding in `services/adts-submissions-service/src/routes/reports.js`; preserve inline `application/pdf` behavior without a filename header.
- [ ] T042 [US3] Add Backend adapters and tests for results, release summaries, and report retrieval without adding UI changes in `services/adts-backend/src/app.js` and `services/adts-backend/tests/routes/results-proxy.test.js`.

**Checkpoint**: User Story 3 returns the verified released data and report representations without confusing unavailable content with success.

---

## Phase 7: Polish and Cross-Cutting Validation

**Purpose**: Complete cross-story quality gates and verify the documented validation workflow.

- [X] T043 [P] Update `services/adts-submissions-service/README.md` and `specs/003-submission-service/quickstart.md` with source-derived operation schemas, configuration names, test commands, and remaining LIMS/platform release gates.
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

- In Phase 2, configuration, transport, and error tests can be prepared in parallel after the common test helper. No application-level SigV4 middleware is part of this release.
- In US1, product/client/PVS/submission contract tests (T014, T017, T020) can be authored in parallel after their respective discovery tasks. Product and client/PVS implementation share `reference-data.js` and should be serialized; submission reads use a separate route module.
- In US2, draft and confirmation/cancellation tests (T024, T027) can be authored in parallel after both discovery tasks; implementation should be coordinated where routes share files.
- In US4, health tests (T031) and auth/error tests (T033) can be prepared in parallel after the shared middleware exists.
- In US3, result/charge tests (T038) and report/media tests (T040) can be authored in parallel after T037; implementation integration is coordinated where shared LIMS response helpers are changed.
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
