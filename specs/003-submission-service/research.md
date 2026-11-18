# Research: ADTS Submission Service

## Evidence Reviewed

- Feature requirements: [spec.md](spec.md)
- Observed LIMS behavior: [submission-service-lims-api-reference.md](../../docs/submission-service-lims-api-reference.md)
- Existing Submission Service: `services/adts-submissions-service/src/app.js`, `package.json`, `Dockerfile`, route tests, and config files.
- Existing Backend integration and local drafts: `services/adts-backend/src/app.js`, `src/data/submissions.js`, README, and proxy tests.
- Prior design evidence: `specs/001-animal-disease-submission/data-model.md`, `contracts/backend-methods.md`, and `contracts/lims-submission-contract.yaml`.
- CI and testing: `.github/workflows/adts-services_build.yml`, root `package.json`, service package scripts, and `docs/test-strategy/README.md`.
- Governance: `.specify/memory/constitution.md`.

## Decisions

### 1. Extend the existing service and preserve its deployment boundary

**Decision**: Extend `services/adts-submissions-service`, its existing Hapi application and independently published container. Keep service code, tests, and Backend adapter changes in their owning services. Do not create another container or add a new persistence store.

**Rationale**: The repository already has a separate service image, change detection, validation, ECR publication, and a Backend URL integration. Reusing these boundaries minimizes operational churn while meeting independent deployment requirements.

**Alternatives considered**: Move LIMS calls into the Backend (rejected because the feature requires the Submission Service to be the only ADTS LIMS caller); create a new service/container (rejected because an existing deployable service is already present).

### 2. Keep Backend-local drafts distinct from LIMS draft records

**Decision**: The Backend remains responsible for its local ADTS draft storage/search behavior. The Submission Service owns only the LIMS integration operations and LIMS draft identifiers. These are separate records and lifecycles; do not make the Submission Service persist a second copy.

**Rationale**: Current Backend code searches local Draft records in DynamoDB, while the current Submission Service proxies non-draft searches to LIMS. The older feature model describes Backend-owned form drafts. The active feature requires LIMS draft create/update/retrieve/confirm but explicitly excludes a new store. Treating every record called "draft" as the same entity would cause data ownership and lifecycle errors.

**Alternatives considered**: Move all draft persistence to the Submission Service (rejected as out of scope and introduces service-owned storage); treat Backend draft rows as LIMS drafts (rejected because their identifiers and schemas differ).

### 3. Use a versioned domain-oriented Backend API

**Decision**: Expose proposed `/v1` REST resource paths and domain terms, not LIMS endpoint names. Keep LIMS endpoint spelling, including `pvsid` and `submissionDraftId`, in an explicit adapter mapping. Validate request fields in the Submission Service before forwarding them. The OpenAPI artifact is a proposed contract; field-level draft schemas and LIMS response representations remain gated on contract discovery.

**Rationale**: This follows the accepted clarification and isolates the Backend from unstable external naming while preserving identifiers and business meaning.

**Alternatives considered**: Directly proxy arbitrary paths/query/body (rejected because it leaks LIMS conventions and bypasses validation); copy LIMS route names into Backend API (rejected because it couples the Backend to LIMS).

**Incremental product-search discovery**: The supplied observed reference identifies `general/getProducts`, requires `filter`, and allows optional `species`. Use those request semantics for the initial product-search slice. The exact product response fields are not established; pass records through without claiming a complete product schema, and update the contract when authoritative LIMS evidence becomes available.

**Incremental client/practice discovery**: The observed reference identifies `general/getClients` with `pvsId` and `filter`, and `general/getPVS` with `pvsId`. Use canonical Backend `pvsId` and map it internally. Client and practice response fields remain unconfirmed; pass through the LIMS records until authoritative evidence and current callers establish the required shapes.

**Incremental submission-read discovery**: The observed reference identifies `submissions/getSubmissionIdList` and `submissions/getSubmissions` with lowercase `pvsid`; `submissions/getSubmission` and `submissions/viewSubmission` use `submissionId` and `pvsId`, with `isDraft` for view; `submissions/getDeliveryAddresses` uses `draftSubmissionId`. Map these spellings from canonical Backend names. Keep read responses pass-through until authoritative evidence confirms their fields, dates, and pagination.

**Incremental results/report discovery**: The uploaded release 12.1.6 reference describes the fields the legacy app reads from `getLatestReleasedResults` (including `Sections`, `VioComment`, `WorkInProgress`, `Charges`, and `samples`). Map the Backend release-summary view to this JSON operation. `getReleaseSummaryAndReport` instead returns JSON with base64 `LastReportString`; decode it and serve the PDF inline as `application/pdf`, without a filename header, matching legacy behavior. LIMS-only maximum PDF size, missing-report status, additional result fields, and malformed-base64 behavior remain unknown.

