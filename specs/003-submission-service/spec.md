# Feature Specification: ADTS Submission Service

**Feature Branch**: `[feature/submisssion-service]`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: Create an independently deployable ADTS Submission Service that provides a secure, reliable integration boundary between the Backend and the existing LIMS, preserving the legacy LIMS-facing capabilities needed by the application.

## Clarifications

- **Q1 - Resolved**: The Backend-facing contract will be domain-oriented. The Submission Service owns validation and mapping between the agreed domain contract and LIMS. The legacy model and current application callers establish existing ADTS behaviour; the authoritative LIMS contract verifies external semantics. As tasks progress, establish the fields, operation responses, report/attachment formats, and legacy behaviours from both sources, documenting and resolving discrepancies before implementing each affected operation. Do not infer these details from the abbreviated reference.
- **Q2 - Resolved**: The Submission Service authenticates Backend callers. The Backend owns PVS authorization and must authorize access before making a PVS-scoped request; the service accepts PVS scope only from an authenticated Backend caller.
- **Q3 - Resolved**: The service does not automatically retry confirmation or cancellation when the outcome is ambiguous. It reports an indeterminate outcome, and a caller must reconcile whether the action completed before retrying.

### Session 2026-10-30

- Q: Which evidence should be authoritative when defining the complete draft, response, and report contract? → A: Use both the legacy model and current application callers to establish current ADTS behavior, verify LIMS semantics against its authoritative contract, and document and resolve discrepancies before implementing each affected operation as tasks progress.
- Q: How should the service handle a first draft-creation request that times out before LIMS returns a draft ID? → A: Do not retry automatically; report an indeterminate outcome and reconcile whether the draft was created before retrying.
- Q: Which availability and response-time targets should the Submission Service meet for Backend requests? → A: Define no numeric targets; use current test acceptance and operational monitoring.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find and retrieve LIMS records (Priority: P1)

The Backend requests product, client, practice/PVS, submission identifier, and submission information through the Submission Service. The service returns relevant LIMS information using a consistent contract, without requiring the Backend to know LIMS-specific parameter spellings.

**Why this priority**: These lookups and retrievals support existing ADTS workflows and establish the integration boundary needed by the Backend.

**Independent Test**: Exercise each supported search and retrieval with representative LIMS responses; verify returned identifiers, filters, and information are preserved, and errors use the documented contract.

**Acceptance Scenarios**:

1. **Given** LIMS is available and the Backend submits a valid product, client, PVS, submission-identifier, or submission search, **When** the Submission Service forwards the supported criteria, **Then** it returns the matching information while keeping LIMS parameter spelling differences internal.
2. **Given** a valid PVS and submission identifier, **When** the Backend requests an editable draft or a previously submitted record, **Then** the service returns the corresponding submission information without conflating draft and submitted states.
3. **Given** a valid draft identifier, **When** the Backend requests delivery or sample addresses, **Then** the service returns the addresses associated with that draft.
4. **Given** the request is invalid or LIMS cannot fulfil it, **When** the Backend makes a lookup, **Then** it receives a consistent, actionable error that identifies the failure category without exposing credentials or sensitive request data.
5. **Given** the Backend sends a request using the agreed domain contract, **When** the Submission Service validates and maps it for LIMS, **Then** LIMS-specific endpoint names and parameter spellings are not exposed in the Backend contract.

### User Story 2 - Save, confirm, or cancel a submission (Priority: P1)

The Backend saves or updates a draft, confirms an existing draft, or requests cancellation through the Submission Service and receives the relevant identifier and an accurate outcome.

**Why this priority**: Draft and submission lifecycle operations are essential to preserving the current application's core submission workflow.

**Independent Test**: Use controlled LIMS success, business-rejection, transport-failure, and timeout responses for draft save, confirmation, and cancellation; verify IDs and outcomes are reported accurately and no ambiguous result is falsely presented as success.

**Acceptance Scenarios**:

1. **Given** a valid draft request containing all fields required by the agreed contract, **When** the Backend saves or updates it, **Then** the complete agreed data is sent to LIMS and the returned draft identifier is provided to the Backend.
2. **Given** an existing draft, **When** the Backend requests confirmation and LIMS confirms it, **Then** the resulting submission identifier is returned.
3. **Given** confirmation or cancellation is rejected by LIMS or its outcome cannot be established, **When** the Backend receives the service response, **Then** it is told the accurate failure or indeterminate outcome and is not told the action succeeded without evidence.
4. **Given** LIMS returns a cancellation response containing business-level errors, **When** the Backend requests cancellation, **Then** the service preserves the rejection details and does not report cancellation as successful.
5. **Given** confirmation or cancellation may have completed but its response was not received, **When** the service detects the ambiguous outcome, **Then** it does not automatically repeat the action and reports that reconciliation is required before a caller retries.
6. **Given** a first draft-creation request may have been accepted but the response containing its draft ID was not received, **When** the service detects the ambiguous outcome, **Then** it does not automatically retry and reports that reconciliation is required before a caller retries.

