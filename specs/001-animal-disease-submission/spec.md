# Feature Specification: Animal Disease Submission

**Feature Branch**: `[not specified]`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "Develop the submissions form in the ADTS UI service for an animal disease report with tests included in the submission. Each step will be one or more pages. Users can navigate between pages, save a draft and return to it, and finally submit their form.

steps = [
    { number: 1, label: "Client details" },
    { number: 2, label: "Animal details" },
    { number: 3, label: "Clinical history" },
    { number: 4, label: "Choose tests" },
    { number: 5, label: "Your basket" },
    { number: 6, label: "Delivery address" },
    { number: 7, label: "Review and submit" },
    { number: 8, label: "Print documents" }
  ]"

## Clarifications

### Session 2026-10-21

- Q: Should each report cover one animal only, or can it include multiple animals? → A: One species per submission; multiple animals of that species can be included.
- Q: Does test fulfilment require the user to pay during this submission journey? → A: No payment is taken during this journey; the selected tests are submitted for fulfilment.
- Q: What should determine the required fields for client details, animal details, and clinical history? → A: Use existing ADTS/APHA reporting requirements.
- Q: Must a user add a test to every submission? → A: Yes. The user can choose from the available tests, but must add at least one test.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit an animal disease report (Priority: P1)

A veterinary practice user completes every stage of the report, including adding at least one test, reviews the information, and submits the animal disease report with the selected tests.

**Why this priority**: The report must include at least one selected test as part of the submission journey.

**Independent Test**: Complete every stage with valid report information, at least one selected test, and a delivery address. Submit and verify that the report and selected tests reach confirmation.

**Acceptance Scenarios**:

1. **Given** a user starts a new report, **When** they provide valid client details, animal details, and clinical history, **Then** they must add at least one test to continue.
2. **Given** a user has selected at least one test, **When** they complete the basket and provide a valid delivery address, **Then** they can review and submit the report and selected tests together without taking payment in this journey.
3. **Given** required information is missing or invalid, **When** the user tries to continue or submit, **Then** the form identifies the affected information and allows them to correct it without losing other entered details.
4. **Given** the report is submitted successfully, **When** the user reaches the confirmation, **Then** they can access the documents required to print for that submission.
5. **Given** a user is reporting multiple animals of one species, **When** they add the animals to the submission, **Then** the submission includes all of them under that single species.
6. **Given** a user is reporting animals of different species, **When** they try to add them to one submission, **Then** the form requires separate submissions for each species.
7. **Given** a user has not selected a test or has removed all tests from the basket, **When** they try to continue to the next stage or submit, **Then** the form requires them to add at least one test.

### User Story 2 - Navigate and review the form (Priority: P2)

A user moves between the form's steps and pages to enter, check, and correct information before submission.

**Why this priority**: The report spans several types of information, and users need to progress at their own pace and catch mistakes before submitting.

**Independent Test**: Enter information on multiple pages, move forward and back, and verify previously entered answers remain available and are reflected in the review.

**Acceptance Scenarios**:

1. **Given** a user is completing a report, **When** they move to another page or return to a previous step, **Then** their entered information is retained.
2. **Given** a user reaches the review step, **When** they inspect the report, **Then** they can see the information entered and return to the relevant step to correct it.
3. **Given** a user is on a step that contains multiple pages, **When** they complete a page, **Then** they can continue to the next page while remaining aware of their progress through the submission.
4. **Given** a user opens any form page, **When** they read its heading and instructions, **Then** they can identify the current stage, the information requested, and the next action.

### User Story 3 - Save and return to a draft (Priority: P2)

A user saves an incomplete report and returns to it later to continue and submit it.

**Why this priority**: A report may require information that is not immediately available; saving prevents users from having to restart.

**Independent Test**: Enter report and kit-order information, save without submitting, leave the form, reopen the saved draft, and verify the information is restored and can be changed.

**Acceptance Scenarios**:

1. **Given** a user has started a report, **When** they choose to save it as a draft, **Then** the draft is saved without being submitted.
2. **Given** a user has a saved draft, **When** they return to that draft, **Then** previously entered information and their progress are restored.
3. **Given** a user returns to a draft, **When** they edit and save it again, **Then** the updated information is retained.
4. **Given** a user has not completed required information, **When** they save a draft, **Then** they can save without completing fields that are only required to proceed or submit.

