# Data Model: Animal Disease Submission

## Living Field Requirements Catalogue

Maintain this catalogue incrementally as page requirements are explored and implemented. There is no single requirements source: use the relevant Azure DevOps tickets, screenshots, and v1 code as evidence. Record enough source detail to locate each reference again. Treat v1 behavior as evidence, not automatic authority. When evidence is incomplete or conflicts, record an open question and the competing references; do not silently resolve it by assumption.

For each page, record the field, user-facing label, requiredness, validation, source reference(s), and status or open question. Add entries as evidence is reviewed, and update them when implementation or further investigation clarifies the requirement. Keep unrelated page work moving when one field remains unresolved.

### Step 1: Select a client

**Evidence**

- Screenshot supplied for Step 1.
- Current implementation: `services/adts-ui/src/routes/submissionFirstPage.js`, `services/adts-ui/src/views/select-client.njk`, and `services/adts-ui/tests/routes/submission-client-details.test.js`.

| Field | User-facing label | Requiredness | Validation / notes | Evidence and status |
|---|---|---|---|---|
| `clientId` | Client | Not specified | Search/select an existing client. The prompt says a user can search by client name, address, or CPH. Existing clients are loaded through `GetClients`; the UI enhances the select with accessible autocomplete. A result is presented with client name, farm name/address, county, postcode, and CPH as shown in the screenshot. | Screenshot and current implementation. The route accepts an empty selection, so the implementation does not currently enforce selecting a client before continuing. Whether selection should be mandatory remains unspecified. |

The page heading is “1. Client details”; its introduction says “Tell us about the owner (your client) of the animal or animals you want to test.” The client search prompt is “Enter the name of your client, their address, or the County Parish Holding (CPH) eg 48/234/2348:”. A user can follow a separate link to Step 1a to enter new client details.

### Step 1a: Enter new client details

**Evidence**

- Azure DevOps ticket: “Create a new client from Step 1” (ticket ID not supplied).
- Screenshot supplied with the ticket.
- Current implementation: `services/adts-ui/src/views/create-edit-client.njk`, `services/adts-ui/src/routes/createClient.js`, and `services/adts-ui/tests/routes/create-client.test.js`.

| Field | User-facing label | Requiredness | Validation / notes | Evidence and status |
|---|---|---|---|---|
| `cph` | CPH number eg 48/234/2348 | Optional | Format and validation rules are not specified by the ticket. | Ticket explicitly says optional; shown in screenshot and implemented. |
| `name` | Name | Not specified | Ticket says to capture it; whether blank is allowed is not specified. Current Joi schema allows blank. | Ticket, screenshot, and implementation. |
| `farmName` | Farm name | Not specified | Whether blank is allowed is not specified. Current Joi schema allows blank. | Ticket, screenshot, and implementation. |
| `addressLine1` | Address line 1 | Not specified | Ticket names address; screenshot and implementation provide three address lines. Whether each line is optional or required is not specified. | Ticket, screenshot, and implementation. |
| `addressLine2` | Address line 2 | Not specified | Whether blank is allowed is not specified. Current Joi schema allows blank. | Screenshot and implementation; ticket does not specify address-line count. |
| `addressLine3` | Address line 3 | Not specified | Whether blank is allowed is not specified. Current Joi schema allows blank. | Screenshot and implementation; ticket does not specify address-line count. |
| `county` | County | Not specified | County options are loaded from the backend; whether a selection is required is not specified. Current Joi schema allows blank. | Ticket, screenshot, and implementation. |
| `postcode` | Postcode | Not specified | Format and whether blank is allowed are not specified. Current Joi schema allows blank. | Ticket, screenshot, and implementation. |

**Acceptance behavior and implementation evidence**

| Acceptance criterion | Requirement captured | Current implementation evidence | Status / open question |
|---|---|---|---|
| AC1: When no client is found, the user can enter new client details. | Capture optional CPH, name, farm name, address, county, and postcode. | The page presents these inputs; address is represented by three lines. The POST route validates each value as a string but allows empty strings. | Fields are present. Requiredness other than optional CPH and field-specific validation are unspecified by the ticket. |
| AC2: After the new client details are saved, return to Step 1 with that client selected for the submission. | Return to `/submission-01-client-details` with the entered client details selected. | The POST route stores the entered details in Yar submission form state. The first-page route displays them as the selected `new-client` option. | This is submission form data, not creation of a durable client record. The flow does not call a `createClient` endpoint; whether a third party later creates or deduplicates a client is outside this form's responsibility. |

### Edit selected client details

**Evidence**

- Azure DevOps ticket: “SUB-03 - Edit selected client details”.
- Screenshots supplied with the ticket.
- Current implementation: `services/adts-ui/src/routes/submissionFirstPage.js`, `services/adts-ui/src/routes/createClient.js`, `services/adts-ui/src/views/select-client.njk`, and `services/adts-ui/src/views/create-edit-client.njk`.

