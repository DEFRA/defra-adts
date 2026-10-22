# Research: Animal Disease Submission

**Date**: 2026-10-21

## Decisions

### UI pages and progression

- **Decision**: Render each page on the server as a Nunjucks view in the existing HAPI application. Use standard HTML forms and GOV.UK Design System components; JavaScript is optional progressive enhancement.
- **Rationale**: This follows the existing `adts-ui` architecture and constitutional design-system and accessibility requirements. Native form submission keeps the journey usable without JavaScript.
- **Alternatives considered**: A client-rendered single-page form was rejected because it is not the existing app pattern and would weaken the specified progressive-enhancement behavior.

### Session and durable draft state

- **Decision**: Treat Yar as a session-scoped working cache, not the durable source of truth. The UI calls backend methods to create/update a draft with a complete snapshot on every progression and retrieve it when resuming. The backend owns the persistence implementation, currently DynamoDB; the UI does not depend on or configure the table.
- **Rationale**: A complete snapshot is straightforward for a multi-page form with nested and repeated animal data, avoids field-level diff/merge complexity, and keeps one canonical copy in the backend. Persisting every progression supports recovery in a later session.
- **Alternatives considered**: Session-only state cannot satisfy cross-session resume. Field-level patches complicate validation and can leave stale or inconsistent nested values.
- **Design guard**: The backend uses a monotonically increasing revision and conditional writes. A stale concurrent tab receives a conflict rather than silently overwriting newer data. These storage mechanics are not implemented in the UI.

### Draft retrieval and ownership

- **Decision**: Provide backend operations to create, list, load, and replace drafts. Derive ownership from a trusted server-side authenticated principal; scope every retrieval and mutation to that principal. Return the saved page key with draft data.
- **Rationale**: Listing provides a way to find drafts in a new session; server-derived ownership prevents a caller from selecting another user's drafts by changing an identifier.
- **Alternatives considered**: Accepting a user identifier from the form or URL was rejected because client-controlled ownership is unsafe. Session cookie state alone does not support a new session.
- **Implementation gate**: The UI home route references `request.auth.credentials`, but the inspected HAPI startup does not register an authentication strategy, and no trusted identity contract is present in the backend. Before enabling draft access, confirm how the deployed UI/backend receive a trusted principal. Do not substitute an untrusted payload identifier.

### Backend method boundary

- **Decision**: Keep persistence implementation inside `adts-backend`. The UI calls backend methods `createUpdateDraft`, `getDraft`, `getClients`, `getCounties`, `getSpecies`, `getAnimalDetails`, `getTests`, and `completeSubmission`. The list is extensible, and method signatures/wire routes are defined by the backend contract rather than assumed by the UI.
- **Rationale**: The UI is a client of the backend boundary. This isolates user-facing form flow from DynamoDB and allows backend storage details to change without UI changes.
- **Alternatives considered**: UI access to DynamoDB or direct LIMS calls were rejected because they bypass the existing service boundaries. Guessing REST paths from method names was rejected because the backend API shape is not yet specified.
- **Backend implementation note**: DynamoDB key layout, indexes, conditional writes, IAM, and table provisioning belong to backend design and deployment. AWS best practices apply there, but are not UI dependencies.

### Complete-submission delivery and retries

- **Decision**: Submit only after all pre-submission stages are complete. The backend passes the completed report and required test selection to the submissions service; the service posts it to LIMS. Use the stable backend-generated `draftId` as the idempotency key through the boundary. LIMS creates and returns the `submissionId` after successful submission; the UI does not need to know it.
- **Rationale**: The submission service is the existing LIMS integration boundary. A stable draft ID makes retries explicit when a downstream response is lost, without requiring a LIMS submission ID before LIMS creates the submission.
- **Alternatives considered**: Calling LIMS directly from the UI or backend was rejected because it bypasses the established service boundary. Treating a timeout as success was rejected because the UI must not claim submission without confirmation.
- **Integration dependency**: The current adapter demonstrates GET `/submissions`, but no LIMS create-submission contract is present in the repository. Confirm the LIMS POST path, required payload, idempotency behavior, and returned document references before implementing the adapter.

### Form data field catalogue

- **Decision**: Keep the draft contract's `formData` extensible at this planning stage; add concrete fields and validation after the approved ADTS/APHA field definitions are provided during task refinement.
- **Rationale**: The requester explicitly deferred the exact fields. Inventing them now could produce invalid reports and rework.
- **Alternatives considered**: Guessing a field set from existing client lookup pages was rejected because those pages do not define the full disease report.

## Resolved Technical Context

- HAPI + Nunjucks + GOV.UK Frontend is the current UI stack.
- Yar is already registered by `adts-ui` and used to store state between requests.
- UI-to-backend method names identified so far are `createUpdateDraft`, `getDraft`, `getClients`, `getCounties`, `getSpecies`, `getAnimalDetails`, `getTests`, and `completeSubmission`; this is not an exhaustive method list.
- `adts-backend` currently proxies GET client and submission lookups to `adts-submissions-service`.
- `adts-submissions-service` currently proxies GET submissions to LIMS; completed-submission POST support is new work.
- UI and backend currently use Jest; Playwright covers end-to-end journeys.
