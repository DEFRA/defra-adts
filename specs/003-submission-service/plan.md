# Implementation Plan: ADTS Submission Service

**Branch**: `[feature/submisssion-service]` | **Date**: 2026-10-30 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/003-submission-service/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Extend the existing independently published `adts-submissions-service` into the sole ADTS LIMS integration boundary. Keep a versioned, domain-oriented REST API for the Backend, map its stable identifiers and filters to the observed LIMS contract internally, and normalize LIMS responses and failures. Keep Backend-owned local draft search/persistence separate from LIMS draft records and IDs. Do not add service-owned persistence or asynchronous processing.

## Technical Context

**Language/Version**: JavaScript, Node.js 24 (existing container base is Node 24.21.0)

**Primary Dependencies**: Existing Hapi 21 and Joi 18; Node.js built-in `fetch` and `AbortSignal` for outbound HTTP and deadlines. Prefer existing dependencies unless a verified contract need requires another package.

**Storage**: No Submission Service-owned storage. LIMS owns LIMS records. Existing Backend/DynamoDB draft search remains outside this service and is not redesigned by this feature.

**Testing**: Jest 30 service tests, API contract tests, cross-service integration tests, and existing Playwright E2E. Constitution requires unit, then integration, then E2E, with at least 90% coverage for new code.

**Target Platform**: Independently built Linux container published through the existing ECR workflow. Runtime deployment and secret-injection manifests are not present in this repository and must be confirmed with the hosting team before release.

**Project Type**: Independently deployable REST web service in the existing monorepo.

**Performance Goals**: No feature-specific numeric availability or response-time targets. Validate functional acceptance and provide operational monitoring; apply approved ADTS/platform objectives when identified.

**Constraints**: Only this service communicates directly with LIMS; TLS verification stays enabled; host, prefix, credentials, caller authentication, and deadlines are configured outside source; secrets and sensitive payloads are not logged. Do not automatically retry state-changing calls or ambiguous creates. Preserve LIMS semantics without exposing LIMS naming inconsistencies. Confirm each operation's schema before implementing it; independent scaffolding and verified operations can proceed while other schema discovery continues.

**Scale/Scope**: Product/client/practice lookups, submission search/view, draft lifecycle, addresses, released results/charges, summaries, and reports. Request volume and payload limits are not established; verify with the service owner and LIMS before deployment rather than inventing feature targets.

## Constitution Check

*GATE: Pass before Phase 0 research; re-evaluate after Phase 1 design.*

- **Independent deployment: PASS.** Extend the existing separately built/published container and maintain an explicit Backend-facing interface; do not couple the service into the Backend process.
- **Security and privacy: PASS WITH RELEASE GATE.** Require authenticated Backend callers, configurable LIMS credentials, validated TLS, least privilege, and sanitized errors/logs. No runtime secret-injection or service-auth mechanism exists in tracked deployment configuration; the hosting team must confirm secure secret delivery and rotation before release.
- **Reliability and operability: PASS.** Keep process health separate from configured LIMS connectivity, use bounded outbound deadlines, distinguish failure categories, and log safe diagnostic identifiers without request payloads or credentials.
- **Testing: PASS.** Add unit/contract, integration, and affected E2E coverage in that order. Meet the constitution's 90% new-code coverage requirement and record evidence. The test strategy's lower general coverage targets do not override the constitution.
- **Accessibility and design system: PASS / NOT DIRECTLY APPLICABLE.** This is a service API with no UI changes. Preserve existing UI journeys and run affected E2E checks; no new user-facing component is introduced.
- **Data boundaries: PASS.** Do not add service persistence or asynchronous work. Keep Backend-local ADTS drafts distinct from LIMS draft records and identifiers; confirm the distinction against authoritative legacy behavior as the related tasks progress.

## Project Structure

### Documentation (this feature)

```text
specs/003-submission-service/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/submission-service-api.yaml
```

### Source Code (repository root)

```text
services/adts-submissions-service/
├── src/
│   ├── app.js                 # Hapi server and route registration
│   ├── config.js              # Validated service and LIMS configuration
│   ├── auth/                  # Backend caller authentication
│   ├── clients/               # LIMS HTTP transport and endpoint mapping
│   ├── errors.js              # Stable error categories and safe mapping
│   └── routes/                # Health, reference data, submission lifecycle, results
└── tests/
    ├── unit/
    ├── routes/
    ├── contract/
    └── integration/

services/adts-backend/
└── src/app.js                 # Adapt existing proxy routes to the domain contract
```

**Structure Decision**: Extend the existing Submission Service and its Jest route/unit/integration test layout. Separate configuration, caller authentication, LIMS transport/mapping, error normalization, and route registration within the service as the contract grows. Update only Backend adapters and tests needed to consume the new API; no UI route or service is added. Runtime deployment wiring remains a release gate because no runtime manifests are tracked.

**Post-Design Constitution Check**: PASS WITH RELEASE GATES. The proposed API preserves independent service deployment and separates health from LIMS connectivity. Security controls require authenticated Backend identity, verified TLS, runtime-managed credentials, and safe diagnostics. Contract and integration tests plus the mandated coverage threshold are included in validation. Resolve platform identity/secret/CA configuration before release. Confirm each operation against authoritative LIMS and legacy evidence before implementing that operation, and verify reconciliation behavior before release; these are external prerequisites, not waived constitutional requirements.

