# Definition of Done

## ADTS Definition of Done for Ticket

Ticket-level DoD — v1.0

Applied at pull request (PR) merge and at sprint end; complementary to the ticket-level Definition of Ready (DoR).

## Core principle

A ticket is Done when the change is safely merged, quality-assured, deployed to Test, evidenced against its acceptance criteria, and is ready for stakeholder to test or inspect.

Definition of Done is the team’s minimum quality bar to mark a ticket as Done.

## 1. Purpose

Definition of Done (DoD) is the team’s agreed contract for what a ticket must have achieved before it can be considered complete. It ensures every ticket claiming “done” has met the same quality bar, regardless of who worked on it.

DoD applies at pull request merge for story-level checks and at sprint end for aggregated checks.

A ticket that does not meet DoD is not Done. It remains open, is moved back into progress, or is explicitly agreed as an exception with the accepted risk documented.

DoD is the companion to Definition of Ready. DoR asks “can we start?”; DoD asks “are we finished?” Both are needed to protect sprint predictability.

## 2. When and how to apply

- Story-level DoD is applied at pull request review.
- A PR is not merged until every check is met or explicitly waived.
- Sprint-level DoD is applied at sprint end.
- Any story not meeting DoD does not count toward the sprint’s completed velocity.
- Release-level DoD is applied at each release gate to Preprod, in preparation for handover to Defra.
- Enforcement is shared by all Engineers including Dev, QA and DevOps.
- Explicit team-agreed exceptions are permitted but documented on the ticket with the accepted risk.

## 3. The ten story-level checks

Ten items across three groups.

### Group A — Implementation and tests

Has the story been built and tested to the required standard?

| # | Check | Why it matters |
|---|---|---|
| 1 | All acceptance criteria are implemented and verified by automated tests. | The AC set is the story’s contract. Every AC must be provably met; no AC is verified by “works on my machine” or manual spot check alone unless explicitly agreed at DoR. |
| 2 | Tests at each relevant layer are written and passing, including unit, integration, contract, E2E and NFT as scoped in the DoR. | Test types identified at DoR must actually be delivered. Coverage skipped at one layer is not compensated for by more coverage at another. |
| 3 | Coverage thresholds are met on new and modified code: at least 80% statement and at least 70% branch. | The team’s minimum coverage bar as agreed by the team and the SonarCloud Quality Gate threshold. Enforced by CI; PR blocked otherwise. |
| 4 | Test files carry traceability headers referencing source AC or spec. SDD stories use `@specRef`; traditional stories use `@acs` or `@story`. | Traceability is required for audit, defect investigation and TDA evidence. Enforced by CI check on merged test files. |

### Group B — Quality gates green

Have the automated gates all passed?

| # | Check | Why it matters |
|---|---|---|
| 5 | SonarCloud Quality Gate passed: 0 new bugs, 0 new vulnerabilities, 0 new security hotspots and coverage threshold met. | The Defra-mandated primary quality gate. |
| 6 | Security scans clean: no new critical or high findings across Semgrep, Trivy for containers, gitleaks for secrets, and Dependabot or OSV for dependencies. | Security scanning is required per the test strategy. Findings block merge; medium and below are tracked and triaged. |
| 7 | Accessibility clean on affected pages: 0 critical or serious axe-core violations. | WCAG 2.2 AA is mandatory and applies to any story with UI changes. |
| 8 | Non-functional checks are green where applicable to the story, including performance targets for hot-path changes and resilience checks for integration-touching changes. | NFRs identified at DoR must be verified at DoD. Not every story triggers this check; those that do must pass. |

### Group C — Review, integration and evidence

Has the change been reviewed, integrated and its completion recorded?

| # | Check | Why it matters |
|---|---|---|
| 9 | Peer code review approved by a Developer other than the author; QA test review approved by SDET; CODEOWNERS approvals in place. | Human review complements automated gates. Peer review catches design and readability issues; QA test review catches weak or shallow tests that pass without verifying behaviour. |
| 10 | Merged to main, deployed to Test/dev environment, and smoke-tested with no Severity 1 or Severity 2 defects introduced; ADO ticket updated with test evidence link and closed. | “Done” means integrated, not just merged. Smoke testing proves the change survives deployment and does not break the wider service. The ticket update makes completion visible and traceable. |