### Edge Cases

- A user removes every item from the basket; the form must require at least one test before the user can continue or submit.
- A user tries to include animals of different species in one submission; the form must prevent mixing species and make clear that a separate submission is needed.
- A user returns to a draft after the available kit selection has changed; unavailable items must be clearly identified and cannot be included in the submitted order.
- A user loses their session or leaves before explicitly saving; the form must not indicate that an unsaved draft has been saved.
- A submission attempt fails; the user is told that it was not submitted and can retry without creating an unintended duplicate submission.
- A user has submitted the report but cannot access the print documents; the submitted report remains confirmed and the user receives a clear indication that the documents are unavailable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The form MUST guide a user through the submission stages in this order: Client details, Animal details, Clinical history, Choose tests, Your basket, Delivery address, Review and submit, and Print documents.
- **FR-002**: Each stage MUST support one or more pages, and the user MUST be able to navigate forward and backward between pages and stages. The user MUST complete every stage in sequence and MUST NOT be able to skip a required stage; Print documents MUST be made available after successful submission.
- **FR-003**: The form MUST identify required information and prevent progression or submission when required information is missing or invalid, while preserving other entered information.
- **FR-004**: The form MUST require the user to select at least one test before continuing from the Choose tests stage.
- **FR-005**: The form MUST require the user to review and confirm the basket and provide a valid delivery address before submission.
- **FR-006**: If the basket is empty, the form MUST prevent progression to the next stage and require the user to add at least one test.
- **FR-007**: The review MUST present the report information, selected tests, and delivery address before the user submits.
- **FR-008**: The form MUST allow a user to save an incomplete report as a draft without submitting it.
- **FR-009**: The form MUST allow a user to return to a saved draft and continue with the information and progress they previously saved.
- **FR-010**: The form MUST provide a clear confirmation when a report is successfully submitted and MUST make the submission's required print documents available from the final stage.
- **FR-011**: The form MUST clearly distinguish a saved draft from a submitted report and MUST communicate submission failures without indicating success.
- **FR-012**: The form MUST clearly indicate when a selected test is no longer available, and MUST prevent unavailable tests from being included in the submission.
- **FR-013**: Each form page MUST identify its stage, explain the information requested in plain language, identify missing or invalid information, and state the next action.
- **FR-014**: Each submission MUST cover exactly one species and MUST allow one or more animals of that species to be included.
- **FR-015**: The form MUST submit the user's selected tests for fulfilment without taking payment during this submission journey.
- **FR-016**: The required fields and validation for client details, animal details, and clinical history MUST follow existing ADTS/APHA reporting requirements.
- **FR-017**: The form MUST require completion of every pre-submission stage, including test selection, basket, delivery address, and review, before submission; a user MAY save an incomplete draft but MUST complete those stages before submitting.

### Key Entities

- **Submission**: An animal disease report for exactly one species and one or more animals of that species, progressing through client details, animal details, clinical history, test selection, review, and submission.
- **Animal**: An individual animal included in a submission, associated with that submission's species.
- **Draft**: An incomplete, saved submission that a user can return to and continue.
- **Test selection**: One or more available tests added by the user to a submission. At least one test is required, and the selected tests are submitted for fulfilment with the report.
- **Print documents**: Documents made available to the user after successful submission for printing in connection with the report.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of saved drafts used in acceptance testing restore the information and progress saved by the user.
- **SC-002**: 100% of test submissions with missing or invalid required information are prevented from being submitted and present a clear route to correct the issue.
- **SC-003**: After each successful test submission, the user sees an unambiguous confirmation and can access the required print documents.

## Assumptions

- Users are veterinary practice users who already have access to the submissions service.
- The eight named stages are mandatory and are completed in the stated order. A submission requires at least one selected test, a completed basket, and a delivery address. The Print documents stage follows successful submission.
- A draft is associated with its creating user and can be revisited by that user through the service's existing draft access journey.
- Draft retention, submission records, available tests, and the definition of required print documents follow existing service and business policies.
- A successful submission records the animal disease report and the user's selected tests for fulfilment as one journey; exact downstream fulfilment and document contents follow existing business processes.
- The service's established accessibility and privacy requirements apply throughout the journey.