### User Story 3 - Retrieve results and reports (Priority: P2)

The Backend retrieves the latest released results, associated charges, release summaries, and reports for a submission through the Submission Service.

**Why this priority**: The Backend needs post-submission information currently obtained from LIMS, while the exact report representation remains to be confirmed.

**Independent Test**: Supply representative released-result, charge, release-summary, and report responses and verify that the agreed response preserves the information and media needed by the current application.

**Acceptance Scenarios**:

1. **Given** a valid PVS and submission identifier with released information, **When** the Backend requests the latest released results, **Then** the service returns the results and associated charges available from LIMS.
2. **Given** a valid submission with a release summary or report, **When** the Backend requests it, **Then** the service returns the content in the agreed representation or a clear error if it is unavailable.
3. **Given** results or reports are not yet available, **When** the Backend requests them, **Then** the response distinguishes unavailable content from a successful empty result or a service failure according to the agreed contract.

### User Story 4 - Operate and diagnose the integration (Priority: P1)

Service operators and the Backend can distinguish whether the Submission Service is running from whether LIMS is reachable, and can diagnose failures without exposing secrets or sensitive submission data.

**Why this priority**: Independent operation and safe failure reporting are necessary for a reliable service boundary and for diagnosing LIMS outages.

**Independent Test**: Test service health with LIMS both available and unavailable, and exercise validation, LIMS business-error, credential-rejection, timeout, transport-failure, and unavailable-dependency responses; inspect outputs and logs for sensitive data.

**Acceptance Scenarios**:

1. **Given** the Submission Service is running but LIMS is unavailable, **When** its process health is checked, **Then** process health remains distinct from the LIMS connectivity result.
2. **Given** LIMS is reachable, **When** its connectivity health is checked, **Then** the service reports the LIMS result independently of its own process health.
3. **Given** LIMS returns a business error, rejects credentials, times out, or cannot be reached, **When** an operation is requested, **Then** the Backend receives a predictable error category and meaningful non-secret details.
4. **Given** requests are processed or fail, **When** operational information is recorded, **Then** credentials and sensitive request or response data are not exposed.
5. **Given** a caller is not an authenticated Backend, **When** it requests a PVS-scoped operation, **Then** the Submission Service rejects the request. For an authenticated Backend caller, the Backend is responsible for authorizing access to the requested PVS before making the request.

### Edge Cases

- LIMS connectivity fails while the Submission Service process remains healthy; these states must not be collapsed into one health result.
- LIMS accepts a non-idempotent action but its response is lost or delayed; the service reports an indeterminate outcome and does not automatically retry before reconciliation.
- LIMS creates a draft but its response containing the draft ID is lost; the service must not automatically repeat the initial create request.
- LIMS returns an HTTP success response containing a business-level rejection, including cancellation errors; the service must preserve and report the rejection.
- LIMS returns an incomplete or unexpected response, including a missing draft or submission identifier after a lifecycle action; the service must not claim success without the required evidence.
- LIMS rejects credentials, presents an untrusted TLS certificate, times out, or is unavailable; the service must fail predictably and must not disable certificate validation.
- Search criteria include optional filters or endpoint-specific legacy parameter spellings; the service must preserve supported semantics without exposing those inconsistencies in its Backend contract.
- A report or attachment is empty, unavailable, or returned in a format not yet confirmed by the Backend; the response must not misrepresent it as a valid report.
- The abbreviated draft example omits data required by the real application; the service must not treat that example as the complete draft schema.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Submission Service MUST be independently deployable from the ADTS UI and Backend and MUST be the only ADTS component that communicates directly with LIMS. The Backend MUST NOT need LIMS credentials or direct LIMS access.
- **FR-002**: The service MUST provide the Backend with a consistent, documented REST contract for the supported LIMS capabilities. LIMS-specific endpoint names and parameter spelling inconsistencies MUST remain internal to the service, while required identifiers and data semantics are preserved.
- **FR-003**: The service MUST report LIMS connectivity separately from its own process health. Its operational health and readiness information MUST NOT make all service health checks depend on LIMS availability.
- **FR-004**: The service MUST support searching LIMS products and clients, retrieving PVS/practice details, and searching submission identifiers and records using the supported filters.
- **FR-005**: The service MUST support retrieving editable drafts, viewing previously submitted submissions, and retrieving draft delivery/sample addresses.
- **FR-006**: The service MUST support creating and updating drafts and return the LIMS draft identifier when the operation succeeds. It MUST send all data required by the agreed complete draft contract; the abbreviated example in the reference MUST NOT be treated as complete.
- **FR-007**: The service MUST support confirming an existing draft and return the resulting submission identifier only when confirmation is established.
- **FR-008**: The service MUST support requesting cancellation and accurately report the LIMS outcome, including business-level rejection details.
- **FR-009**: The service MUST support retrieving the latest released results, charges, release summaries, and reports, preserving the content required by the current application in the agreed response representation.
- **FR-010**: The service MUST distinguish validation errors, LIMS business-level errors, transport failures, timeouts, and unavailable dependencies. It MUST preserve meaningful LIMS error information for the Backend without exposing credentials or sensitive request data.
- **FR-011**: All outbound LIMS connections MUST validate TLS certificates. The service MUST NOT reproduce the legacy client's disabled certificate verification.
- **FR-012**: LIMS host/prefix and authentication MUST be configurable per environment. Secrets MUST NOT be embedded in source code or exposed in logs.
- **FR-013**: The service MUST NOT automatically retry an initial draft-creation request when LIMS may have created the draft but the response containing its identifier was not received. It MUST report an indeterminate outcome and require reconciliation before a caller retries. The service MUST apply the same rule to ambiguous draft confirmation and cancellation. Timeout values and retry behaviour for other operations MUST be documented before implementation.
- **FR-014**: The service MUST authenticate Backend callers and reject requests from unauthenticated callers. The Backend MUST authorize access to a PVS before making a PVS-scoped request; the service MUST accept PVS scope only from an authenticated Backend caller.
- **FR-015**: Automated tests MUST cover successful requests, rejected inputs, LIMS business errors, transport/timeouts, and unavailable LIMS responses for the supported service behaviours.
- **FR-016**: The service contract and tests MUST distinguish confirmed legacy behaviour from incomplete or uncertain reference information. As tasks progress, the team MUST use the legacy model and current application callers to establish ADTS behaviour, verify LIMS semantics against its authoritative contract, and document and resolve discrepancies before implementing each affected operation. The team MUST document the full draft fields, operation responses, report/attachment formats, and legacy behaviours to preserve or correct; unverified details MUST NOT be inferred from the abbreviated reference.

