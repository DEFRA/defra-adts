# Dynamo Data Model

Animal Disease Testing Service

Version 1.0 · 2026

## 1. Overview & Purpose

This document defines the DynamoDB data model for the ADTS service, including the required access patterns, table structures, primary key design and secondary indexes.

## 2. Table 1 - Reference Data

### Access Patterns

| Reference table(s) | Access patterns |
|---|---|
| `species` | List species; look up by LIMS code; filter avian or common status; search descriptions. |
| `species_animal_breeds` | List breeds for a species, ordered by configured index; use generic breeds when no species-specific entries exist; search descriptions within a species. |
| `species_animal_purposes` | List purposes for a species or avian category, ordered by index; fall back to generic purposes when needed. |
| `species_housings`, `sex_groups`, `age_categories`, `clinical_signs` | List all or filter by avian status; return in configured order; look up by LIMS code. |
| `counties` | List counties; look up by LIMS code or county name. |
| `pvs_practices` | List practices; check uniqueness by name or LIMS code; exclude soft-deleted practices where appropriate. |
| `organic_environment` | List options or look up by LIMS code. |
| `information_messages` | Look up a message by name; list messages for administration. |
| `test_recommendations`, `test_advices` | Progressive filtering by species, sample type, and disease; retrieve matching recommendations, including age category, condition/cause, and tests. |

### Recommended Design

Use one table for reference/configuration records. The partition key groups records by lookup type and, where needed, species. The sort key provides the existing manual ordering.

| Attribute | Purpose |
|---|---|
| `PK` (String) | `REF#<type>` for ordinary lists; `REF#<type>#SPECIES#<speciesCode>` for species-scoped lists. |
| `SK` (String) | `ORDER#<zero-padded-index>#<code>`; records sort in the configured order. |
| `type`, `code`, `description`, `index` | Common attributes; keep entity-specific fields such as `isAvian`, `mostCommon`, `forAvianSpecies`, and `excludeSpeciesLimsCodes` as attributes. |

### Indexes

| Index | Keys | Supports |
|---|---|---|
| ByCode GSI | `GSI1PK=CODE#<type>`, `GSI1SK=<scope>#<code>` | Look up a species, breed, purpose, county, or clinical sign by code. Include species scope for breed/purpose codes. |
| ByName GSI | `GSI2PK=NAME#<type>`, `GSI2SK=<normalizedName>` | County name lookup and practice name checks. |
| ByAvian GSI | `GSI3PK=AVIAN#<type>#<0-or-1>`, `GSI3SK=ORDER#<index>#<code>` | Ordered avian/non-avian lists without reading and filtering the whole type partition. |

### Example Records

```json
{
  "PK": "REF#SPECIES",
  "SK": "ORDER#0001#CHICKEN",
  "type": "SPECIES",
  "code": "CHICKEN",
  "description": "Chicken",
  "mostCommon": "Yes",
  "index": 0
}
```

```json
{
  "PK": "REF#COUNTY",
  "SK": "ORDER#0001#AB",
  "type": "COUNTY",
  "code": "AB",
  "name": "Argyll and Bute",
  "index": 0,
  "GSI1PK": "CODE#COUNTY",
  "GSI1SK": "AB",
  "GSI2PK": "NAME#COUNTY",
  "GSI2SK": "argyll and bute"
}
```

## 3. Table 2 - Submission Data

### Access Patterns

Submission data is created as a user progresses through the ADTS submission journey. A submission may be saved as a draft and updated multiple times before the user completes and submits it.

| Access pattern | Description |
|---|---|
| Create and save submission | Store the submission as the customer completes each page; update it as they continue. |
| Retrieve and update submission | Find a submission by its unique identifier to load or change it. |
| Search submissions | Find submissions by practice or user ID. |
| Submit to LIMS | When the customer completes the journey, the record will be removed from our database. |

The submission forms contain a large number of fields. These fields are not required as search or query criteria and therefore do not need to form part of the DynamoDB key or index design.

A submission can instead be stored as a document containing the complete form state. This allows the application to retrieve and update the submission without modelling every individual form field as part of the table's access pattern.

### Recommended Design

Each submission is stored as a single item, identified by a unique `submissionId`.

Global Secondary Indexes (GSI) are used to support retrieval of submissions belonging to a specific user or practice.

| Key or index | Partition key | Sort key | Use |
|---|---|---|---|
| Table primary key | `PK = SUBMISSION#<submissionId>` | None required | Get, update, or delete one submission by its unique ID. |
| GSI ByUser | `GSI1PK = USER#<userId>` | `GSI1SK = UPDATED#<timestamp>#<submissionId>` | Find a user’s submissions, newest first. |
| GSI ByPractice | `GSI2PK = PRACTICE#<practiceId>` | `GSI2SK = UPDATED#<timestamp>#<submissionId>` | Find a practice’s submissions, newest first. |

### Example Record

```json
{
  "PK": "SUBMISSION#submission-123",
  "submissionId": "01JEXAMPLE...",
  "practiceId": "practice-123",
  "userId": "user-456",
  "formData": {
    "clientDetails": {},
    "animalDetails": {},
    "clinicalHistory": {},
    "tests": {},
    "delivery": {}
  },
  "createdAt": "2026-10-06T10:00:00Z",
  "updatedAt": "2026-10-06T10:15:00Z",
  "GSI1PK": "USER#user-456",
  "GSI1SK": "UPDATED#2026-10-06T10:15:00Z#submission-123",
  "GSI2PK": "PRACTICE#practice-123",
  "GSI2SK": "UPDATED#2026-10-06T10:15:00Z#submission-123"
}
```

## 4. Table 3 - CI Lims ID Mapping

### Access Patterns

LIMS ID data provides a link between an authenticated ADTS user and their corresponding LIMS ID.

This mapping is required during the login process so that the application can retrieve the LIMS ID associated with the authenticated user.

The primary access pattern is:

| Access pattern | Description |
|---|---|
| Get LIMS ID by CI ID | Retrieve the LIMS ID associated with a specific authenticated user (CI ID). |

The mapping is expected to be one-to-one, with each ADTS user associated with a single LIMS ID.

### Recommended Design

Each user-to-LIMS mapping is stored as a single item, identified by the user's unique ID.

The user ID is used as the table's partition key, providing direct access to the corresponding LIMS ID during login.

| Attribute | DynamoDB type | Key | Purpose |
|---|---|---|---|
| `PK` | String | Partition Key | Unique identifier for the authenticated ADTS user (CI ID). |
| `ciID` | String | — | Authenticated ADTS user's CI ID. |
| `limsId` | String | — | LIMS ID associated with the user. |

This supports:

```text
Get LIMSID for CIuser:
CIuserId = "USER-123"
```

No sort key or secondary index is required because the table contains a single mapping for each user and the only required access pattern is retrieval by user ID.

### Example Record

```json
{
  "PK": "USER-123",
  "ciID": "USER-123",
  "limsId": "LIMS-456789"
}
```
