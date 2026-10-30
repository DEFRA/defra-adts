# Quickstart: Submission Service Validation

This guide validates the planned Backend-to-Submission-Service-to-LIMS boundary. It uses synthetic data and a mocked LIMS by default. Never use production credentials or real submission data in local tests.

## Prerequisites

- Node.js 24 and npm dependencies installed for the repository and services.
- The full draft and LIMS response contract has been verified before attempting live LIMS validation.
- For local API tests, use the repository's LIMS mock or Jest mock transport.
- For an environment test, obtain a platform-issued Backend caller identity and inject LIMS credentials through the approved secret mechanism. Do not put credentials in command history, source files, URLs, or logs.
- If the LIMS environment uses an approved private CA, configure the runtime trust store or `NODE_EXTRA_CA_CERTS`; never disable TLS verification.

## Configuration

Use the service's validated environment configuration. Expected settings include:

- `PORT`: local service port (existing service convention; use `9180` unless a test harness chooses another port).
- `LIMS_BASE_URL` and `LIMS_PREFIX`: environment-specific LIMS origin and API prefix.
- LIMS authentication values: injected from the approved runtime secret provider; exact variable names follow the implementation's config contract.
- LIMS request deadline: configurable; proposed default is 10 seconds.
- Backend caller authentication: configured to the runtime platform identity issuer/audience or approved mTLS trust. Exact platform settings are a release gate.

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
3. A complete valid draft is mapped and sent; a confirmed save returns the LIMS draft ID.
4. Confirmation returns a submission ID only after confirmed LIMS success. Cancellation business errors remain errors even when the LIMS HTTP status is successful.
5. A timeout after create, confirm, or cancel returns `outcome_unknown`, makes only one upstream attempt, and does not claim success. Tests prove that the caller is directed to reconcile before retrying.
6. Validation failures, unauthenticated callers, LIMS credential rejection, upstream business errors, upstream HTTP errors, transport errors, timeout, and unavailable LIMS are distinguishable.
7. Process health and readiness remain available when LIMS is down; the separate LIMS probe reports dependency failure and uses configured credentials/TLS rather than a caller-supplied host.
8. Tests fail if an authorization header, secret, sensitive payload, or raw upstream body appears in logs or normalized errors.
9. Latest released results/charges, release summaries, and reports preserve the verified required fields and media type.
10. A Backend-to-service integration test proves that only the Submission Service is configured to contact LIMS and that the Backend authenticates to the service without LIMS credentials.

## Local Smoke Test

After implementation, start the mock LIMS and service using test-only credentials in the environment. Confirm:

```sh
curl -i http://localhost:9180/health
curl -i http://localhost:9180/ready
curl -i http://localhost:9180/health/lims
```

Expected: `/health` reports process health; `/ready` reports startup/config readiness without relying on LIMS; `/health/lims` independently reports configured LIMS connectivity. Protected domain routes must reject calls without an authenticated Backend identity and accept only a valid test identity.

## Evidence To Record

- Unit, integration, contract, and affected E2E results in the required order.
- New-code coverage result and any approved exception.
- Exact authoritative source/version used for the LIMS contract and a record of resolved discrepancies.
- Runtime identity, secret injection, CA trust, and timeout configuration approved by the platform owner.
- Evidence that no LIMS credentials or sensitive submission data are emitted in logs.
