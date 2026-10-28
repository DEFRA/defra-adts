# Data Model: Local DynamoDB Test Tables

This describes the three tables the local DynamoDB mirrors, the access patterns they serve, and the synthetic fixtures loaded by the seeded state. The authoritative production model is [docs/test-database.md](../../docs/test-database.md). The table definitions live in [local/dynamodb/tables/](../../local/dynamodb/tables/) and the fixtures in [local/dynamodb/seed/](../../local/dynamodb/seed/).

All tables use on-demand billing (`PAY_PER_REQUEST`), which is the local equivalent of the production setting and needs no capacity planning.

## Table: `adts-reference-data`

| Key | Attribute | Notes |
|-----|-----------|-------|
| Partition key | `PK` (String) | `REF#<TYPE>`, or `REF#<TYPE>#SPECIES#<speciesCode>` for dependent lists such as breeds and purposes |
| Sort key | `SK` (String) | `ORDER#<NNNN>#<code>` so items sort in display order |

| Index | Keys | Projection | Used for |
|-------|------|-----------|----------|
| `ByCode` | `GSI1PK` / `GSI1SK` | ALL | Look up an item by type and code (`CODE#<TYPE>` / `<code>`) |
| `ByName` | `GSI2PK` / `GSI2SK` | ALL | Look up by name (`NAME#<TYPE>` / lowercase name) |
| `ByAvian` | `GSI3PK` / `GSI3SK` | ALL | Species by avian flag (`AVIAN#SPECIES#1` or `#0`) |

**Access pattern used by the backend**: `GET /GetSpecies` queries `PK = REF#SPECIES` on the base table and pages through results using `ExclusiveStartKey`. See [species.js](../../services/adts-backend/src/data/species.js).

## Table: `adts-submissions`

| Key | Attribute | Notes |
|-----|-----------|-------|
| Partition key | `PK` (String) | `SUBMISSION#<submissionId>` |

| Index | Keys | Used for |
|-------|------|----------|
| `ByUser` | `GSI1PK` (`USER#<userId>`) / `GSI1SK` (`UPDATED#<ISO timestamp>#<submissionId>`) | List a user's submissions, newest first |
| `ByPractice` | `GSI2PK` (`PRACTICE#<practiceId>`) / `GSI2SK` (same shape) | List a practice's submissions |

Attributes: `submissionId`, `practiceId`, `userId`, `formData` (JSON string), `createdAt`, `updatedAt`.

## Table: `adts-ci-lims-mapping`

| Key | Attribute | Notes |
|-----|-----------|-------|
| Partition key | `PK` (String) | The CI user identifier |

Attributes: `ciID`, `limsId`. No indexes.

## Synthetic fixtures (seeded state)

All values are synthetic. The seeded state is loaded by `test-db.sh reset` (default) and by `SEED_DATA=true` at start-up.

| Table | Count | Entities |
|-------|-------|----------|
| `adts-reference-data` | 9 | Species `CHICKEN` (avian), `COW`, `SHEEP`; breeds `HOLSTEIN` (for COW); purposes `DAIRY` (for COW); counties `AB`, `DEV`; practice `PRACTICE-123`; information message `WELCOME` |
| `adts-submissions` | 1 | `submission-123` for `practice-123`, submitted by `user-456` |
| `adts-ci-lims-mapping` | 2 | `USER-123` to `LIMS-456789`; `USER-456` to `LIMS-987654` |

Total: 12 items, below the 25-item `BatchWriteItem` limit, so the seed loads in one batch per table.

### Coverage relative to `docs/test-database.md`

The production document lists more reference types (for example further species, breeds, and purposes) than the seed contains. The seed is a deliberate subset: it covers each table, each index, and every access pattern the backend uses. Add types only when a test needs them, so the fixture set stays small and easy to review.

## Empty state

With `SEED_DATA=false` or `RESET` in empty mode, the three tables are created with keys and indexes but contain no items. Queries return an empty result, and FR-009 requires that a failed query is reported as an error, not as empty.

## Validation rules

- Every seed item must include the table's key attributes (`PK`, and `SK` for reference data).
- Index attributes are present only on items that should appear in that index. Items without `GSI*` attributes are omitted from the index (sparse index behaviour).
- Seed files must stay within 25 items per table per batch (`init.sh` enforces this in the implementation).
- No seed value may be a real person, practice, animal, or identifier.

## Test-run identifier

Each test run exports `TEST_RUN_ID`. Any test that writes items must include it in a key or attribute, so runs can be told apart. No current test writes records, so this is a convention until one does (research §8).
