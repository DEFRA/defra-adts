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
| `clientId` | Client | Not specified | Search/select an existing client. The prompt says a user can search by client name, address, or CPH. Existing clients are loaded through `GetClients`; the UI enhances the select with accessible autocomplete. A result is presented with client name, farm name/address, county, postcode, and CPH as shown in the screenshot. | Screenshot and current implementation. The route accepts an empty selection, so the implementation does not currently enforce selecting a client before continuing. Whether selection should be mandatory remains unspecified. |

The page heading is “1. Client details”; its introduction says “Tell us about the owner (your client) of the animal or animals you want to test.” The client search prompt is “Enter the name of your client, their address, or the County Parish Holding (CPH) eg 48/234/2348:”. Step 1 only selects an existing client returned by the backend (`GetClients`); it does not link to, or create/edit, clients. Creating or editing a client is a separate, standalone capability (see below) that is not part of the submission journey or its session state.

### Step 2: Animal details — Species

**Evidence**

- Azure DevOps ticket SUB-07: acceptance criteria AC1, AC1a–AC1c (species selection) and AC2–AC5 (dynamic options, optional breed/sex, age detail, organic accreditation); AC4 (optional age detail with unit and estimate flag) is NOT implemented because the design screenshots show age categories only; this is tracked as to-do T010a pending product owner confirmation.
- Screenshot supplied for Step 2: heading “2. Animal details”, “Tell us about the animals you want to test.”, a “Species” radio group (Cattle, Sheep, Chicken, Pig, Turkey, Duck, Alpaca, Goat, Other), Continue, and a session-timeout note. The page also shows the selected client’s name, address, and CPH number (“No … set” when absent).
- Current implementation: species page `services/adts-ui/src/routes/submissionSpecies.js`, `services/adts-ui/src/views/submission-species.njk`, `services/adts-ui/src/backend/species.js`, `services/adts-ui/tests/routes/submission-species.test.js`; animal details page `services/adts-ui/src/routes/submissionAnimalDetails.js`, `services/adts-ui/src/views/submission-animal-details.njk`, `services/adts-ui/src/backend/animalDetails.js`, `services/adts-ui/tests/routes/submission-animal-details.test.js`.
- Design divergence from the screenshot (product owner decision): species-dependent options are not re-rendered on the species page, because that would break progressive enhancement. Continue on `/submission-02-species` saves the species and redirects to `/submission-02-animal-details`, which calls `GetAnimalDetails?speciesId=<id>` on load; the returned object supplies the other animal details. The animal details page redirects back to the species page if no species is saved.

| Field | User-facing label | Requiredness | Validation / notes | Evidence and status |
|---|---|---|---|---|
| `animalDetails.speciesId`, `animalDetails.species` | Species | Required to continue | Single value. Common species are radios; choosing “Other” reveals “Specify species”, a select enhanced with type-ahead, listing all species from `GetSpecies` (`speciesId`, `name`). The chosen name must exist in that list; its `speciesId` and name are persisted (not the “Other” marker). On return, a species outside the common list re-selects Other. Changing species discards previously saved species-dependent answers. | AC1, AC1a, AC1b, AC1c and screenshot. Implemented. |
| `animalDetails.ageCategory` | Age category | Required (no “optional” in the design) when the species offers options | Radios from `ageCategories` for the species (AC2), e.g. Adult, Mixed, Neonatal (1 week old or less), Post weaned, Pre weaned, Unknown, Doesn’t apply. Categories only in the current build. | Screenshot 3. Implemented. |
| `animalDetails.ageDetail` (`value`, `unit`, `isEstimate`) | Age detail (optional), unit, estimate flag | Optional | **To do (T010a):** AC4 requires it to be persisted alongside the age category, but the screenshots show no such fields; confirm before building. | SUB-07 AC4. Not implemented. |
| `animalDetails.purpose` | Purpose | Required when the species offers options | Radios from `purposes` for the species (AC2), e.g. Beef finisher, Dairy, Calf rearer, Captive/zoo, Suckler, I don’t know, Doesn’t apply. | Screenshot 4. Implemented. |
| `animalDetails.keepingType` | Where are they kept? (optional) | Optional | Radios from `keepingTypes` for the species (AC2), e.g. Housed, Mixed, Outdoor, I don’t know. | Screenshot 4. Implemented. |
| `animalDetails.breed` | Breed (optional) | Optional | Type-ahead (select enhanced with accessible-autocomplete) over `breeds`; shown only when the species has breeds (AC1b-style, AC3). | Screenshot 1. Implemented. |
| `animalDetails.sex` | Sex (optional) | Optional | Radios from `sexes`, e.g. Castrate, Female, Male, Mixed, I don’t know (AC3). | Screenshot 2. Implemented. |
| `animalDetails.numberOfAnimals`, `animalDetails.animalIds` | Number of animals; “Enter IDs, eg ear tag number (optional)” with one input per animal | Number defaults to 1; IDs optional | Number is 1–10 (maximum assumed). One ID input per animal, each up to 50 characters (assumed); IDs beyond the chosen number are discarded and `animalIds` is stored only when at least one ID is given. Without JavaScript all ID inputs are shown; with it only the first N. | Screenshot 2. Implemented; maximum and ID length are assumptions. |
| `animalDetails.organicAccreditation` | Is the farm accredited organic? (optional) | Optional | Radios: `yes`, `no`, `in-transition`, `unknown` (Yes, No, In transition, I don’t know); shown only when `organicAccreditationApplicable` is true for the species; unanswered is valid and not stored (AC5). | Screenshot 4. Implemented. |

Only values the user supplies are persisted; empty optional fields are omitted. A supplied value must be one of the options the backend returned for the species.

Open questions: the maximum number of animals per submission and the animal ID format (assumed 10 and 50 characters); whether the common species/age/purpose option labels come from the backend as assumed; the `GetSpecies` and `GetAnimalDetails` backend endpoints do not yet exist; the UI is built to an assumed shape (see `contracts/backend-methods.md`); the common-species list is fixed to the screenshot (matched to backend species by name); the single-species-per-submission rule is enforced by this step choosing one species for all animals; the Continue destination after this page (Clinical history) is not yet built, so the page redirects to itself.

### Standalone client management (outside the submission journey)

Authorised users can create or edit clients, but this is deliberately **not** wired into the submission pages. Step 1 only selects an existing client, which avoids pushing duplicate clients to the backend from within a submission.

- Current implementation: `services/adts-ui/src/routes/createClient.js`, `services/adts-ui/src/routes/editClient.js`, `services/adts-ui/src/routes/clientForm.js`, `services/adts-ui/src/views/create-client.njk`, and `services/adts-ui/tests/routes/create-client.test.js`.
- Routes: `/create-client` and `/edit-client/{clientId}` (the client is looked up from `GetClients`; unknown clients return 404).
- These pages neither read nor write submission form state, show no submission progress, and redirect to `/` after saving.
- Persistence is not implemented: the backend exposes no create/update client endpoint, so the POST handlers validate the payload and carry a TODO.

Fields (all optional strings; unspecified validation is not inferred): `cph`, `name`, `farmName`, `addressLine1`, `addressLine2`, `addressLine3`, `county` (displayed as returned by the backend; blank if absent), `postcode`.

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
      "clientId": ""
    }
  }
}
```

`clientId` identifies the selected existing client; a submission can only reference an existing client. Only the `clientId` is persisted. Display details (name, farm, address, county, postcode, CPH) are read from the client record returned by `GetClients` each time they are shown and are never copied into the submission. The backend returns fully formed client records, so the UI makes no separate county lookup.

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
