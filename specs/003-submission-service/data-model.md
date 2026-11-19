# Data Model: ADTS Submission Service

This model describes the Submission Service API boundary, not a new persistent schema. The service is stateless with respect to business records; LIMS remains authoritative for LIMS records. The Backend's local ADTS drafts in DynamoDB are a separate entity and remain Backend-owned.

## Entities

### Backend Network Boundary

Initial-release access boundary for Backend-to-Submission-Service requests. This is deployment topology, not a per-request identity entity.

| Attribute | Meaning | Rules |
|---|---|---|
| `transport` | Backend-to-service connection | HTTPS is required. |
| `allowedSource` | Backend workload network identity/security group | AWS network policy must restrict ingress to the Backend workload. |
| `serviceRole` | Submission Service IAM role | Grants only the AWS resource permissions the service needs; it does not authenticate incoming HTTP requests. |

The service does not verify SigV4 or another per-request caller identity in the initial release. The Backend performs PVS authorization before calling the service. A future spec may add request-level authentication.

### PVS / Practice

A LIMS veterinary practice identifier used to scope client, draft, submission, and result operations.

| Attribute | Meaning | Rules |
|---|---|---|
| `pvsId` | Stable practice identifier | Required where the LIMS operation is PVS-scoped; preserve value exactly. |
| `details` | Practice data returned by LIMS | Field set follows verified LIMS response and current application use. |

Observed lookup request: `general/getPVS` with `pvsId`. Exact response fields remain unconfirmed and are passed through provisionally.

LIMS uses inconsistent parameter spelling for this identifier. The Backend contract uses the canonical `pvsId`; mapping to legacy spellings stays in the LIMS adapter.

### Client

A client record searched within a practice context.

| Attribute | Meaning | Rules |
|---|---|---|
| `clientId` | LIMS client identifier | Preserve exactly; required when returned by LIMS. |
| `pvsId` | Practice association | Preserve when provided by the verified contract. |
| `details` | Client name and other application-required data | Exact attributes and sensitivity classification require source/contract discovery. |

Observed lookup request: `general/getClients` with `pvsId` and `filter`. Exact response fields remain unconfirmed and are passed through provisionally.

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
| `data` | Complete editable draft payload | The supplied release 12.1.6 reference documents exactly 52 serialized keys; see the field catalogue below. Treat this as observed legacy behavior, not authoritative LIMS validation rules. |
| `state` | LIMS draft lifecycle state | At minimum distinguish editable draft from confirmed submission; exact upstream states require discovery. |

#### Legacy draft payload field catalogue

The legacy serializer emits exactly these 52 top-level keys. Nullability below follows the supplied source-derived examples; LIMS-side acceptance rules remain unverified.

