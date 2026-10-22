# Implementation Plan: Animal Disease Submission

**Branch**: `feature/specify-submissions` | **Date**: 2026-10-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification and implementation notes describing Nunjucks pages in the existing HAPI UI, session-state use through Yar, per-step calls to backend methods, draft resumption, and later provision of the exact form fields.

## Summary

Deliver the eight-stage animal disease report as progressively enhanced Nunjucks pages in the existing HAPI UI. Keep Yar as a short-lived session working copy and call backend methods for client lookup, draft creation/update, and draft retrieval. The UI treats the backend as the persistence boundary and does not know or configure its storage technology. The backend owns durable drafts, currently in DynamoDB. On final submission, the backend sends the completed report and mandatory test-kit order through the submissions service to LIMS. Payment is not part of this journey.

The form field catalogue is intentionally deferred until task refinement; use a validated `formData` boundary that can accommodate the confirmed ADTS/APHA fields without inventing them in this plan.

## Technical Context

**Language/Version**: JavaScript, Node.js 24.21.0 (current service container base).

**Primary Dependencies**: UI: Hapi 21.4.10, Vision 7.0.3, Inert 7.1.2, Yar 11.0.3, Nunjucks 3.2.4, GOV.UK Frontend 5.14.0, and Joi 18.2.9. Backend-only storage dependencies are owned and configured by `adts-backend`.

**Storage**: The UI uses Yar for current-session working state and calls backend methods for durable draft persistence. The backend owns and configures the draft store. Completed submissions and print-document references are returned through the LIMS integration in `adts-submissions-service`.

**Testing**: Jest 30.5.2, service-level route/integration tests, and Playwright 1.63.0 end-to-end tests; ESLint and existing build commands.

**Target Platform**: Independently deployable Node.js cloud services: `adts-ui` (port 9181), `adts-backend` (port 9182), and `adts-submissions-service` (port 9180).

**Project Type**: Three-service web application in a monorepo: server-rendered UI, backend/draft API, and LIMS adapter.

**Performance Goals**: No feature-specific latency or throughput target is defined. Preserve existing service-level objectives; verify draft reads and writes, navigation, and submission errors remain responsive and observable.

**Constraints**:
- Pages MUST use GOV.UK Design System patterns and work without client-side JavaScript; JavaScript is an enhancement only.
- Each form progression is a normal validated POST followed by a redirect. Do not advance to a page as if saved when backend persistence fails.
- Each progression calls the backend to create or update the draft with the current complete form snapshot, rather than sending field-level diffs. The UI does not access or configure the backend's storage.
- Every pre-submission stage is required. A submission needs at least one selected kit and a delivery address. The final Print documents stage follows successful submission.
- Draft identity and ownership MUST come from trusted server-side user identity, never a browser-supplied owner identifier. Do not log full form payloads or sensitive client/animal details.
- Draft storage, database credentials, table configuration, and storage-specific limits are backend concerns and MUST NOT be exposed as UI configuration or dependencies.
- Exact report fields are intentionally not defined until task refinement provides the approved ADTS/APHA field set.
- Completed submission calls must be safely retryable without creating duplicate LIMS submissions.

**Scale/Scope**: Eight named stages, each of which may contain one or more pages; one species and one or more animals per report; at least one kit per submission; one durable draft record per report, owned by its authenticated user.

## Constitution Check

### Before Phase 0

- **GOV.UK Design System by Default**: PASS — use existing GOV.UK components/macros, standard styles, and content guidance; document any justified exception.
- **Accessible and Inclusive Service**: PASS — retain semantic form controls, visible validation, keyboard operation, and progress announcements; include accessibility checks with route and end-to-end tests.
- **Privacy and Security by Design**: PASS WITH IMPLEMENTATION GATE — persist drafts only in the backend-owned table; enforce owner-scoped reads/writes from trusted identity, least privilege, and no sensitive payload logging. Confirm the production identity context before enabling draft routes.
- **Quality, Reliability, and Operability**: PASS — test successful flows, validation, DynamoDB/LIMS failures, retries, and resumed drafts; expose actionable diagnostics without report contents.
- **Testing order and coverage**: PASS — progress through unit, integration, then end-to-end testing and meet the constitution's 90% new-code coverage requirement or record an approved exception.
- **Independent service architecture**: PASS — UI calls backend; backend owns DynamoDB drafts and calls the submissions service for LIMS; preserve separate deployable boundaries.

No constitutional violation is identified. The identity-context implementation gate is a release prerequisite, not an accepted exception.

### After Phase 1 Design

- **GOV.UK Design System and accessibility**: PASS — server-rendered native forms and standard components remain the planned approach; route and end-to-end tests will validate keyboard and error behavior.
- **Privacy and security**: PASS WITH IMPLEMENTATION GATE — the backend method contract excludes caller-supplied ownership and requires owner-scoped access plus conditional revision writes. Confirm the production trusted-principal source before enabling draft access.
- **Quality and testing**: PASS — quickstart scenarios cover valid, invalid, resume, conflict, and dependency-failure paths; complete the constitutional unit → integration → end-to-end sequence and coverage gate during implementation.
- **Independent service architecture**: PASS — durable drafts remain in the backend, UI remains a separate presentation service, and completed submission uses the LIMS adapter boundary.

The design introduces no constitutional violation; identity and infrastructure configuration remain explicit release prerequisites.

## Project Structure

### Documentation (this feature)

```text
specs/001-animal-disease-submission/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── backend-methods.md
    └── lims-submission-contract.yaml
```

### Source Code

```text
services/adts-ui/src/
├── app.js
├── routes/
│   ├── submission*.js
│   └── drafts.js
└── views/
    ├── submission*.njk
    └── drafts.njk

services/adts-ui/tests/
├── routes/
├── component/
└── e2e coverage in tests/e2e/

services/adts-backend/src/
├── app.js
├── routes/
│   └── drafts.js
└── clients/
    ├── drafts.js
    └── submissions.js

services/adts-backend/tests/
├── routes/
└── unit/

services/adts-submissions-service/src/
├── app.js
└── routes/
    └── submissions.js

services/adts-submissions-service/tests/
├── routes/
└── integration/
```

**Structure Decision**: Extend the three existing services, keeping rendering and session working state in `adts-ui`, durable draft ownership and DynamoDB access in `adts-backend`, and completed-submission/LIMS integration in `adts-submissions-service`. Add only route/client/view modules that follow existing service patterns. The paths above indicate likely modules; implementation should reuse actual repository naming and organization.

## Complexity Tracking

No constitution violations or extra deployable services are proposed.