**Incremental draft-mutation discovery**: The uploaded `LIMS_API_REFERENCE.md` describes legacy ADTS release 12.1.6 and cites `FullSubmissionForm::toSubmissionObject`, `Submission::jsonSerialize`, `BasketProduct::getLimsApiObject`, and mutation callers. Its save request contains exactly 52 top-level serialized keys, with documented nested `products[].animalSamples`, `sampleTypes`, and `options` structures. The legacy app calls save repeatedly for partial drafts and before confirm; initial save uses a null/empty draft ID and expects `draftSubmissionId` in the response. Treat these as source-derived compatibility behavior for the implementation and mock.

The legacy evidence does not establish LIMS validation rules, failure status/body, guaranteed create/upsert behavior, or idempotency. In particular, a timed-out initial create can leave an orphan draft. Keep those unknowns open; do not infer that repeated creates are safe or that the suggested mock upsert is a LIMS guarantee.

**Incremental confirmation/cancellation discovery**: The legacy reference specifies confirmation as `{draftSubmissionId, pvsId}` with `{submissionId}` on success; the legacy caller always saves the full draft immediately before confirming. Cancellation uses `{pvsId, submissionDraftId, clinician}` and requires `{hasErrors, errorMessages}` in the response. The legacy controller hard-codes `clinician` to `Joe Blogs` and ignores the business-error fields; the new service must accept the clinician from its caller and report business rejection. LIMS idempotency, exact rejection statuses, and cancellation eligibility/state remain unknown.

### 4. Use the private AWS network as the initial Backend trust boundary

**Decision**: Backend-to-Submission-Service calls use HTTPS over the approved private AWS network, with network policy/security groups restricted to the Backend workload. The initial release does not verify SigV4 or another per-request caller identity. IAM roles govern service access to AWS resources, not incoming HTTP caller identity. The Backend remains responsible for PVS authorization. Do not add a shared token or claim that the service authenticates an individual request. Health probes must be restricted by network/platform policy and must not expose secrets.

**Rationale**: The user selected HTTPS and AWS private networking/security groups for the initial boundary, with no SigV4 check. No runtime deployment manifest is tracked. CI's AWS OIDC role is only for image publication and does not authenticate runtime requests.

**Alternatives considered**: In-service SigV4 verification (deferred to a future spec); API Gateway (explicitly out of scope per user direction); security-group/network trust alone for initial scope (selected, with residual risk documented); static shared tokens (rejected).

**Release gate**: Confirm the private network route, security-group ingress restricted to the Backend workload, HTTPS termination, and IAM roles for service AWS resource access. The residual absence of per-request caller identity must be documented and accepted by an accountable risk owner before production release. In-service authentication requires a future spec.

### 5. Configure the LIMS origin with an HTTP/HTTPS toggle; LIMS has no authentication

**Decision**: Configure the LIMS origin and prefix per environment. The LIMS API has no username/password authentication and relies on network security only, so the service sends no credentials or `Authorization` header to LIMS and has no LIMS secrets to configure. Current production uses HTTP under the explicit temporary exception in FR-011; this transport is unencrypted, has no known HTTPS enablement date, and must be limited to the configured LIMS origin. Do not silently downgrade HTTPS or follow redirects to another origin. When the LIMS client enables HTTPS, require normal certificate and hostname verification and trust a custom CA only through approved runtime configuration. Never disable verification or log full request bodies or sensitive response bodies.

**Rationale**: The user clarified (2026-11-18) that the LIMS API has no username/password authentication and that access is controlled by network security only. The reference's legacy Basic Authentication does not apply. The reference also identifies disabled certificate validation as a defect. The user confirmed that the current production LIMS endpoint is HTTP and that HTTPS will be enabled in the future, with no schedule currently known, so the HTTP/HTTPS toggle remains necessary.

**Alternatives considered**: Copy the legacy disabled verification (rejected); silently treat HTTP as encrypted (rejected); send Basic Authentication or any credentials to LIMS (rejected: LIMS has no authentication); rely on the network boundary alone for LIMS access (selected, with the residual risk documented).

**Exception condition**: Before production release, an accountable risk owner must accept the unencrypted HTTP transport risk and record mitigations. The exception must be reviewed until HTTPS is available, then removed and replaced with verified TLS; no date is assumed.

### 6. Bound each outbound request and do not replay operations automatically

**Decision**: Apply a configurable overall LIMS request deadline (proposed default: 10 seconds) using Node's built-in `AbortSignal.timeout`. Send each request once; do not automatically retry LIMS calls. For draft creation, confirmation, or cancellation with an ambiguous outcome, return `outcome_unknown`; callers must reconcile the LIMS state before retrying. Other operations also use a single attempt in the initial release; callers may retry read-only requests under their own policy.

**Rationale**: A single attempt avoids hidden duplicates and makes timeout behavior explicit. The timeout is configurable and is a starting operational default, not a feature-specific latency SLO.

**Alternatives considered**: Generic retry middleware (rejected because it can replay non-idempotent actions); infer idempotency from HTTP verb or the older provisional OpenAPI contract (rejected because authoritative LIMS idempotency guarantees are absent); add a durable idempotency ledger (rejected because new service persistence is out of scope).

**Release gate**: Verify whether LIMS supports correlation/idempotency or a lookup sufficient to reconcile a draft create whose ID response was lost. If not, document the manual reconciliation procedure and ensure the Backend cannot blindly resubmit an unknown outcome.