| Acceptance criterion | Requirement captured | Implementation behavior |
|---|---|---|
| AC1: When a selected client is edited, pre-populate the edit form with its existing details. | Reuse the client fields above; keep the existing client selected while editing. | `/edit-client` reads the selected client's details from the submission form state and populates the form, including the county selection. |
| AC2: When the user updates name, farm, address, county, or postcode and saves, the selected client details are updated and persisted. | Save the edited details without turning an existing client into a new client. | The edit POST replaces those values in the session's submission form state while preserving `clientId`; the client summary and selected option show the updated values on return to Step 1. This updates this submission's selected client data; it does not update a durable client record. |

## Submission Draft

A user's in-progress report. The backend owns the durable draft; Yar may cache the current draft ID and form data during one UI session.

| Field | Meaning | Validation / notes |
|---|---|---|
| `draftId` | Stable identifier for this report draft and eventual submission | Generated by backend; immutable |
| `ownerId` | Authenticated user who owns the draft | Derived from trusted server identity; never accepted from browser form data |
| `status` | Draft lifecycle state | `draft`, `submitting`, or `submitted`; invalid transitions are rejected |
| `lastSavedPage` | Stable page key to resume at | Must match an allowlisted page; updated with every successful progression |
| `formData` | Complete current report answers | Replaced as a whole on progression; field schema is recorded incrementally in the living field requirements catalogue |
| `revision` | Monotonic version of the persisted snapshot | Conditional writes reject stale revisions to prevent silent lost updates |
| `createdAt` | Draft creation time | Set by backend |
| `updatedAt` | Most recent successful save time | Set by backend |
| `documentReferences` | References returned after successful submission | Populated only after confirmed submission; content/format follows LIMS contract |

## Report Data (`formData`)

Concrete field names and validation are captured incrementally in the living field requirements catalogue above, with source references and unresolved questions. The client details captured on Step 1 are represented as `formData.clientDetails`:

```json
{
  "formData": {
    "clientDetails": {
      "clientId": "",
      "cph": "",
      "name": "",
      "farmName": "",
      "addressLine1": "",
      "addressLine2": "",
      "addressLine3": "",
      "county": "",
      "postcode": ""
    }
  }
}
```

`clientId` identifies a selected existing client and is empty for a client entered through Step 1a. `county` stores the selected county option value (county ID); the county name is presentation data obtained from the county lookup, not a separate submitted client field. The form also retains the source client's `countyId` and a looked-up `countyName` in session state for displaying the selected client; these are derived/lookup values and are not part of the canonical `clientDetails` snapshot above.

The UI stores this object in the Yar value keyed by `submissionFormState`, under `formData.clientDetails`. Each submission page should preserve the existing `submissionFormState` properties and update only its own section of `formData`.

| Concept | Cardinality | Validation / notes |
|---|---:|---|
| `clientDetails` | One per report | Field-level requiredness and validation are listed under Step 1 and Step 1a above; do not infer unspecified requirements. |
| Species | One per report | Required; all animals in the report must match it |
| Animal | One or more per report | Each animal belongs to the single report species |
| Clinical history | Report and/or animal-associated answers, according to approved field definitions | Required fields follow existing ADTS/APHA requirements |
| Test kit selection | One or more kit lines | At least one available kit is required before progression/submission |
| Delivery address | One per kit order | Required for every submission |

## Lifecycle

```text
No draft
  └─ first successful save ─> draft (revision 1)
       ├─ successful full-snapshot save ─> draft (revision + 1)
       ├─ save conflict ─> draft unchanged; user reloads latest version
       └─ submit request ─> submitting
            ├─ confirmed by LIMS ─> submitted
            └─ recoverable/failed response ─> retry or recover using the same draftId as the idempotency key
```

Only confirmed successful saves advance `lastSavedPage` and `revision`. The UI must not show a progression as saved if the backend write fails.

## DynamoDB Access Pattern

The following persistence details describe the backend's implementation boundary only. The UI sends complete snapshots through backend methods and does not know these keys, indexes, or storage commands.

- **Base key**: `PK = DRAFT#<draftId>`, giving a direct item lookup by stable draft ID.
- **Owner-list index**: `GSI1PK = USER#<ownerId>` and `GSI1SK = <updatedAt>#DRAFT#<draftId>`, allowing a user's drafts to be queried by recency without scanning the table.
- **Create draft**: write an item with backend-generated `draftId`, trusted `ownerId`, initial `formData`, `lastSavedPage`, `status`, and revision.
- **List user's drafts**: query a user-keyed index, ordered by update time; do not scan the table.
- **Load or update a draft**: fetch by `draftId`, then enforce owner equality. Rebuild and write the complete item with a condition requiring the trusted owner and expected revision; preserve server-managed fields such as `createdAt`.
- **Submit**: transition state conditionally and use the stable `draftId` as the idempotency key for LIMS retries. LIMS creates and returns the `submissionId` after successful submission; the UI does not need to receive or store it.
- **Item size**: The complete snapshot must remain within DynamoDB's item-size quota. Reject oversized writes explicitly; revisit data shape if confirmed report fields approach the limit.
- **Region behavior**: Use a single write region for optimistic revision checks unless the hosting platform explicitly requires multi-region writes; global-table last-writer-wins replication does not preserve cross-region optimistic locking.

No TTL/retention duration is specified. Apply the existing approved retention policy when provided; do not invent automatic deletion here.
