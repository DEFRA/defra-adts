<!--
Sync Impact Report
Version change: 1.1.0 -> 1.2.0 (added discrete cloud-service architecture requirement)
Modified principles: none
Added sections: Service Architecture
Removed sections: none
Follow-up TODO: Confirm the original ratification date.
-->
# Animal Disease Testing Service Constitution

## Core Principles

### GOV.UK Design System by Default
All service interfaces and content MUST follow the current GOV.UK Design System
components, patterns, content guidance, and interaction conventions. A departure
MUST be necessary to meet a documented user need or technical constraint, and
MUST be reviewed for accessibility and consistency with the wider service.
This keeps the service familiar and usable for veterinary practices.

### Accessible and Inclusive Service
Every user journey MUST meet the applicable GOV.UK accessibility requirements
and WCAG Level AA success criteria. Teams MUST include automated checks and
manual keyboard and assistive-technology testing in relevant quality assurance.
Known barriers MUST be recorded and resolved or explicitly accepted by an
accountable service owner before release. This ensures veterinary practice
users can complete essential tasks regardless of ability or access needs.

### Privacy and Security by Design
The service MUST follow applicable law, government security requirements, and
DEFRA software standards for protecting data. Teams MUST apply least privilege,
minimise personal and sensitive data, and document data flows and security
risks for changes that affect data handling or access. Security and privacy
risks MUST be addressed before release or explicitly accepted by an
accountable risk owner.

### Quality, Reliability, and Operability
Changes MUST include proportionate automated tests for expected behaviour,
failure conditions, and relevant service integrations. Production services
MUST provide actionable monitoring and diagnostic information without
unnecessarily exposing personal or sensitive data. Release decisions MUST
consider the impact of failure on veterinary practice users and service
operations.

## Testing

Every change MUST progress through unit, integration, and end-to-end testing,
in that order. End-to-end tests MUST exercise the user journeys affected by the
change, and all applicable stages MUST pass before release. New code MUST meet
a minimum of 90% test coverage, measured using the project's configured
coverage tooling. Coverage results and any exception MUST be recorded in the
change review; an exception requires approval from an accountable service
owner before release.

## Service Architecture

Although this codebase is maintained as a monorepo, it contains discrete
services that MUST remain independently deployable to a cloud environment.
Services MUST communicate through explicit, maintained interfaces and MUST NOT
be coupled as parts of a single deployable monolithic application. Design,
testing, and release decisions MUST account for each service's deployment and
operational boundaries. This preserves independent service lifecycles while
allowing shared repository tooling.

## Standards and Technical Constraints

The service MUST conform to the GOV.UK Design System and the current DEFRA
Software Development Standards at
https://design-system.service.gov.uk and
https://defra.github.io/software-development-standards/. Applicable
legislation, government service and accessibility requirements, and approved
APHA policies also apply. Where standards conflict, teams MUST follow the
higher-priority legal or government requirement and document the decision.
Any exception to a standard MUST identify the requirement, rationale, impact,
mitigation, and accountable approver.

## Delivery and Compliance

Teams MUST identify relevant constitutional requirements during refinement and
show evidence of compliance in the change review. Evidence MUST be proportionate
to the change and include relevant design-system, accessibility, user
validation, domain, security, privacy, and test checks. Reviewers MUST resolve
or record any exception and its accountable approver before release. The
service team MUST revisit compliance when standards change and when material
service changes could affect users, data, or operational risk.

## Governance

This constitution governs product, design, engineering, testing, and operational
decisions for the Animal Disease Testing Service. Amendments MUST be proposed
with their rationale and impact, reviewed by the accountable service
stakeholders, and recorded in version control. A change that adds or materially
expands a principle or section increments the MINOR version; a backward
incompatible change to a principle or governance rule increments the MAJOR
version; a clarification or non-semantic refinement increments the PATCH
version. The version and amendment date MUST be updated with each approved
amendment.

Each change review MUST assess compliance with this constitution and identify
any exceptions. Exceptions MUST be documented with their rationale, mitigation,
impact, and accountable approver; they MUST be revisited if the relevant risk
or standard changes. The service team MUST review this constitution at least
annually and when applicable GOV.UK, DEFRA, legal, or APHA requirements change.

**Version**: 1.2.0 | **Ratified**: TODO(RATIFICATION_DATE): Original adoption date is not recorded. | **Last Amended**: 2026-10-16