### Key Entities

- **PVS/practice**: A veterinary practice identified by a LIMS identifier and associated with its permitted client and submission information.
- **Client**: A client record searched or retrieved in the context of a practice.
- **Submission**: A LIMS record with an identifier, status, associated client and practice, and submission data.
- **Draft submission**: An editable, not-yet-confirmed submission with a draft identifier and the full set of fields required by the agreed contract.
- **Released results and charges**: Results and charge information released for a submission.
- **Release summary and report**: Summary or report content associated with a released submission; exact representation remains to be confirmed.
- **Operation outcome**: The result of a lookup or lifecycle request, including success identifiers or a categorized failure with meaningful, non-sensitive details.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance tests, 100% of supported lookup and retrieval scenarios return the expected LIMS identifiers and required application data, or the documented actionable error for the scenario.
- **SC-002**: In acceptance tests, 100% of successful draft saves return the LIMS draft identifier, and 100% of confirmed drafts return the resulting submission identifier; failed or indeterminate actions are never reported as confirmed success.
- **SC-003**: In the defined failure test suite, 100% of validation, business-error, transport, timeout, and unavailable-dependency cases are reported in their correct error category without credential or sensitive request data in responses or logs.
- **SC-004**: Operators can distinguish service-process health from LIMS connectivity in all tested combinations using health results and operational monitoring; acceptance relies on the defined functional scenarios, with no feature-specific numeric availability or response-time targets.
- **SC-005**: Reviewers can verify that the Backend uses the documented Submission Service contract for all LIMS operations and that no other ADTS component requires direct LIMS credentials or connectivity.

## Assumptions

- The existing LIMS remains the system of record for products, clients, PVS details, submissions, drafts, results, charges, summaries, and reports.
- The source reference documents observed legacy behaviour only. The legacy `Submission.php` and `LimsApiClient.php` sources are not present in this workspace; tasks will locate the legacy model and current application callers and verify LIMS semantics against the authoritative contract incrementally. Each operation's contract must be confirmed before that operation is implemented; unrelated verified work need not wait for the full schema catalogue.
- Existing business workflows should be preserved where verified, but known defects must not be reproduced automatically. The intended corrections and compatibility requirements remain to be agreed.
- Backend callers are authenticated by the Submission Service; the Backend is responsible for PVS authorization before calling it.
- No new persistent data store or asynchronous processing is required for this feature unless separately agreed.
- Existing repository and service operational standards apply; deployment details and technology choices are for the planning phase.
- The feature includes only the Submission Service, its Backend-facing contract, LIMS integration, configuration, observability, testing, and deployment integration. UI changes, redesign of Backend workflows, changes to LIMS, a new persistent data store, and asynchronous processing are out of scope unless separately agreed.