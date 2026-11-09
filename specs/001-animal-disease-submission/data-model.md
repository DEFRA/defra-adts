# Data Model: Animal Disease Submission

## Living Field Requirements Catalogue

Maintain this catalogue incrementally as page requirements are explored and implemented. There is no single requirements source: use the relevant Azure DevOps tickets, screenshots, and v1 code as evidence. Record enough source detail to locate each reference again. Treat v1 behavior as evidence, not automatic authority. When evidence is incomplete or conflicts, record an open question and the competing references; do not silently resolve it by assumption.

For each page, record the field, user-facing label, requiredness, validation, source reference(s), and status or open question. Add entries as evidence is reviewed, and update them when implementation or further investigation clarifies the requirement. Keep unrelated page work moving when one field remains unresolved.

### Step 1: Select a client

**Evidence**

- Screenshot supplied for Step 1.
- Current implementation: `services/adts-ui/src/routes/selectClient.js`, `services/adts-ui/src/views/select-client.njk`, and `services/adts-ui/tests/routes/submission-client-details.test.js`.

| Field | User-facing label | Requiredness | Validation / notes | Evidence and status |
|---|---|---|---|---|
| `clientDetails` | Client details | Requiredness and validation not specified | Search/select an existing client by name, address, or CPH to prefill the form, or enter details manually. The same Step 1 page is rerendered to edit the selected client; accessible autocomplete is progressive enhancement over a native select. Client details are stored with the submission; no client create/update request is made to LIMS. | Implemented from the supplied screenshots and clarified business behavior. Requiredness and field validation remain unspecified; report-to-LIMS mapping is pending the submission contract. |
| `clientDetails.animalAddressDetails` | New animal address | Optional; shown when animals are not at the client address and the user chooses manual entry | Uses the same name, farm name, address lines, county, postcode, and CPH inputs as manual client entry. Stored separately from the client fields and from the existing animal-address lookup value. | Implemented on Step 1; downstream report-to-LIMS mapping is pending the submission contract. |

The page heading is “1. Client details”; its introduction says “Tell us about the owner (your client) of the animal or animals you want to test.” The current client search prompt is “Enter the name of your client, their address, or the County Parish Holding (CPH) eg 48/234/2348:”. Selecting an existing client supplies editable starting values on the same Step 1 page; a user without a suitable match can enter the values manually. If animals are at a different address, the user can search for that address or open a second manual-entry form with the same fields as the client form; both forms can be completed together. The page uses native form submissions and works without JavaScript; accessible autocomplete and the selected-client edit-button behavior enhance it when JavaScript is available. These values belong to the submission, not a client create/update request to LIMS.

### Step 2: Animal details — Species

**Evidence**

- Azure DevOps ticket SUB-07: acceptance criteria AC1, AC1a–AC1c (species selection) and AC2–AC5 (dynamic options, optional breed/sex, age detail, organic accreditation); AC4 (optional age detail with unit and estimate flag) is NOT implemented because the design screenshots show age categories only; this is tracked as to-do T010a pending product owner confirmation.
- Screenshot supplied for Step 2: heading “2. Animal details”, “Tell us about the animals you want to test.”, a “Species” radio group (Cattle, Sheep, Chicken, Pig, Turkey, Duck, Alpaca, Goat, Other), Continue, and a session-timeout note. The page also shows the selected client’s name, address, and CPH number (“No … set” when absent).
- Current implementation: species page `services/adts-ui/src/routes/submissionSpecies.js`, `services/adts-ui/src/views/submission-species.njk`, `services/adts-ui/src/backend/species.js`, `services/adts-ui/tests/routes/submission-species.test.js`; animal details page `services/adts-ui/src/routes/submissionAnimalDetails.js`, `services/adts-ui/src/views/submission-animal-details.njk`, `services/adts-ui/src/backend/animalDetails.js`, `services/adts-ui/tests/routes/submission-animal-details.test.js`.
- Design divergence from the screenshot (product owner decision): species-dependent options are not re-rendered on the species page, because that would break progressive enhancement. Continue on `/submission-02-species` saves the species and redirects to `/submission-02-animal-details`, which calls `GetAnimalDetails?speciesId=<id>` on load; the returned object supplies the other animal details. The animal details page redirects back to the species page if no species is saved.

