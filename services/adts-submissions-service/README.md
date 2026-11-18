# ADTS Submissions Service

Changes to this directory trigger the service's CI build.

## Runtime Configuration

The service validates its LIMS settings at startup:

| Variable | Purpose |
|---|---|
| `PORT` | HTTP listener port inside the container. |
| `LIMS_BASE_URL` | Configured LIMS origin only; credentials, query strings, and fragments are not accepted in the URL. |
| `LIMS_PREFIX` | Environment-specific LIMS API prefix. |
| `LIMS_TIMEOUT_MS` | Per-request LIMS deadline in milliseconds; defaults to `10000`. |
| `LIMS_ALLOW_HTTP` | Must be `true` to permit an HTTP LIMS origin under the temporary exception below. |

The LIMS API has no username/password authentication and relies on network security only, so the service sends no credentials or `Authorization` header to LIMS and has no LIMS secrets to configure. LIMS access must be restricted by network controls, which are a deployment responsibility to confirm before release.

## Network Trust Boundary

Backend-to-Submission-Service traffic must use HTTPS on the approved private AWS route. AWS network policy/security groups must allow service ingress only from the Backend workload. The initial release does not verify SigV4 or another per-request Backend identity. IAM roles grant access to AWS resources; they do not authenticate incoming HTTP requests. API Gateway and in-service request authentication are not part of this release. The residual network-only trust risk requires documented acceptance by an accountable risk owner before production release.

## Temporary LIMS HTTP Exception

The current production LIMS endpoint uses HTTP. HTTP does not encrypt submission data. Set `LIMS_ALLOW_HTTP=true` only for the configured LIMS origin while this explicitly accepted temporary exception is active. The exception has no confirmed end date and must be removed when the LIMS client enables HTTPS.

When LIMS HTTPS is enabled, set `LIMS_ALLOW_HTTP=false`; the shared client uses HTTPS with certificate and hostname validation enabled. If LIMS uses a private CA, provide it through the approved runtime trust store or `NODE_EXTRA_CA_CERTS`. Never disable certificate validation, silently downgrade HTTPS, or follow redirects to a different origin.

## Health Checks

- `GET /health` reports process health only.
- `GET /ready` reports startup/config readiness and does not depend on LIMS.
- `GET /health/lims` checks the configured LIMS origin through the shared client and returns `503` when LIMS is unavailable.

The removed `/connection_health` endpoint accepted caller-supplied destinations and must not be reintroduced.

## Ambiguous LIMS Mutations

Draft creation, confirmation, and cancellation are not automatically retried. If a timeout or lost response leaves the outcome unknown, reconcile the state with LIMS before retrying. No local idempotency ledger exists. The exact reconciliation lookup or operational procedure must be confirmed with the LIMS client before production release.

## Results and Reports

Latest result data, including the fields used by the legacy report view, is returned as JSON. For PDF retrieval, LIMS returns JSON containing base64 `LastReportString`; the service decodes that value and serves the PDF inline with `Content-Type: application/pdf`. The legacy flow does not set a download filename. Missing or malformed report content is returned as an error rather than an empty successful PDF.

## Legacy Operation Mapping

The Backend API uses canonical domain names; this service keeps the legacy LIMS paths and parameter spellings internal.

| Capability | Observed LIMS operation | Mapping notes |
|---|---|---|
| Product search | `general/getProducts` | `filter` required; `species` optional. Response records are currently pass-through. |
| Client search | `general/getClients` | `pvsId`, `filter`. |
| Practice details | `general/getPVS` | `pvsId`. |
| Submission identifiers | `submissions/getSubmissionIdList` | LIMS query key is lowercase `pvsid`; `filter` optional. |
| Submission search | `submissions/getSubmissions` | LIMS query key is lowercase `pvsid`; preserve supported filters and date format. |
| Draft retrieval | `submissions/getSubmission` | LIMS query key `submissionId` carries the draft ID, plus `pvsId`. |
| Submitted-record view | `submissions/viewSubmission` | `submissionId`, `pvsId`, `isDraft`. |
| Draft addresses | `submissions/getDeliveryAddresses` | Cancellation-independent address lookup uses `draftSubmissionId`. |
| Latest results/charges and release summary | `submissions/getLatestReleasedResults` | Legacy view reads fields including `Sections`, `VioComment`, `WorkInProgress`, `Charges`, and `samples`. |
| Draft save/update | `submissions/createUpdateDraftSubmission` | Send the 52-key legacy payload described in [data-model.md](../../specs/003-submission-service/data-model.md); response supplies `draftSubmissionId`. |
| Draft confirmation | `submissions/confirmDraftSubmission` | Send `draftSubmissionId` and `pvsId`; response supplies `submissionId`. Legacy callers save the full draft before confirming. |
| Cancellation request | `submissions/cancelSubmission` | Send `pvsId`, `submissionDraftId`, and caller-provided `clinician`; inspect `hasErrors` and `errorMessages` even on HTTP success. |
| PDF report | `submissions/getReleaseSummaryAndReport` | LIMS returns JSON with base64 `LastReportString`; decode and serve as inline PDF. |

These are source-derived legacy behaviors, not an authoritative LIMS contract. LIMS validation rules, mutation idempotency, confirmation/cancellation rejection statuses, cancellation state, and reconciliation guarantees remain unconfirmed. Verify those operation-specific unknowns as their implementation tasks progress; do not infer them from examples or the mock.
