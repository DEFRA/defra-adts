# Test Strategy

## ADTS Shift-Left and Continuous Testing Strategy

Version 1.3 · 2026

## 1. Overview and purpose

This document defines the Shift-Left, automation-first, AI-augmented testing strategy for the modernisation of ADTS.

Quality is built continuously. It is not checked at the end. Every sprint should produce working, tested, deployable software with automated evidence of quality, supported by continuous testing in the CI/CD pipeline.

## Core principle

Testing is a team sport.

- Developers own unit and component quality.
- Engineers-in-test own the automation framework and journey coverage.
- The whole team owns the pipeline.
- AI augments testing activity but does not replace human judgement.

## 2. Test pyramid

The test pyramid defines the priority and volume of tests at each layer. Tests at the base are fast, cheap and plentiful. Tests at the top are slower, more expensive and focused on high-value user journeys.

### Layer 1 — Unit and component tests

Approximate volume: 70 percent of tests.

Purpose:

- Test functions, modules, components and class-level behaviour in isolation.
- Mock dependencies.
- Provide fast feedback on every commit.

Targets:

- At least 80 percent statement coverage.
- At least 70 percent branch coverage.
- Full unit and component suite should run in under 3 minutes on every commit.

### Layer 2 — API and contract tests

Approximate volume: 15 percent of tests.

Purpose:

- Validate interfaces between ADTS services and external dependencies.
- Cover LIMS, Customer Identity, Entra ID and Graph API.
- Validate APIs against OpenAPI where applicable.
- Use mocks for LIMS API and Graph API.

### Layer 3 — Integration tests

Approximate volume: 8 percent of tests.

Purpose:

- Test how services work together inside the ADTS boundary.
- Cover DynamoDB access patterns, event flows and AWS service integrations.
- Validate container health, environment variables, secret injection and service behaviour.

### Layer 4 — Journey and E2E tests

Approximate volume: 5 percent of tests.

Purpose:

- Test critical end-to-end paths through the service.
- Keep this layer small because it is expensive to run and maintain.

Example scope:

- Authentication
- Dashboard
- Start submission
- Submission steps 1 to 8
- Review
- Submit
- View results

Accessibility checks should be embedded into critical journey tests.

### Layer 5 — Exploratory and UAT

Approximate volume: 2 percent of tests.

Purpose:

- Use human judgement for edge cases, exploratory testing and business sign-off.
- AI may assist with test idea generation, but decisions remain human-owned.

## 3. Non-functional testing

Non-functional testing sits outside the functional pyramid but is mandatory before environment promotion.

| Area | When | Gate |
|---|---|---|
| Performance load | Pre-UAT gate | P95 under 2s, error rate under 1 percent |
| Performance soak | Pre-production | No memory leak over 2-hour run |
| Accessibility | Every PR | 0 critical WCAG 2.2 AA violations |
| Visual regression | Every PR | 0 unapproved visual diffs on key GOV.UK pages |
| SAST | Every PR | 0 critical or high findings |
| DAST | Release pipeline | 0 critical findings, high findings reviewed |
| WAF rule testing | Release pipeline | OWASP Top 10 probes blocked |
| Container scan | Build stage | 0 critical CVEs |

## 4. Accessibility testing

ADTS must meet WCAG 2.2 AA. Accessibility is treated as a first-class non-functional concern.

Accessibility testing includes:

- Automated unit-level checks using axe-core or Jest-axe.
- Automated E2E checks using axe with Playwright.
- Pa11y CI checks against staging URLs.
- Manual keyboard testing for each new journey.
- Manual screen reader testing before release.

Gate thresholds:

- 0 critical or serious axe-core violations on merged PRs.
- 0 critical Pa11y findings at sprint regression.
- Critical journeys keyboard-navigable end-to-end.
- Screen reader behaviour verified for error summaries, form labels, status changes and dynamic content.

## 5. Security testing

Security testing is multi-layered, automated where possible and aligned with Defra standards and OWASP Top 10.

Security layers include:

| Layer | Tooling | Trigger | Gate |
|---|---|---|---|
| SAST primary | SonarCloud | Every PR and main branch | Quality Gate pass |
| SAST complementary | Semgrep OSS | Every PR | 0 high or critical findings |
| Secret scanning | gitleaks, GitHub secret scanning, Semgrep | Every PR and push | 0 secrets in changed files |
| Dependency scanning | Dependabot and OSV-Scanner | Daily and on PR | 0 critical CVEs introduced |
| Container scanning | Trivy and/or Snyk | Image build | 0 critical CVEs |
| IaC scanning | Checkov | IaC change | 0 critical misconfigurations |
| DAST | OWASP ZAP | Sprint regression and pre-release | 0 high-risk findings |
| WAF rule testing | OWASP Top 10 payload set | Pre-release and WAF changes | Malicious payloads blocked |

## 6. Test environments and data

| Environment | Purpose | Tests run | Data |
|---|---|---|---|
| Developer local and CI | Fast feedback during build | Unit, component, SAST, IaC scan, contract on PR | Mocked, in-memory and synthetic |
| Test | Integrated system testing | API regression, journey E2E, accessibility | Pseudonymised or synthetic |
| Preprod | UAT and pre-release validation | Business UAT, NFT, accessibility, smoke | Anonymised prod-like |
| Prod | Business sign-off | Guided and automated evidence | Anonymised prod-like |

## 7. Test data strategy

The test data approach is synthetic-first.

Principles:

- Use realistic but fictitious vets, practices, animals and submissions.
- Seed DynamoDB to a known state before each suite.
- Use a unique test-run ID to prevent cross-test pollution.
- Do not use production PII in pre-production environments.
- Do not use live data to train, fine-tune or prompt AI agents in the pipeline.

## 8. Critical journey scenarios

Priority E2E journeys include:

- J01 — Vet logs in, starts sick animal submission, completes all 8 steps, submits and receives confirmation.
- J02 — Multi-lab routing for a mixed test basket.
- J03 — Draft resume after logout and login.
- J04 — Admin impersonation.
- J05 — Registration and activation email via Graph API.
- J06 — Results download.
- J07 — Session expiry and draft preservation.
- J08 — First-login organisation creation and LIMS validation.
- J09 — LIMS ID revocation and access denial.

## 9. Quality metrics and reporting

Metrics should be reported automatically through the CI/CD pipeline and reviewed in sprint retrospectives.

| Metric | Target |
|---|---|
| Automation coverage | At least 80 percent unit, 90 percent API and 100 percent critical journeys |
| Defect leakage | Under 5 percent escape to UAT |
| Build health | Over 95 percent green builds |
| P95 latency | Under 2s normal, under 4s at 2x load |
| Accessibility | 0 critical issues |
| Security posture | 0 critical or high open at release gate |
| Flaky-test rate | Under 2 percent of the suite |

## 10. Implementation roadmap

| Sprint | Theme | Key activities |
|---|---|---|
| Sprint 0 to 1 | Foundations | DoR/DoD agreed, CI skeleton, unit and journey runners configured, SAST and IaC scan on PR |
| Sprint 2 to 3 | API and contract | API test scaffolding, consumer contracts, service mocking, accessibility checks in CI |
| Sprint 4 | E2E journeys | Journey tests, performance baselines, k6 or equivalent load profiles |
| Sprint 5 to 6 | NFT and security | DAST, WAF tests, resource limits, synthetic monitors |
| Sprint 7 | AI capabilities | PR risk scoring, risk-based test selection, flaky-test triage |
| Sprint 8 | Release readiness | Release evidence pack automation, feature flag coverage, pre-prod smoke suite |
| Sprint 9 onwards | Operate and improve | Capability review and feedback from production incidents |

## 11. Repository structure

Service-owned tests should live close to the service code.

Examples:

- `services/adts-backend/tests/unit`
- `services/adts-backend/tests/integration`
- `services/adts-backend/tests/contract`
- `services/adts-ui/tests/unit`
- `services/adts-ui/tests/component`

Cross-service and environment-level tests should live under the root `tests` folder.

Examples:

- `tests/api`
- `tests/e2e/smoke`
- `tests/e2e/journeys`
- `tests/mocks`

## 12. Pipeline approach

Service-level tests should run through `_validation.yml`.

Environment-level API and E2E smoke tests should run later through deployment or release workflows once a deployed environment URL is available.

## 13. Living document

This strategy is a living artefact. It should be reviewed and updated at the start of each sprint cycle and following any significant architecture, tooling or AI capability change.