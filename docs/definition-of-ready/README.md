# Definition of Ready

## ADTS Definition of Ready for Ticket

### Core principle

A ticket is ready when a developer could pick it up and make progress without needing to stop and chase anyone.

## 1. Purpose

Definition of Ready (DoR) is the team’s agreed contract for what a ticket must contain before it enters a sprint. It ensures every ticket brought into a sprint has been thought through sufficiently to be worked on without avoidable interruption.

DoR applies at refinement. A ticket that fails any check returns to refinement rather than entering the sprint. The team may choose to accept a specific gap by explicit decision, with the risk documented on the ticket, but this is a conscious call, not a default.

## 2. When and how to apply

- Applied in refinement sessions before sprint planning.
- Applied by the whole team: Product/BA, developer, QA, architect where relevant.
- Failed checks return the ticket to refinement; the ticket does not enter the sprint.
- Explicit team-agreed exceptions are permitted but documented on the ticket with the accepted risk.

## 3. The 9 checks

Nine items across three groups.

### Group A — Business clarity

Do we know what we’re building and why?

| # | Check | Why it matters |
|---|---|---|
| 1 | Story is written in “As a [role], I want [something], so that [reason]” form. | Names who wants it and why. A weak or missing “so that” often reveals the story should not exist as written. |
| 2 | Acceptance criteria are in Given / When / Then form, one AC per distinct behaviour. | Structured, independently verifiable ACs. ACs with “and also” clauses should be split so each behaviour has its own AC. |
| 3 | BA or product owner has confirmed the ticket accurately reflects the business intent. | One tick or comment from the BA on the ADO ticket. Catches misinterpretation before development time is spent. |

### Group B — Testability and quality

Can we know when it’s done?

| # | Check | Why it matters |
|---|---|---|
| 4 | QA has confirmed the acceptance criteria are testable and each AC can be independently verified. | If an AC can only be verified by “check with the BA later,” it is not testable. Rewrite before sprint entry. |
| 5 | Test types applicable to the story are identified, such as unit, integration, contract, E2E or NFT where relevant. | A one-line note is enough. Shapes developer estimation and QA capacity planning; prevents “who was going to test this?” late in sprint. |
| 6 | Non-functional considerations are called out where relevant, including accessibility, performance and security. | Prevents NFRs being remembered only at PR time when rework is expensive. |

### Group C — Deliverability

Can we actually start?

| # | Check | Why it matters |
|---|---|---|
| 7 | External dependencies are identified. Where unresolved, the workaround for the sprint is documented on the ticket. | Prevents surprise mid-sprint when a dependency turns out to be unavailable or unresolved. |
| 8 | Stories are roughly sized by the team using T-shirt sizing. | To ensure it fits the sprint. |
| 9 | All related documents are linked to the ticket where relevant. | Reader can find related context without hunting. |

## 4. What DoR is not

| Excluded item | Rationale |
|---|---|
| Technical design complete | Belongs in `/plan` under SDD, or in-flight developer work in a traditional approach. |
| UI mockups attached | Only required for UI stories. |
| Test cases written | This is DoD territory. Testability confirmation at DoR is sufficient; the tests themselves are written during development. |
| Story point estimate agreed to within a narrow tolerance | Rough sizing is enough at DoR. Precision serves capacity planning, not sprint readiness. |
| All ACs signed off by multiple stakeholders | One BA/PO confirmation is enough for most stories. |
| Sprint capacity available | That is a sprint planning decision, not a DoR decision. |

## 5. Exceptions and escalation

- A ticket may enter a sprint with one or more DoR items unmet only by explicit team agreement, with the accepted risk documented in the ticket.
- Any ticket entering a sprint under exception is flagged in sprint planning and reviewed in the retrospective.
- Persistent DoR failures on the same category of items, for example external dependencies repeatedly unresolved, are surfaced to the PM as a systemic risk, not treated as a per-ticket problem.
- Emergency or hotfix work follows a separate lightweight process defined outside this document.

## 6. Ownership and location

- Owner: BA/Product.
- This markdown file is maintained in the repository so the development team can keep it current.

## 7. Review cadence

- Reviewed at every sprint retrospective.
- Track the DoR exception rate. If too many tickets enter sprints under exception, either the checklist is wrong or refinement is broken. Address this in retro.

## 8. Applying in Azure DevOps

- Add a “Definition of Ready” section to the ADO ticket description template, with checkboxes matching the nine items.
- Refinement session walks through each ticket and ticks off items live in the meeting. Tickets failing checks return to refinement.
- Where an exception is agreed, note the accepted risk in the ticket comments so it is visible during sprint planning.