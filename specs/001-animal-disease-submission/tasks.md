# Tasks: Animal Disease Submission

**Input**: Design documents from `/specs/001-animal-disease-submission/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Organization**: Tasks are grouped by user story. Implementation tasks include the related automated test paths; separate test-first tasks are omitted because the feature specification does not request a TDD workflow.

## Phase 1: Setup — Resolve Implementation Inputs

**Purpose**: Establish the evidence and service-contract inputs needed to implement and validate the submission journey.

- [ ] T001 [P] Create and maintain a page-by-page field requirements catalogue in `specs/001-animal-disease-submission/data-model.md`, incrementally capturing each field's label, requiredness, validation, and source reference from the relevant Azure DevOps ticket, screenshot, or v1 code; mark uncertain or conflicting evidence as an open question rather than inventing a requirement.
- [ ] T002 [P] Confirm the deployed trusted-principal source and document how the UI/backend receive it in `specs/001-animal-disease-submission/contracts/backend-methods.md`.
- [ ] T003 [P] Confirm the LIMS create-submission path, payload, idempotency behavior, and document-reference response, then update `specs/001-animal-disease-submission/contracts/lims-submission-contract.yaml`.

## Phase 2: Foundational — Draft and Service Boundaries

**Purpose**: Implement shared prerequisites used by the submission and draft journeys. User-story implementation depends on these owner-safe backend and UI-to-backend boundaries.

- [ ] T004 Implement trusted-principal extraction and reject draft requests without an authenticated principal in `services/adts-backend/src/app.js` and `services/adts-backend/src/routes/drafts.js`; cover the guard in `services/adts-backend/tests/routes/drafts.test.js`.
- [ ] T005 [P] Implement backend-owned draft persistence for backend-generated `draftId`, trusted `ownerId`, allowlisted `lastSavedPage`, complete `formData`, lifecycle status, timestamps, and monotonic revision/conditional writes in `services/adts-backend/src/client/drafts.js`; cover ownership, revision conflicts, and storage errors in `services/adts-backend/tests/unit/drafts.test.js`.
- [ ] T006 Expose create/update, list, and owner-scoped get-draft operations through `services/adts-backend/src/routes/drafts.js` and register the routes in `services/adts-backend/src/app.js`; cover authorization, validation, not-found, and dependency failures in `services/adts-backend/tests/routes/drafts.test.js`.
- [ ] T007 [P] Implement typed UI wrappers for the documented draft and lookup backend methods in `services/adts-ui/src/client/all.js`; propagate non-success responses instead of returning empty success-shaped data and cover responses/errors in `services/adts-ui/tests/unit/client-all.test.js`.
- [ ] T008 Add shared submission page keys, complete-snapshot validation boundary, and stage ordering support in `services/adts-ui/src/routes/submission.js` and `services/adts-ui/src/app.js`; verify route registration and allowlisted page keys in `services/adts-ui/tests/unit/app.test.js`.

## Phase 3: User Story 1 — Submit an Animal Disease Report (Priority: P1) 🎯 MVP

**Goal**: Complete the eight-stage report with one species, one or more animals, at least one available test, delivery details, successful LIMS submission, and print-document access without taking payment.

**Independent Test**: Complete each required stage using valid approved report data, select at least one available test and provide a delivery address, then verify confirmed submission and document access; verify missing/invalid data, unavailable tests, empty basket, and downstream failures do not produce a false success.

### Implementation

- [X] T009 [P] Implement client selection and Step 1a client-details entry using the field requirements recorded for those pages in the living catalogue in `specs/001-animal-disease-submission/data-model.md`; support editing a selected client's name, farm, address, county, and postcode while preserving the selected client ID. Implement in `services/adts-ui/src/routes/selectClient.js`, `services/adts-ui/src/routes/createEditClient.js`, and their Nunjucks views under `services/adts-ui/src/views/`; cover existing-client lookup/selection, new-client form-state behavior, and selected-client edit pre-population and updates in `services/adts-ui/tests/routes/submission-client-details.test.js` and `services/adts-ui/tests/routes/create-client.test.js`.
- [ ] T010 [P] Implement animal details using the field requirements recorded for that page in the living catalogue in `specs/001-animal-disease-submission/data-model.md`; update the catalogue as each relevant ticket, screenshot, or v1 reference is reviewed, and resolve or explicitly track open questions before implementing affected fields. Implement in `services/adts-ui/src/routes/submissionAnimalDetails.js` and its Nunjucks view under `services/adts-ui/src/views/`; validate one species with one or more same-species animals and cover the route in `services/adts-ui/tests/routes/submission-animal-details.test.js`.
- [ ] T011 [P] Implement clinical-history details using the field requirements recorded for that page in the living catalogue in `specs/001-animal-disease-submission/data-model.md`; update the catalogue as each relevant ticket, screenshot, or v1 reference is reviewed, and resolve or explicitly track open questions before implementing affected fields. Implement in `services/adts-ui/src/routes/submissionClinicalHistory.js` and its Nunjucks view under `services/adts-ui/src/views/`; cover the route and its validation in `services/adts-ui/tests/routes/submission-clinical-history.test.js`.
- [ ] T012 [P] Implement test selection, basket, and delivery-address pages in `services/adts-ui/src/routes/submissionTests.js`, `services/adts-ui/src/routes/submissionBasket.js`, `services/adts-ui/src/routes/submissionDeliveryAddress.js`, and their Nunjucks views under `services/adts-ui/src/views/`; capture relevant page fields and their evidence in the living catalogue in `specs/001-animal-disease-submission/data-model.md`, require at least one currently available test and a valid delivery address, and cover validation/unavailable-kit behavior in `services/adts-ui/tests/routes/submission-order.test.js`.
- [ ] T013 Implement the idempotent LIMS `POST /submissions` adapter using the confirmed contract in `services/adts-submissions-service/src/routes/submissions.js` and register it in `services/adts-submissions-service/src/app.js`; pass the stable draft ID as the idempotency key, return confirmed document references, and cover created/retried/conflicting/failed requests in `services/adts-submissions-service/tests/routes/submissions.test.js`.
- [ ] T014 Implement backend completion orchestration and lifecycle transitions in `services/adts-backend/src/routes/submissions.js` and `services/adts-backend/src/client/drafts.js`; submit the complete report and required kit order through `adts-submissions-service`, preserve retry safety, and cover validation, conflicts, confirmed completion, and dependency failure in `services/adts-backend/tests/routes/submissions.test.js`.
- [ ] T015 Implement final submission handling and confirmation/print-document pages in `services/adts-ui/src/routes/submissionComplete.js` and `services/adts-ui/src/views/submissionComplete.njk`; show success only after confirmed completion, communicate retryable failure without claiming submission, and cover the journey in `tests/e2e/submissions/animal-disease-submission.spec.js`.

## Phase 4: User Story 2 — Navigate and Review the Form (Priority: P2)

**Goal**: Let users move through and correct the staged form while retaining entered information and seeing clear progress and a complete pre-submission review.

**Independent Test**: Enter answers across multiple pages, navigate backward and forward, inspect the review, return to a selected stage, and verify that all previously entered values remain and the review reflects corrections.

### Implementation

- [ ] T016 Implement validated forward/back navigation and preserve the complete current form snapshot between stages in `services/adts-ui/src/routes/submission.js` and the stage route modules under `services/adts-ui/src/routes/`; block skipped required stages and cover navigation/state retention in `services/adts-ui/tests/routes/submission-navigation.test.js`.
- [ ] T017 [P] Implement the review page with report, test basket, and delivery details plus links to correct each section in `services/adts-ui/src/routes/submissionReview.js` and `services/adts-ui/src/views/submissionReview.njk`; cover review completeness and correction navigation in `services/adts-ui/tests/routes/submission-review.test.js`.
- [ ] T018 Update the progress component and page-level headings, instructions, validation summaries, and next-action text for all report pages in `services/adts-ui/src/views/macros/submissionProgress.njk` and the submission Nunjucks views; verify keyboard-visible progress and error behavior in `tests/e2e/submissions/animal-disease-navigation.spec.js`.

## Phase 5: User Story 3 — Save and Return to a Draft (Priority: P2)

**Goal**: Allow users to save incomplete reports, find them later, and resume from their saved page with their last confirmed information.

**Independent Test**: Save a partially completed report, leave the UI session, open the draft in a new session, verify answers and saved progress are restored, edit and save again, and verify draft errors never appear as successful saves.

### Implementation

- [ ] T019 Add an explicit save-draft action that persists an incomplete full snapshot without enforcing submit-only required fields in `services/adts-ui/src/routes/submission.js` and the submission stage Nunjucks views; update Yar only after backend confirmation and cover save success/failure in `services/adts-ui/tests/routes/submission-drafts.test.js`.
- [ ] T020 [P] Implement a user's draft-list page and navigation entry in `services/adts-ui/src/routes/drafts.js` and `services/adts-ui/src/views/drafts.njk`; show actionable service errors rather than an empty list on lookup failure and cover the page in `services/adts-ui/tests/routes/drafts.test.js`.
- [ ] T021 Implement draft loading into a new UI session and redirect to the backend-provided allowlisted saved page in `services/adts-ui/src/routes/drafts.js`; restore the full snapshot/revision, prevent cross-owner access, and cover resume behavior in `services/adts-ui/tests/routes/drafts.test.js`.

## Final Phase: Polish and Cross-Cutting Validation

**Purpose**: Align operational guidance and verify the integrated implementation against the feature scenarios and constitutional quality requirements.

- [ ] T022 Update the service startup, environment, and journey instructions to match implemented endpoints and configuration in `specs/001-animal-disease-submission/quickstart.md`.
- [ ] T023 Run the UI, backend, submissions-service, and end-to-end suites and record the configured coverage result for the 90% new-code threshold or approved exception in the relevant change-review evidence; include `services/adts-ui/tests/`, `services/adts-backend/tests/`, `services/adts-submissions-service/tests/`, and `tests/e2e/submissions/`.

## Dependencies and Execution Order

### Phase Dependencies

- **Setup**: No code dependencies. T001–T003 may proceed in parallel. T001 establishes the field catalogue and continues as page evidence is reviewed; unresolved field questions gate only the affected fields, not unrelated implementation.
- **Foundational**: Depends on Setup. T004–T008 establish identity, owner-scoped draft operations, backend wrappers, and shared form boundaries; complete before user stories.
- **User Story 1 (P1)**: Depends on Foundational and confirmed field/LIMS contracts (T001 and T003).
- **User Story 2 (P2)**: Depends on Foundational and the stage routes from User Story 1 (T009–T012, T015); it can be developed after those routes exist.
- **User Story 3 (P2)**: Depends on Foundational and the stage routes from User Story 1 (T009–T012) so save/resume can restore real form state.
- **Polish**: Depends on all selected user stories being integrated.

### User Story Dependencies

- **US1** is the MVP and establishes the report and order pages plus confirmed submission.
- **US2** builds on US1 pages to provide complete navigation and review/correction behavior.
- **US3** builds on US1 pages and foundational draft APIs to provide explicit save, list, and resume behavior.
- After shared foundation and US1 stage routes are complete, US2 and US3 can proceed in parallel where they touch different files.

### Parallel Opportunities

- Setup tasks T001–T003 concern separate design inputs and can run in parallel. T001 is a living catalogue task: update it as field evidence is reviewed during page implementation.
- In the foundation, T005 draft persistence can proceed independently of T007 UI method wrappers; T006 follows T005, and T008 depends on the route conventions agreed for the UI.
- Within US1, T009 client, T010 animal, T011 clinical-history, and T012 test/order tasks use separate route/view/test files and can proceed in parallel once shared page keys are available; update the living field catalogue as evidence is reviewed for each page.
- US2 review/navigation work and US3 draft-list/resume work can proceed in parallel after the US1 stage route modules exist, coordinating shared edits to `services/adts-ui/src/routes/submission.js`.

### Parallel Example: User Story 1

```text
Task: T009 — client selection and Step 1a client-details pages and route tests
Task: T010 — animal-details page and route tests
Task: T011 — clinical-history page and route tests
Task: T012 — test selection, basket, and delivery-address pages and route tests
```

### Parallel Example: User Stories 2 and 3

```text
Task: T017 — review page and correction links
Task: T020 — draft list page and lookup-error handling
```

## Implementation Strategy

### MVP First

1. Complete Setup tasks T001–T003, including the identity and LIMS contract gates.
2. Complete the Foundational phase.
3. Complete US1 (T009–T015) and validate it independently against its acceptance criteria.
4. Deliver the minimum complete report-and-test submission journey before adding enhanced navigation/review and cross-session draft management.

### Incremental Delivery

1. Add US2 navigation and review/correction to the working submission journey.
2. Add US3 explicit incomplete-draft save, listing, and resume.
3. Complete cross-cutting quickstart, end-to-end, accessibility, and coverage validation.
