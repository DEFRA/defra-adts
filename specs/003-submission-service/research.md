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

### 4. Authenticate Backend callers using platform-backed workload identity

**Decision**: Require a verifiable service identity for every non-health Backend operation. Prefer the hosting platform's approved workload-token or mutual-TLS identity mechanism, with the service validating the caller and the Backend remaining responsible for PVS authorization. Do not introduce a hard-coded or long-lived static shared token. Health probes must be restricted by network/platform policy and must not expose secrets.

**Rationale**: No existing application service-auth implementation or runtime deployment/secret-injection manifest is tracked. CI's AWS OIDC role is only for image publication and is not runtime service authentication.

**Alternatives considered**: Trust network location alone (rejected as insufficient caller authentication); accept a static token in source or configuration with no rotation plan (rejected); select a specific token issuer/library before the runtime platform is known (deferred).

**Release gate**: The hosting/platform owner must identify the supported identity issuer or mTLS trust configuration, token audience/claims or client identity, rotation, and runtime injection before implementation is released. The Hapi authentication integration must remain replaceable until that platform contract is supplied.

### 5. Use configured LIMS credentials and verified TLS

**Decision**: Configure the LIMS origin and prefix per environment, retrieve LIMS credentials from the approved runtime secret provider, and use authenticated HTTPS with normal certificate and hostname verification. Trust a custom CA only through the approved runtime CA configuration. Never disable verification or log credentials, authorization headers, full request bodies, or sensitive response bodies.

**Rationale**: The reference documents legacy Basic Authentication and explicitly identifies disabled certificate validation as a defect. The current service uses global `fetch` without authentication or custom TLS handling. No production secret or custom-CA deployment pattern is present in the repository.

**Alternatives considered**: Copy the legacy disabled verification (rejected as insecure); embed secrets or include them in URLs (rejected); invent a production secret-store mapping without runtime manifests (deferred to platform integration).

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

**Decision**: Keep `/health` as a process-only probe; provide readiness that checks service configuration/startup dependencies without requiring LIMS; expose a separate LIMS connectivity check using configured host, credentials, TLS, and a bounded deadline. Return an unavailable status for failed LIMS connectivity without changing process health.

**Rationale**: Existing `/health` is process-only, but `/connection_health` accepts caller-supplied protocol/host/port and returns failures with HTTP 200. The feature requires health checks not to collapse service and LIMS state.

**Alternatives considered**: Make process readiness depend on LIMS (rejected because a LIMS outage would remove a functioning service from the platform); accept arbitrary health-check destinations (rejected because it is not a configured dependency check and creates an unnecessary outbound request surface).

### 10. Follow repository test patterns and the stronger constitutional gate

**Decision**: Use Jest and the existing service pipeline, adding unit, route/API contract, LIMS-mock integration, and cross-service tests. Run tests in constitution order: unit, integration, then affected end-to-end. Demonstrate at least 90% coverage for new code; the constitution's 90% requirement takes precedence over lower general targets in the repository test strategy.

**Rationale**: The service already uses Jest and CI coverage, and the constitution sets a binding minimum.

**Alternatives considered**: Add a second test framework (rejected); rely only on proxy tests that mock arbitrary JSON (rejected because they do not prove the LIMS contract).

## Open Release Gates

1. Progressively obtain `Submission.php`, `LimsApiClient.php`, current lifecycle callers, and an authoritative LIMS contract or verified test environment; make each affected operation depend on its own verified contract task rather than gating all implementation.
2. Confirm platform workload identity, runtime LIMS secret delivery/rotation, and any trusted CA configuration.
3. Confirm LIMS reconciliation/idempotency support for a lost first-draft-create response and agree the operational reconciliation procedure.
4. Confirm the hosting team's approved availability/latency objectives and request/payload limits; the feature defines no new numeric SLO.
