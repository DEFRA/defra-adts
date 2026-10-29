# Feature Specification: Local DynamoDB Testing

**Feature Branch**: `[not specified]`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "A locally run instance of DynamoDB to mock the tables available to be queried by the backend service during integration and E2E testing. Some of this is already in place on this branch on the last commit."

## Clarifications

### Session 2026-10-28

- Q: When the end-to-end suite starts the backend, should it always point at the local DynamoDB without any extra setup, or only when a developer opts in? → A: Always local by default; the test setup configures the endpoint itself.
- Q: Before each test suite runs, should the local database be automatically reset to the seeded fixture state, or should developers reset it manually? → A: Automatically reset before each integration and E2E suite.
- Q: Should the standard fixtures include records for every table (reference data, submissions, and the CI–LIMS mapping), or only the species reference data? → A: Seed all three tables with synthetic fixtures.
- Q: Should CI pipelines run backend integration and E2E tests against this local DynamoDB container, instead of a hosted environment? → A: Yes, CI starts the same local container and runs integration and E2E tests against it.
- Q: When a developer runs the integration or E2E tests, should the test command start the local DynamoDB container and wait for it to be ready, or should the developer start it beforehand? → A: The test command starts the container, waits until it is healthy, and fails clearly if it cannot start.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run backend tests with local data (Priority: P1)

A developer runs backend integration tests against a local DynamoDB instance containing the tables and test records the backend needs, without depending on a hosted AWS environment.

**Why this priority**: Backend tests need representative, repeatable data to verify real database interactions while remaining usable in local development and isolated test environments.

**Independent Test**: Start the local test database, run a backend integration test that reads reference data, and verify that the expected records are returned without contacting a hosted AWS service.

**Acceptance Scenarios**:

1. **Given** a developer has the repository's local test prerequisites, **When** they follow the documented setup, **Then** the local database becomes available with all required tables and the documented sample data.
2. **Given** the local database is running with sample data, **When** the backend performs a supported reference-data lookup, **Then** it returns the expected results in the backend's established response shape and order.
3. **Given** the local database is unavailable, **When** the backend performs a lookup, **Then** the failure is reported as an error rather than as a successful empty result.

### User Story 2 - Run end-to-end tests without cloud data (Priority: P2)

A developer or test pipeline runs the end-to-end suite with the backend connected to the same local test data, so tests do not require AWS access or depend on changing hosted data.

**Why this priority**: End-to-end results should be reproducible and isolated from external environments while exercising the backend's real data access.

**Independent Test**: Run an end-to-end test that needs backend reference data with hosted AWS access unavailable, and verify the journey completes using the local fixture data.

**Acceptance Scenarios**:

1. **Given** the local test database is available, **When** an end-to-end run starts the application services, **Then** backend data requests use the local database and the test run does not require AWS credentials or access to hosted AWS.
2. **Given** a test fixture defines a known record, **When** integration or end-to-end tests read that record, **Then** they receive the same result on repeated runs from a clean test environment.

### User Story 3 - Reset or run without sample data (Priority: P3)

A developer prepares a clean test environment or an empty database when a test needs to control its own records.

**Why this priority**: Predictable data setup and cleanup prevent one test run from affecting another and support tests for empty-table behavior.

**Independent Test**: Start from a clean local database, verify its selected seed mode, and confirm the test can distinguish an empty table from a table containing the standard fixtures.

**Acceptance Scenarios**:

1. **Given** a developer requests an empty local database, **When** setup completes, **Then** the required tables exist without the standard sample records.
2. **Given** the local database already contains the required tables, **When** the documented initialization is repeated, **Then** initialization completes safely and produces the documented fixture state.
3. **Given** the local database retains data from a previous run, **When** an integration or end-to-end suite starts, **Then** the database is automatically reset to the selected empty or seeded state before the tests run, and the developer can also reset it manually using the documented procedure.

### Edge Cases

- The local database does not start or cannot be reached; setup and test output must make the failure apparent rather than treating it as missing test data.
- Sample data is disabled; tables remain available and tests that require fixtures must report the missing prerequisite clearly.
- Initialization is run more than once; it must not fail merely because a required table already exists.
- A test begins with retained data from an earlier run; the suite's automatic reset must return the database to a known data state before tests run.
- The local database container is not running when a test command starts; the test command starts it and waits for readiness, and reports a clear failure if it cannot start.
- Hosted AWS credentials or endpoints are present in the environment; local test runs must still use the local database and must not silently query hosted data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST provide a locally runnable DynamoDB instance for backend integration and end-to-end testing. The integration and end-to-end test commands MUST start this instance, wait until it is healthy, and fail with a clear error if it cannot start.
- **FR-002**: The local instance MUST provide the tables required by the backend's supported data access patterns, consistent with the repository's documented test data model.
- **FR-003**: The local instance MUST be loadable with a stable, documented set of synthetic representative test records for all required tables: reference data (including species), submissions, and the CI–LIMS mapping.
- **FR-004**: A developer MUST be able to run the local database and backend integration tests without access to a hosted AWS environment. CI pipelines MUST be able to run backend integration and end-to-end tests against the same local container without hosted AWS access.
- **FR-005**: End-to-end test runs MUST connect backend data requests to the local test database by default, with the endpoint configured by the test setup itself, and MUST NOT depend on hosted AWS credentials or data.
- **FR-006**: Developers MUST be able to select an empty database when tests need to provide their own records.
- **FR-007**: Each integration and end-to-end suite MUST automatically reset the local database to the selected empty or seeded state before its tests run. Developers MUST also be able to repeat initialization and to reset retained local data manually using documented steps.
- **FR-008**: Setup instructions MUST describe prerequisites, startup and shutdown, connection settings, sample-data behavior, and how to reset retained data.
- **FR-009**: Failures to start or reach the local database MUST be visible to developers and MUST NOT be represented as successful data lookups.
- **FR-010**: Local test configuration MUST remain isolated from production configuration and MUST NOT direct production service requests to the local database.

### Key Entities

- **Local test database**: A local, isolated database instance that supplies the data required by backend integration and end-to-end tests.
- **Test table**: A named collection of records needed to support a backend data access pattern.
- **Fixture record**: A synthetic, documented record that enables deterministic test setup and assertions.
- **Test run**: A backend integration or end-to-end execution that obtains database data from the local test database.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer following the repository instructions can make the local database and its required tables available in five minutes or less, excluding initial prerequisite installation.
- **SC-002**: All backend integration and end-to-end scenarios that require local database data pass without cloud account credentials or connectivity to hosted data services.
- **SC-003**: In 10 consecutive clean test runs, the documented fixtures produce the same expected backend lookup results in every run.
- **SC-004**: Developers can choose either seeded or empty test data, suites restore the selected known state automatically before each run, and developers can restore it manually using the documented procedure, all without manual database editing.
- **SC-005**: When the local database is unreachable, the affected lookup or test reports a failure in every test run rather than passing with an empty or fabricated result.

## Assumptions

- The intended users are developers and automated test pipelines working in this repository.
- Docker with Compose is an available prerequisite on developer machines and CI runners, consistent with the current local DynamoDB setup.
- Fixture data is synthetic and must not contain real customer, user, or otherwise sensitive information.
- The local database supports test and development use only; production data and production service configuration remain out of scope.
- The latest commit's local database, initial table definitions, sample data, and backend endpoint configuration are starting assets; this specification captures the complete behavior expected across integration and end-to-end test runs.
- The repository's documented test data model is the source of truth for which tables are required; this feature does not redesign the production data model.