| Field | User-facing label | Requiredness | Validation / notes | Evidence and status |
|---|---|---|---|---|
| `animalDetails.speciesId`, `animalDetails.species` | Species | Required to continue | Single value selected from all species returned by `GetSpecies` (`speciesId`, `name`) in a native select enhanced with accessible autocomplete. The chosen name must exist in that list; its `speciesId` and name are persisted. Changing species discards previously saved species-dependent answers. | AC1 and backend species list. Implemented. The select is usable without JavaScript. |
| `animalDetails.ageCategory` | Age category | Required (no “optional” in the design) when the species offers options | Radios from `ageCategories` for the species (AC2), e.g. Adult, Mixed, Neonatal (1 week old or less), Post weaned, Pre weaned, Unknown, Doesn’t apply. Categories only in the current build. | Screenshot 3. Implemented. |
| `animalDetails.ageDetail` (`value`, `unit`, `isEstimate`) | Age detail (optional), unit, estimate flag | Optional | **To do (T010a):** AC4 requires it to be persisted alongside the age category, but the screenshots show no such fields; confirm before building. | SUB-07 AC4. Not implemented. |
| `animalDetails.purpose` | Purpose | Required when the species offers options | Radios from `purposes` for the species (AC2), e.g. Beef finisher, Dairy, Calf rearer, Captive/zoo, Suckler, I don’t know, Doesn’t apply. | Screenshot 4. Implemented. |
| `animalDetails.keepingType` | Where are they kept? (optional) | Optional | Radios from `keepingTypes` for the species (AC2), e.g. Housed, Mixed, Outdoor, I don’t know. | Screenshot 4. Implemented. |
| `animalDetails.breed` | Breed (optional) | Optional | Type-ahead (select enhanced with accessible-autocomplete) over `breeds`; shown only when the species has breeds (AC1b-style, AC3). | Screenshot 1. Implemented. |
| `animalDetails.sex` | Sex (optional) | Optional | Radios from `sexes`, e.g. Castrate, Female, Male, Mixed, I don’t know (AC3). | Screenshot 2. Implemented. |
| `animalDetails.numberOfAnimals`, `animalDetails.animalIds` | Number of animals; “Enter IDs, eg ear tag number (optional)” with one input per animal | Number defaults to 1; IDs optional | Number is 1–10 (maximum assumed). One ID input per animal, each up to 50 characters (assumed); IDs beyond the chosen number are discarded and `animalIds` is stored only when at least one ID is given. Without JavaScript all ID inputs are shown; with it only the first N. | Screenshot 2. Implemented; maximum and ID length are assumptions. |
| `animalDetails.organicAccreditation` | Is the farm accredited organic? (optional) | Optional | Radios: `yes`, `no`, `in-transition`, `unknown` (Yes, No, In transition, I don’t know); shown only when `organicAccreditationApplicable` is true for the species; unanswered is valid and not stored (AC5). | Screenshot 4. Implemented. |

Only values the user supplies are persisted; empty optional fields are omitted. A supplied value must be one of the options the backend returned for the species.

Open questions: the maximum number of animals per submission and the animal ID format (assumed 10 and 50 characters); whether the common species/age/purpose option labels come from the backend as assumed; the `GetSpecies` and `GetAnimalDetails` backend endpoints do not yet exist; the UI is built to an assumed shape (see `contracts/backend-methods.md`); the common-species list is fixed to the screenshot (matched to backend species by name); the single-species-per-submission rule is enforced by this step choosing one species for all animals.

### Step 3: Clinical history

**Evidence**

- SUB-09 acceptance criteria AC1–AC3: accept and validate the sample date and persist a valid date when continuing. The user selected the standard GOV.UK Design System date input (day, month and year fields); no custom calendar control is used.
- Screenshot supplied for Step 3: heading “3. Clinical history”, introduction “Tell us about the symptoms and clinical history.”, and field heading “Date the sample was taken.”

| Field | User-facing label | Requiredness | Validation / notes | Evidence and status |
|---|---|---|---|---|
| `clinicalHistory.sampleTakenDate` | Date the sample was taken | Not specified by the ticket; blank is accepted | Use the GOV.UK date input (`govukDateInput`) with separate day, month and year fields. Blank is accepted; a partially completed date reports which parts are missing. Reject invalid or future dates server-side and store accepted values as `yyyy-mm-dd`. | SUB-09 AC1–AC3, supplied screenshot, and user decision to use the standard GOV.UK date input rather than a calendar control. Implemented. |

### Client details collection

There is no LIMS client create/update operation. The standalone `/create-client`, `/update-client`, and `/edit-client/{clientId}` pages and corresponding home-page actions have been removed. The submission's Step 1 page supports selecting an existing client to prefill the editable form or entering details manually. Values are retained in the report data and used only for that submission; they are not treated as a client-record mutation.

Fields are `cph`, `name`, `farmName`, `addressLine1`, `addressLine2`, `addressLine3`, `county`, and `postcode`. Their requiredness and validation have not been approved. When an existing record is selected, its `clientId` is retained as a reference alongside the editable field values; a manually entered client has no `clientId`. Confirm whether that reference belongs in the final report contract and how the collected values map to the LIMS submission payload.

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
      "clientId": "101",
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

The UI stores all client detail fields and animal-location answers under `formData.clientDetails`. Manually entered animal address fields are stored separately as `animalAddressDetails`; an address entered through the existing lookup remains in `animalAddress`. `clientId` is present only when the user selected an existing client; manually entered client details do not receive an identifier. Existing records are read through `GetClients`; there is no separate client create/update request. The final report-to-LIMS field mapping still depends on the confirmed submission contract. The backend returns fully formed client records, so the UI makes no separate county lookup.

The UI stores this object in the Yar value keyed by `submissionFormState`, under `formData.clientDetails`. Each submission page should preserve the existing `submissionFormState` properties and update only its own section of `formData`.

| Concept | Cardinality | Validation / notes |
|---|---:|---|
| `clientDetails` | One per report | Field-level requiredness and validation are listed under Step 1 above; do not infer unspecified requirements. |
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