### 7. Normalize failures without discarding useful LIMS business information

**Decision**: Return a stable error envelope with a service-owned category, safe message, and correlation ID. Map invalid Backend input, authentication/authorization failures, LIMS business rejections, upstream HTTP failures, timeouts, transport errors, unavailable dependencies, and indeterminate mutation outcomes distinctly. Preserve only allowlisted non-sensitive LIMS error codes/messages; never return raw upstream bodies by default.

**Rationale**: The reference notes cancellation can return HTTP success while `hasErrors` and `errorMessages` indicate business rejection. Transport status alone is not sufficient to determine success.

**Alternatives considered**: Return upstream responses unchanged (rejected because it leaks LIMS details and makes the Backend depend on irregular responses); collapse all failures to one 502 (rejected because it loses actionable error categories).

### 8. Resolve data and report contracts from both legacy behavior and authoritative LIMS semantics

**Decision**: Use the legacy model and current application callers to establish ADTS behavior; verify external semantics against the authoritative LIMS contract. Confirm schemas incrementally as tasks progress, and document and resolve discrepancies before implementing each affected operation. Independent scaffolding and operations whose contracts are already verified may proceed. Do not use the abbreviated JSON example or older provisional OpenAPI contract as a complete field schema.

**Rationale**: The provided reference states it is incomplete. Neither `Submission.php` nor `LimsApiClient.php` exists in the workspace; the older `specs/001` contract explicitly leaves fields and idempotency pending and describes a different completed-report workflow.

**Alternatives considered**: Treat the example as complete (rejected); treat the older provisional contract as authoritative (rejected); silently choose whichever source is easiest to access (rejected).

**Task dependency**: Add contract-discovery tasks for the legacy source/call-site evidence and authoritative LIMS documentation or verified test-environment behavior. Each operation's request/response fields, date formats, report media/attachments, pagination, and known defect handling must be confirmed before that operation's implementation task is unblocked. Do not block unrelated verified scaffolding or operations.

### 9. Separate process health, readiness, and LIMS connectivity

**Decision**: Keep `/health` as a process-only probe; provide readiness that checks service configuration/startup dependencies without requiring LIMS; expose a separate LIMS connectivity check using configured host, prefix, TLS, and a bounded deadline. Return an unavailable status for failed LIMS connectivity without changing process health.

**Rationale**: Existing `/health` is process-only, but `/connection_health` accepts caller-supplied protocol/host/port and returns failures with HTTP 200. The feature requires health checks not to collapse service and LIMS state.

**Alternatives considered**: Make process readiness depend on LIMS (rejected because a LIMS outage would remove a functioning service from the platform); accept arbitrary health-check destinations (rejected because it is not a configured dependency check and creates an unnecessary outbound request surface).

### 10. Follow repository test patterns and the stronger constitutional gate

**Decision**: Use Jest and the existing service pipeline, adding unit, route/API contract, LIMS-mock integration, and cross-service tests. Run tests in constitution order: unit, integration, then affected end-to-end. Demonstrate at least 90% coverage for new code; the constitution's 90% requirement takes precedence over lower general targets in the repository test strategy.

**Rationale**: The service already uses Jest and CI coverage, and the constitution sets a binding minimum.

**Alternatives considered**: Add a second test framework (rejected); rely only on proxy tests that mock arbitrary JSON (rejected because they do not prove the LIMS contract).

## PVS Context Gap For Backend Adapters

The current UI's submission filters contain `client`, `clinician`, `status`, and `submitted-date`, but no PVS identifier. Its client lookup calls `GET /GetClients` without a query. The current Backend has no PVS identity/authorization source in the inspected route code and forwards those calls without user context. The new Submission Service client and submission search contracts require PVS scope.

The non-PVS-scoped Backend `GET /v1/products` proxy can proceed and is implemented. Do not complete the PVS-scoped client/submission Backend adapters by trusting a browser-supplied `pvsId`. The service interfaces accept canonical `pvsId`, but Backend adapters remain blocked until the source of authorized PVS context and its validation rule are defined. This may require a future clarification or an explicit UI/authentication integration decision, despite UI changes being out of scope.

## Open Release Gates

1. Progressively obtain `Submission.php`, `LimsApiClient.php`, current lifecycle callers, and an authoritative LIMS contract or verified test environment; make each affected operation depend on its own verified contract task rather than gating all implementation.
2. Confirm the private Backend-to-service route, security-group rules, Backend/service IAM roles and permissions for AWS resources, and network controls restricting LIMS access to the service. Record accountable risk acceptance for the network-only caller trust boundary. Configure trusted CA material only when the LIMS endpoint enables HTTPS.
3. Before production release, record accountable risk acceptance and mitigations for the current unencrypted HTTP endpoint; remove this exception when the LIMS client enables HTTPS.
4. Confirm LIMS reconciliation/idempotency support for a lost first-draft-create response and agree the operational reconciliation procedure.
5. Confirm the hosting team's approved availability/latency objectives and request/payload limits; the feature defines no new numeric SLO.
