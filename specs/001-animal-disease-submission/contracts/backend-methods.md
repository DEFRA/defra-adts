# UI-to-Backend Method Contract

The UI calls methods provided by `adts-backend`. These names identify the current expected operations; they do not prescribe HTTP routes, transport details, or the backend's storage implementation. The backend owns draft persistence. The UI must not connect directly to DynamoDB or require table/region/credential configuration.

## `createUpdateDraft`

Creates a draft on the first saved progression, or updates an existing draft on subsequent progressions.

- **Input**: Current complete form snapshot, stable page key being saved, and draft ID/revision when updating an existing draft.
- **Behavior**: Persist the full snapshot and current page; report a conflict rather than silently overwrite a newer revision.
- **Output**: Draft ID, updated revision, and saved page/state needed by the UI session.
- **Errors**: Validation, revision conflict, unavailable backend/storage dependency, or oversized/unsupported draft.

## `getDraft`

Loads one draft when a user resumes it, including from a new UI session.

- **Input**: Draft ID.
- **Behavior**: Return only a draft the authenticated user is authorized to access.
- **Output**: Complete saved form data, current revision, lifecycle status, and last saved page key.
- **Errors**: Not found or not authorized, or unavailable backend/storage dependency.

## `getClients`

Retrieves clients available to the current user for the Client details stage.

- **Input**: User context supplied by the trusted backend integration; no owner identity should be trusted from arbitrary form fields.
- **Output**: Client records/options suitable for rendering in the existing client-selection form.
- **Errors**: Backend or downstream lookup failure, surfaced to the user without presenting an empty success result.

## `getCounties`

Retrieves the county options needed for client or delivery-address forms.

- **Output**: County records/options suitable for rendering in a GOV.UK select control.
- **Errors**: Backend or downstream lookup failure; do not silently present an empty success result.

## `getSpecies`

Retrieves species options for the Animal details stage.

- **Output**: Species records/options suitable for rendering in the form.
- **Current wire contract**: `GET /GetSpecies` returns `[{ "speciesId": "<string>", "name": "<string>" }]`. The backend fetches `GetSpecies` from `adts-submissions-service` and normalises it (ids as strings, malformed entries dropped).
- **Errors**: Backend or downstream lookup failure; do not silently present an empty success result.

## `getAnimalDetails`

Retrieves animal details or reference data needed for the selected report species and Animal details stage.

- **Input**: The selected species and any other context required by the backend method contract.
- **Output**: Animal details/reference data required by the form.
- **Current wire contract**: `GET /GetAnimalDetails?speciesId=<id>` (`speciesId` required, otherwise 400) returns the following. Every option list may be empty, meaning the field does not apply to the species and the UI omits it. Option `value`s are strings and `label`s are display text. The backend fetches `GetAnimalDetails` from `adts-submissions-service` and normalises the result into this shape.

  ```json
  {
    "speciesId": "2",
    "ageCategories": [{ "value": "lamb", "label": "Lamb" }],
    "purposes": [{ "value": "meat", "label": "Meat" }],
    "keepingTypes": [{ "value": "outdoor", "label": "Outdoor" }],
    "breeds": [{ "value": "texel", "label": "Texel" }],
    "sexes": [{ "value": "ewe", "label": "Ewe" }],
    "organicAccreditationApplicable": true
  }
  ```

- **Errors**: Invalid selection or backend/downstream lookup failure, surfaced without treating missing data as a successful empty result. Downstream error statuses are preserved; unusable downstream data returns 502.

## `getTests`

Retrieves available tests or test kits for the Choose tests stage.

- **Output**: Current selectable tests/kits and the information needed to build the basket.
- **Errors**: Backend or downstream lookup failure; the user must not be allowed to submit a kit selection that cannot be confirmed as available.

## `completeSubmission`

Completes submission of the fully validated report and mandatory test-kit order through the backend's submission integration.

- **Input**: Draft ID, current revision, and any final confirmation data required by the backend method contract.
- **Behavior**: Submit the completed report through `adts-submissions-service` to LIMS, safely supporting retries without creating duplicate submissions. No payment is taken in this journey.
- **Output**: Confirmed submission status and print-document references required for the final stage. The UI does not require the LIMS-generated submission identifier.
- **Errors**: Incomplete report/order, revision or lifecycle conflict, or downstream failure. The UI must not show a success confirmation unless completion is confirmed.

## Cross-cutting behavior

- The UI follows the backend's documented request and response types and does not infer routes from method names.
- Draft ownership is derived from trusted server-side identity and is never accepted as a user-controlled owner ID.
- The UI updates Yar session working state after confirmed backend success; it does not show a progression as saved when the backend call fails.
- Backend storage technology, table keys/indexes, AWS credentials, and infrastructure configuration are outside this UI contract.
- The method list is not exhaustive; additional backend methods may be added as the form and approved field set are refined.
