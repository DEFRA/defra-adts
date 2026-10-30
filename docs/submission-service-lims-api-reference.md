# ADTS Submission Service — Legacy LIMS API Reference

**Status:** Working reference based on observed interactions in the current application, not an authoritative or complete LIMS OpenAPI contract.

## Integration overview

The current application constructs LIMS URLs as:

`lims-api-url` + `lims-prefix` + relative endpoint path

The host and prefix are environment-configured, so full URLs are not available from the tracked code. Requests use HTTP Basic Authentication with credentials from environment variables. **Security defect to correct:** the legacy shared client disables TLS certificate verification. The replacement must verify server certificates and configure the appropriate trusted CA chain if required.

The new ADTS architecture has UI, Backend and Submission Service containers. The Backend will call Submission Service REST endpoints; only the Submission Service may contact LIMS directly. The Backend-facing REST API has **not yet been designed** and should not be confused with the LIMS endpoint list below.

## Known LIMS endpoints

GET examples below represent query parameters, not JSON request bodies. POST examples represent JSON request bodies. Values are illustrative.

| Method | Relative LIMS endpoint | Example query/body | Purpose / response |
|---|---|---|---|
| GET | `general/getpingOK` | No parameters | LIMS health check; used on login screen and by PVS-online check. |
| GET | `general/getProducts` | `{"filter":"mastitis","species":"CATTLE"}` | Product search; `filter` required, `species` optional; returns product records. |
| GET | `general/getClients` | `{"pvsId":"PVS001","filter":"Smith"}` | Client search; returns matching client details. |
| GET | `general/getPVS` | `{"pvsId":"PVS001"}` | Retrieve practice/PVS details. |
| GET | `submissions/getSubmissionIdList` | `{"pvsid":"PVS001","filter":"SUB-123"}` | Retrieve submission IDs; note lowercase `pvsid`. |
| GET | `submissions/getSubmissions` | `{"pvsid":"PVS001","filter":"SUB-123","clientId":"C-456","status":"Submitted","clinician":"Example Vet","submittedDateBegin":"2026-10-01","submittedDateEnd":"2026-10-30"}` | Search submissions; other filters optional; lowercase `pvsid`. |
| GET | `submissions/getSubmission` | `{"submissionId":"DRAFT-123","pvsId":"PVS001"}` | Load submission/draft for editing; response mapped to full submission object. |
| GET | `submissions/viewSubmission` | `{"submissionId":"SUB-123","pvsId":"PVS001","isDraft":false}` | View past submission, charges, test statuses and sample addresses. |
| GET | `submissions/getDeliveryAddresses` | `{"pvsId":"PVS001","draftSubmissionId":"DRAFT-123"}` | Retrieve draft delivery/sample addresses. |
| GET | `submissions/getLatestReleasedResults` | `{"pvsId":"PVS001","submissionId":"SUB-123"}` | Latest released results and charges. |
| GET | `submissions/getReleaseSummaryAndReport` | `{"pvsId":"PVS001","submissionId":"SUB-123"}` | Release summary/report response; exact media type/schema to verify. |
| POST | `submissions/createUpdateDraftSubmission` | Full serialized `Submission` object (example below) | Create/update draft; returns `draftSubmissionId`. Called on saves and again before confirmation. |
| POST | `submissions/confirmDraftSubmission` | `{"draftSubmissionId":"DRAFT-123","pvsId":"PVS001"}` | Confirm draft; returns `submissionId`. |
| POST | `submissions/cancelSubmission` | `{"pvsId":"PVS001","submissionDraftId":"DRAFT-123","clinician":"Example Vet"}` | Request cancellation; returns object with `errorMessages` and `hasErrors`. Note `submissionDraftId` key. |

## Abbreviated draft submission payload

The real request is the JSON serialization of the legacy `Submission` object. This is **not** a complete schema.

```json
{
  "draftSubmissionId": "DRAFT-123",
  "submissionType": "Routine",
  "pvsId": "PVS001",
  "clientName": "Example Farm",
  "clientCPHH": "12/345/6789",
  "clinician": "Example Vet",
  "resultsReadyConfirmationEmail": "vet@example.test",
  "animalSpeciesId": "CATTLE",
  "animalBreedId": "BREED-1",
  "animals": [{"id": "ANIMAL-1", "name": "Cow 1"}],
  "dateSamplesTaken": "30/10/2026",
  "clinicalSign1Id": "SIGN-1",
  "clinicalSignDurationId": "DURATION-1",
  "clinicalHistory": "Illustrative history",
  "products": [
    {
      "productId": "TEST-1",
      "productType": "TEST",
      "isFOP": false,
      "isSOP": false,
      "animalSamples": [{"animalId": "ANIMAL-1", "animalName": "Cow 1", "sampleId": "SAMPLE-1", "poolGroup": null}],
      "sampleTypes": [{"packageProductId": "", "sampleType": "BLOOD"}],
      "options": []
    }
  ],
  "samplesWillSendToSeparateAddresses": false,
  "canUseSurveillance": false,
  "sendersReference": "REF-001"
}
```

Additional serialized fields include client/animal addresses, herd counts, additional clinical signs, previous-submission details, other animal IDs, `cancelSubmission`, and `masterSubmissionId`. Inspect the actual legacy source to establish field types, optionality and nested shapes.

## Legacy source of truth

- `Submission.php` — complete legacy submission model and serialization.
- `LimsApiClient.php` — request construction, credentials and transport behaviour.
- Relevant callers and mapping code — exact validation rules, error handling and response transformations.

These files have **not** been provided or inspected in this exercise. Do not invent their contents.

## Known defects and compatibility traps

1. **TLS verification disabled:** must not be carried forward.
2. **Parameter spelling differs by endpoint:** `pvsid` is used for two submission search endpoints, while most other endpoints use `pvsId`.
3. **Cancellation parameter:** `submissionDraftId` differs from `draftSubmissionId` used elsewhere.
4. **Dispatch-note call-site issue:** the existing dispatch-note path calls the delivery-address service with an empty parameter array, although the service requires `draftSubmissionId`. That path fails validation before sending the HTTP request. The normal delivery-address lookup supplies the ID. Do not reproduce the defect blindly.
5. **Business-level errors:** cancellation responses may indicate errors using `hasErrors` and `errorMessages` even when an HTTP response is successfully received.
6. **Unknown contracts:** exact response schemas, status codes, date conventions beyond shown examples, report formats, pagination and idempotency are not established here.

## Questions for clarification and contract discovery

- What is the intended Backend-facing API, including route naming and response envelope?
- Does the Submission Service validate and transform domain objects, or forward already-validated LIMS-compatible payloads?
- How are callers authenticated/authorized, and how is PVS ownership enforced?
- How are transport errors and LIMS business errors represented to Backend consumers?
- What is the policy for retries, timeouts and ambiguous outcomes of draft confirmation/cancellation?
- How are LIMS certificates trusted in each environment?
- Are result/report payloads JSON, files or other media types?
- Is there an authoritative LIMS API specification or test environment against which to verify these observations?

## Intended usage

Keep this file in the repository as technical reference material. Use it when drafting the feature specification and implementation plan, but distinguish confirmed legacy behaviour from architectural decisions that remain open.
