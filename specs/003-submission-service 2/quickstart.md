# Quickstart: Submission Service Validation

This guide validates the planned Backend-to-Submission-Service-to-LIMS boundary. It uses synthetic data and a mocked LIMS by default. Never use production credentials or real submission data in local tests.

## Prerequisites

- Node.js 24 and npm dependencies installed for the repository and services.
- Verify an operation's request/response contract against the uploaded release 12.1.6 legacy reference before exercising that operation against a LIMS test environment. Confirm LIMS-only unknowns with the LIMS owner; unrelated operations can proceed independently.
- For local API tests, use the repository's LIMS mock or Jest mock transport.
- Use synthetic `PVS001` only in isolated tests. Do not configure a production default PVS or treat a browser-provided PVS as authorized.
- For an environment test, use the Backend workload over the approved private HTTPS route and inject LIMS credentials through the approved secret mechanism. The initial release does not verify per-request SigV4 identity; network policy/security groups are the access boundary. Do not put credentials in command history, source files, URLs, or logs.
- Current production LIMS uses HTTP under the temporary exception in FR-011. HTTP does not encrypt credentials or submission data. Use only the configured LIMS origin, record the accountable risk acceptance and mitigations before production release, and remove this exception when LIMS HTTPS is enabled.
- When LIMS HTTPS is enabled, configure any approved private CA through the runtime trust store or `NODE_EXTRA_CA_CERTS`; always validate certificate and hostname. Never disable TLS verification.

## Configuration

Use the service's validated environment configuration. Expected settings include:

- `PORT`: local service port (existing service convention; use `9180` unless a test harness chooses another port).
- `LIMS_BASE_URL` and `LIMS_PREFIX`: environment-specific LIMS origin and API prefix.
- LIMS authentication values: injected from the approved runtime secret provider; exact variable names follow the implementation's config contract. Do not send these to any origin other than the configured LIMS endpoint.
- LIMS request deadline: configurable; proposed default is 10 seconds.
- Backend-to-service access: HTTPS on a private AWS route restricted to the Backend workload by network policy/security groups. No SigV4 check is performed by the initial service release. IAM roles grant workload access to AWS resources but do not authenticate incoming HTTP requests.

Do not start live LIMS calls until the service owner confirms endpoint, credentials, CA trust, and test-data restrictions.

## Local Validation

From the repository root:

```sh
npm ci --prefix services/adts-submissions-service
npm run lint --prefix services/adts-submissions-service
npm run test:coverage --prefix services/adts-submissions-service
npm run build --prefix services/adts-submissions-service
```

Run the unit tests before integration tests, then run the cross-service/E2E checks after the corresponding implementation is integrated:

```sh
npm run test:integration --prefix services/adts-submissions-service
npm run test:e2e -- --project=chromium
```

The service's coverage command must include unit, route, contract, and integration tests and demonstrate at least 90% coverage of new code, per the constitution. Update the script if the current command omits a test directory.

## Acceptance Scenarios

Run these against the mock transport and assert status, response body, outbound LIMS request, and safe logs:

1. Product, client, PVS, submission ID, and submission searches preserve supported filters and map legacy parameter spellings only inside the service.
2. Draft and submitted records remain distinguishable; draft address lookup includes its required draft identifier.
3. A valid draft contains exactly the 52 legacy serialized top-level keys documented in [data-model.md](data-model.md); nested animals and products retain the documented row-index, tag, sample, package, and option fields. LIMS-specific acceptance rules remain separate from this legacy shape.
4. An initial draft save sends `draftSubmissionId: null` and returns the LIMS `draftSubmissionId`; updates send the existing ID. The legacy caller saves partial drafts repeatedly, so the mock supports repeated saves without asserting LIMS idempotency.
5. Before confirmation, the caller saves the full draft. Confirmation maps `{draftId, pvsId}` to `{draftSubmissionId, pvsId}` and returns a submission ID only after confirmed LIMS success. Cancellation maps a draft or submission target to LIMS `submissionDraftId`; business errors from `hasErrors`/`errorMessages` remain actionable even when LIMS returns HTTP success.
6. A timeout after create, confirm, or cancel returns `outcome_unknown`, makes one upstream attempt, and never claims success. Reconciliation method remains an LIMS-owner question.
7. Validation failures, LIMS credential rejection, upstream business errors, upstream HTTP errors, transport errors, timeouts, and unavailable LIMS are distinguishable.
8. Process health and readiness remain available when LIMS is down; the separate LIMS probe uses the configured LIMS origin and does not accept a caller-supplied host.
9. Logs and normalized errors contain no credentials, authorization data, request payloads, or raw upstream bodies; allowlisted LIMS business messages remain useful and credential-shaped content is redacted.
10. Latest results preserve legacy fields used by the report view, including `Sections`, `VioComment`, `WorkInProgress`, `Charges`, and `samples`.
11. The LIMS report operation returns JSON with `LastReportString`; the service decodes its base64 PDF and serves it inline as `application/pdf` without a filename header. Empty or malformed report data is an error, not a successful empty document.
12. Cross-service tests use a private HTTPS service URL; production access is restricted by network policy/security groups. They do not assert request-level SigV4 authentication, which is not in this release.

## Local Smoke Test

After implementation, start the mock LIMS and service using test-only credentials in the environment. Confirm:

```sh
curl -i http://localhost:9180/health
curl -i http://localhost:9180/ready
curl -i http://localhost:9180/health/lims
```

Expected: `/health` reports process health; `/ready` reports startup/config readiness without relying on LIMS; `/health/lims` independently reports configured LIMS connectivity. In production, the private route/security-group policy permits Backend workload access and blocks other network sources. The service itself does not establish per-request Backend identity in this release.

## Evidence To Record

- Unit, integration, contract, and affected E2E results in the required order.
- New-code coverage result and any approved exception.
- Exact authoritative source/version used for the LIMS contract and a record of resolved discrepancies.
- Runtime identity, secret injection, CA trust, and timeout configuration approved by the platform owner.
- Evidence that no LIMS credentials or sensitive submission data are emitted in logs.
