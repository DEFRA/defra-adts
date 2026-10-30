# Data Model: ADTS Submission Service

This model describes the Submission Service API boundary, not a new persistent schema. The service is stateless with respect to business records; LIMS remains authoritative for LIMS records. The Backend's local ADTS drafts in DynamoDB are a separate entity and remain Backend-owned.

## Entities

### Backend Caller

Authenticated service identity for the Backend calling a protected operation.

| Attribute | Meaning | Rules |
|---|---|---|
| `subject` | Platform-issued caller identity | Required; derived from verified identity, never from request body/query. |
| `audience` | Intended service audience | Must identify the Submission Service. |
| `scopes` | Allowed service operations, if supplied by the approved platform | Enforce least privilege; exact claim names are platform-dependent. |

The Backend performs PVS authorization before calling the service. The Submission Service authenticates the Backend and only accepts PVS scope from an authenticated call. It does not infer a user's PVS authorization from a caller-supplied user ID.

### PVS / Practice

A LIMS veterinary practice identifier used to scope client, draft, submission, and result operations.

| Attribute | Meaning | Rules |
|---|---|---|
| `pvsId` | Stable practice identifier | Required where the LIMS operation is PVS-scoped; preserve value exactly. |
| `details` | Practice data returned by LIMS | Field set follows verified LIMS response and current application use. |

LIMS uses inconsistent parameter spelling for this identifier. The Backend contract uses the canonical `pvsId`; mapping to legacy spellings stays in the LIMS adapter.

### Client

A client record searched within a practice context.

| Attribute | Meaning | Rules |
|---|---|---|
| `clientId` | LIMS client identifier | Preserve exactly; required when returned by LIMS. |
| `pvsId` | Practice association | Preserve when provided by the verified contract. |
| `details` | Client name and other application-required data | Exact attributes and sensitivity classification require source/contract discovery. |

### Submission Identifier

An identifier returned from LIMS search, used to retrieve a draft or submitted record.

| Attribute | Meaning | Rules |
|---|---|---|
| `id` | LIMS identifier | Preserve exactly. |
| `recordType` | `draft` or `submitted` when known | Do not conflate draft and submitted records. |

### LIMS Draft Submission

An editable LIMS draft. It is not the same as a Backend-local unsent ADTS draft.

| Attribute | Meaning | Rules |
|---|---|---|
| `draftId` | LIMS draft identifier | Returned after a confirmed create/update; retain exact LIMS value. |
| `pvsId` | Associated practice | Required for PVS-scoped operations. |
| `data` | Complete editable draft payload | Confirm fields, nested shapes, types, and optionality from legacy model/callers and verified LIMS contract as tasks progress, before implementing draft operations. The abbreviated reference example is not a schema. |
| `state` | LIMS draft lifecycle state | At minimum distinguish editable draft from confirmed submission; exact upstream states require discovery. |

### LIMS Submission

A previously confirmed LIMS submission.

| Attribute | Meaning | Rules |
|---|---|---|
| `submissionId` | LIMS submission identifier | Preserve exactly; returned after confirmed draft confirmation. |
| `draftId` | Source draft identifier, if supplied | Preserve association when returned. |
| `pvsId` | Associated practice | Preserve and scope consistently. |
| `data` | Submitted record, statuses, client, tests and addresses | Return all fields required by current ADTS callers, as verified during contract discovery. |

### Delivery / Sample Address

An address associated with a draft for delivery or sample routing.

| Attribute | Meaning | Rules |
|---|---|---|
| `draftId` | Associated LIMS draft | Required for lookup. |
| `addresses` | Address records returned by LIMS | Preserve distinction between delivery and sample destinations and any user-relevant labels. Exact schema requires discovery. |

### Released Results and Charges

Latest released testing information associated with a submission.

| Attribute | Meaning | Rules |
|---|---|---|
| `submissionId` | Associated LIMS submission | Required. |
| `results` | Released result records/statuses | Preserve required application information and release ordering. Exact schema requires discovery. |
| `charges` | Charge details | Preserve currency, amount, and meaning as returned; exact fields require discovery. |

### Release Summary / Report

Release summary or report/attachment returned for a submission.

| Attribute | Meaning | Rules |
|---|---|---|
| `submissionId` | Associated LIMS submission | Required. |
| `mediaType` | Upstream representation type | Preserve; exact values and whether content is structured or binary require discovery. |
| `content` | Report payload | Preserve required bytes or structured content; do not assume JSON or invent attachment fields. |

### Operation Outcome

Normalized outcome returned by the service.

| Attribute | Meaning | Rules |
|---|---|---|
| `status` | Operation result | Must not claim mutation success without upstream evidence. |
| `identifier` | `draftId` or `submissionId` where applicable | Required only when the corresponding operation is confirmed successful. |
| `error.category` | Stable service error category | Distinguishes validation, authentication/authorization, business rejection, upstream HTTP, timeout, transport, dependency unavailable, and unknown outcome. |
| `error.message` | Safe actionable description | Must not contain credentials or unfiltered sensitive request/response content. |
| `correlationId` | Request-level diagnostic identifier | Safe to log and return; not an idempotency key or substitute for LIMS reconciliation. |

## Ownership and Lifecycle

- Backend-local ADTS draft: existing Backend/DynamoDB concern, potentially containing an incomplete form snapshot. It remains out of this service's persistence scope.
- LIMS draft: created or updated through the Submission Service and identified by the LIMS `draftId`.
- LIMS submission: created by confirmation of a LIMS draft and identified by `submissionId`.
- A confirmed mutation advances only when LIMS provides evidence of success and the required identifier.
- A timeout or lost response after a mutation is `outcome_unknown`. The service makes no automatic retry; the caller must reconcile with LIMS before repeating the action.
- Cancellation is a request outcome, not assumed state transition. Preserve business-level rejection and do not infer cancellation from HTTP status alone.
- The service introduces no durable entity, local revision, or cross-request deduplication ledger.

## Validation and Contract Discovery

- Validate required identifiers, supported filters, date formats, and operation-specific bodies at the service boundary once exact rules are confirmed.
- Use canonical Backend field names and explicitly map LIMS parameter spellings internally.
- Add tasks to obtain the complete legacy `Submission` model and request callers; verify fields against authoritative LIMS documentation or a controlled test environment incrementally.
- Confirm each operation's result, charge, release-summary, report, attachment, pagination, and error shapes before implementing that operation; unrelated verified operations can proceed.
- Do not use the abbreviated JSON sample or `specs/001` provisional contract as a complete schema.