| # | Field | Observed shape / constraint |
|---:|---|---|
| 1 | `draftSubmissionId` | String or null/empty for initial create; LIMS returns the allocated identifier. |
| 2 | `submissionType` | `MONI` for routine, otherwise `DIAG`. |
| 3 | `pvsId` | Practice LIMS code string. |
| 4 | `clientName` | String; empty when no client selected. |
| 5 | `clientFarm` | String; legacy caller sources from selected client farm/address line 1. |
| 6 | `clientAddress` | String; address lines joined with `, `. |
| 7 | `clientPostcode` | String. |
| 8 | `clientCounty` | String; passed through unchanged. |
| 9 | `clientSubCounty` | String or null when empty. |
| 10 | `clientCPHH` | String. |
| 11 | `clinician` | String; maximum 1000 characters. |
| 12 | `resultsReadyConfirmationEmail` | String; empty unless email confirmation selected. |
| 13 | `resultsReadyConfirmationPhoneNumber` | String; empty unless phone confirmation selected. |
| 14 | `areAnimalsAtFarmAddress` | Boolean. |
| 15 | `animalCPHH` | String or null. |
| 16 | `animalFarm` | String or null. |
| 17 | `animalAddress` | String; up to three trimmed address lines joined with `, `. |
| 18 | `animalPostcode` | String or null. |
| 19 | `animalCounty` | String or null. |
| 20 | `animalSubCounty` | String or null; exact legacy casing is `SubCounty` at the client but `SubCounty`-style field name here is `animalSubCounty`. |
| 21 | `animalSpeciesId` | String; LIMS species code or empty when unset. |
| 22 | `animalBreedId` | String; empty when unset. |
| 23 | `animals` | Array of `{id, name}`; `id` is the zero-based row index and `name` is the animal tag. |
| 24 | `animalSexId` | String; empty when unset. |
| 25 | `animalAgeId` | String; empty when unset. |
| 26 | `ageDetail` | String or null. |
| 27 | `ageIndicator` | `NONE`, `DAYS`, `WEEKS`, `MONTHS`, `YEARS`, or null. |
| 28 | `ageIsEstimate` | Boolean or null. |
| 29 | `animalOrganicId` | String; empty when unset. |
| 30 | `animalPurposeId` | String; empty when unset. |
| 31 | `animalHousingId` | String; empty when unset. |
| 32 | `dateSamplesTaken` | Null when empty; outbound legacy format is `d/m/Y`. |
| 33 | `previousSubmissionId` | String; empty when none. |
| 34 | `previousSubmissionContactByPhone` | Boolean or null. |
| 35 | `previousSubmissionContactByAphaFarmVisit` | Boolean or null. |
| 36 | `herdTotal` | String or null. |
| 37 | `herdBreedingTotal` | String or null. |
| 38 | `herdAffectedTotal` | String or null. |
| 39 | `herdAffectedIncDead` | String or null. |
| 40 | `herdDeadTotal` | String or null. |
| 41 | `clinicalSign1Id` | String; empty if not selected. |
| 42 | `clinicalSign2Id` | String; empty if not selected. |
| 43 | `clinicalSign3Id` | String; empty if not selected. |
| 44 | `clinicalSignDurationId` | String; empty if not selected. |
| 45 | `clinicalHistory` | String or null. |
| 46 | `products` | Array of serialized basket products described below. |
| 47 | `samplesWillSendToSeparateAddresses` | Boolean or null when unanswered. |
| 48 | `canUseSurveillance` | Boolean. |
| 49 | `cancelSubmission` | Always null in observed callers; never rely on this field to cancel. |
| 50 | `masterSubmissionId` | Null in observed outbound serialization. |
| 51 | `linkedFirstOfPairSubmissionId` | String or null; second-of-pair submissions reference the first. |
| 52 | `sendersReference` | String or null. |

The serializer does **not** send `submissionId`, submission-level `isFOP`/`isSOP`, or `editedAddress1..7`. A mock must tolerate repeated and partial draft saves because the legacy app calls the save operation after form steps, on review-field changes, basket changes, and before confirm.

#### Product entries

Each `products[]` entry contains `productId`, `productType`, boolean `isFOP`/`isSOP`, `animalSamples[]`, `sampleTypes[]`, and `options[]`. Product name, price, species, and accreditation are not serialized. `animalSamples[].animalId` is the zero-based animal row index; `animalName` is the tag; `sampleId` is a string; `poolGroup` is null or a number. Package constituents add `packageProductId` to sample/option entries. `sampleTypes[]` contains `packageProductId` and `sampleType`; `options[]` contains `packageProductId` and `option`. The legacy caller strips `_ISPOOLED` from `sampleType` when posting.

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
| `summary` | Structured released-results information | The legacy app reads this from `getLatestReleasedResults`; see source-derived fields in the uploaded LIMS reference. |
| `LastReportString` | Base64-encoded PDF in the LIMS JSON response | Decode to PDF bytes for the Backend-facing report response. The legacy app serves it inline with `application/pdf` and no filename header. |

### Operation Outcome

Normalized outcome returned by the service.

| Attribute | Meaning | Rules |
|---|---|---|
| `status` | Operation result | Must not claim mutation success without upstream evidence. |
| `identifier` | `draftId` or `submissionId` where applicable | Required only when the corresponding operation is confirmed successful. |
| `error.category` | Stable service error category | Distinguishes validation, authentication/authorization, business rejection, upstream HTTP, timeout, transport, dependency unavailable, and unknown outcome. |
| `error.message` | Safe actionable description | Must not contain credentials or unfiltered sensitive request/response content. |
| `error.upstreamMessages` | Bounded LIMS business-rejection messages, when supplied | At most 10 string messages of 500 characters each; credential-shaped text is replaced with `[REDACTED]`. |
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
- Preserve the source-derived `getLatestReleasedResults` fields and decode the `LastReportString` base64 PDF for report retrieval. Confirm unknown result keys, maximum PDF size, empty-report semantics, and LIMS error behavior as those operations are refined; unrelated verified operations can proceed.
- Do not use the abbreviated JSON sample or `specs/001` provisional contract as a complete schema.
