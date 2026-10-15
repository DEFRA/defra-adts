<!--
Sync Impact Report
Version change: unratified template → 1.0.0 (initial constitution)
Modified principles: placeholder principles → User needs and outcomes; GOV.UK
standards; Accessibility by design; Security and privacy; Tested, operable,
proportionate delivery
Added sections: Service and design standards; Delivery and quality
Removed sections: None
Follow-up TODOs: Confirm ratification date and who approves documented GOV.UK
exceptions. Remove this report before committing the ratified constitution.
-->

# DEFRA Animal Disease Testing Service Constitution

## Core Principles

### I. User Needs and Outcomes
Changes MUST address an evidenced user or service need and have observable
acceptance criteria. Teams MUST consider the end-to-end journey and the needs
of all affected users, including veterinary professionals and operational
users. Requirements and decisions MUST be understandable to the people who
need to review, build, test, and operate the service.

### II. GOV.UK Standards
User-facing design and content MUST follow applicable GOV.UK Service Standard,
Service Manual, and Design System guidance. Teams MUST use established GOV.UK
patterns rather than create bespoke alternatives where a suitable pattern
exists. Any exception MUST have a documented rationale and explicit approval
from the appropriate service and design authority before release.

### III. Accessibility by Design
Accessibility MUST be considered from discovery through delivery, not deferred
to final testing. The service MUST meet WCAG 2.2 AA. Changes affecting user
interfaces MUST be checked with appropriate automated and manual methods,
including keyboard use and assistive technology where relevant. Automated
checks MUST NOT be treated as proof of accessibility on their own.

### IV. Security and Privacy
Teams MUST protect service, user, and animal-related information throughout
design, implementation, testing, and operation. They MUST collect and expose
only the information needed for the service purpose, apply approved access
controls, and avoid using production personal data in test or AI prompts.
Security and privacy risks MUST be assessed proportionately and addressed
before release; unresolved material risks require an explicit documented
decision by the accountable authority.

### V. Tested, Operable, Proportionate Delivery
Changes MUST be verified against their acceptance criteria with the relevant
automated and human testing. The team MUST provide traceable evidence,
appropriate monitoring and operational documentation for the change, and
review the change before integration. Solutions MUST use the simplest
approach that meets user, service, security, and quality needs. Quality gates
and applicable test expectations are described in the [Definition of Done](../../docs/definition-of-done/README.md)
and [Test Strategy](../../docs/test-strategy/README.md).

## Service and Design Standards

ADTS supports veterinary users to submit animal disease tests and view
associated information and results. Features MUST preserve the accuracy,
confidentiality, and integrity of information across the user journey and
service boundaries. Product and design decisions MUST be grounded in user
research, service evidence, and applicable GOV.UK guidance; implementation
details and feature-specific behaviour belong in the relevant specifications
and technical plans.

## Delivery and Quality

Teams MUST apply the repository's Definition of Ready when deciding whether
work is sufficiently understood to start, and its Definition of Done when
deciding whether work is complete. Testing MUST be proportionate to risk and
cover affected service boundaries and critical user journeys; a passing test
suite does not replace review of acceptance criteria, accessibility, or
operational impact. Exceptions to a quality gate MUST be explicit, documented,
approved by the relevant accountable authority, and tracked to resolution
where appropriate.

## Governance

This constitution defines the enduring principles for ADTS delivery and takes
precedence over conflicting local conventions. Feature specifications,
implementation plans, tasks, and pull requests MUST be checked against these
principles. The team MUST resolve or explicitly approve any material
non-compliance before release.

Amendments MUST be proposed as a reviewed change to this file, explain their
impact, and be approved by the team's accountable service and technical
stakeholders. The version MUST follow semantic versioning: MAJOR for
incompatible changes to principles or governance, MINOR for new or materially
expanded principles or sections, and PATCH for clarifications that do not
change policy. The team MUST review the constitution at least annually and
when service policy or applicable standards materially change.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): Set when the team formally adopts this constitution | **Last Amended**: 2026-10-14