## 4. Release-level Definition of Done

A release is Done when it is ready for Defra to promote to Production. This is the handover gate that complements story-level DoD.

| # | Check | Why it matters |
|---|---|---|
| R1 | All in-scope stories meet story-level DoD. | The release aggregates story-level completion; no story enters a release without meeting story-level DoD. |
| R2 | Non-functional test suites passing in Preprod: performance load, performance soak, security including DAST and WAF, and accessibility. | Sprint-level story DoD covers unit and component NFRs; release-level DoD covers full end-to-end NFT that only makes sense at Preprod scale. |
| R3 | Release evidence pack complete: test results, coverage, WCAG conformance statement, performance baselines, security scan outcomes, open-defect status and DR regression pack results if applicable. | The evidence pack is the handover artefact for Defra. |
| R4 | Documentation updated: README, runbooks, ADRs, test strategy and IT Service Continuity Plan for DR-affecting changes. | Documentation supports Defra operational takeover post-handover. Missing documentation creates operational risk. |
| R5 | Preprod-to-Prod handover briefing delivered to the Defra team; handover checklist signed. | Handover is an active exchange, not a document drop. Briefing ensures Defra ops know what they are receiving and how to operate it. |

## 5. What DoD is not

| Excluded item | Rationale |
|---|---|
| Zero defects of any severity | Severity 1 and Severity 2 defects block DoD; Severity 3 and Severity 4 are tracked and triaged. Requiring zero defects at any severity is unrealistic and encourages under-reporting. |
| Business sign-off per story | Business sign-off happens at end-of-sprint demo. Requiring per-story business sign-off breaks iterative delivery and creates a bottleneck on the BA/product owner. |
| Deployment to Preprod or Production | Story-level DoD ends at deployment to Test. Preprod deployment is release-level. Production deployment is Defra-owned post-handover. |
| Perfect documentation | Only essential documentation updates are required at story-level DoD, such as test evidence links on tickets and code comments where non-obvious. Wider documentation belongs to release-level DoD. |
| Full end-to-end regression per story | Story-level DoD requires the relevant test layers identified at DoR. Full regression runs at release-level in Preprod, not on every PR. |

## 6. Exceptions and escalation

- A ticket may be closed with one or more story-level DoD items unmet only by explicit team agreement, with the accepted risk documented on the ticket.
- A release may proceed with unmet release-level DoD items only by explicit sign-off from the PM and architect, with the accepted risk documented in the release notes.
- Any story or release closed under exception is flagged in the retrospective for review.
- Persistent DoD failures on the same category of items, for example coverage repeatedly below threshold or accessibility repeatedly failing, are surfaced to the PM as a systemic risk, not treated as a per-ticket problem.
- Emergency hotfixes follow a separate lightweight process defined outside this document, and are back-fitted to full DoD in the next planned sprint.

## 7. Ownership and location

- Owner: PM/BA.
- This markdown file is maintained in the repository so the development team can keep it current.

## 8. Review cadence

- Reviewed at every sprint retrospective.
- Track the DoD exception rate. If too many stories close under exception, either the checklist is wrong or engineering practice is drifting. Address this in retro.
- Track the ratio of story-level defects that escape to release-level testing. A rising escape rate is a signal that story-level DoD is too soft.

## 9. Evidence and traceability

Practical mechanics for making DoD compliance visible and auditable:

- CI pipeline enforces checks 3, 5, 6 and 7 automatically. PR is blocked on failure.
- Peer code review and QA test review are recorded through GitHub PR review approvals.
- CODEOWNERS defines required reviewers per code area.
- Smoke test result is recorded on the ADO ticket with a link to the CI run and Test environment verification.
- Test evidence link on the ticket points to the specific test run, such as Playwright report, Jest coverage report or k6 report where applicable, rather than a general dashboard.
- Release evidence pack is aggregated automatically from CI where possible.
- Manual items, such as accessibility and business sign-off, are tracked in the release checklist.

## 10. Applying in Azure DevOps

- Add a “Definition of Done” section to the ADO ticket description template, mirroring the ten story-level checks as a checklist.
- Ticket cannot be moved to Closed / Done status without all checkboxes ticked, or with an exception note recorded in the ticket comments.
- Sprint review walks through any tickets closed under exception.