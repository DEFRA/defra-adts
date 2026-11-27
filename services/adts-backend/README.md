# ADTS Backend

Changes to this directory trigger the service's CI build.

The UI calls this service using `BACKEND_SERVICE_URL`. The backend forwards
submission and client lookup requests to `SUBMISSIONS_SERVICE_URL`.

## API authentication

The UI performs the browser-facing OIDC sign-in and sends its access token to
this API as a bearer token. In production, set `AUTH_MODE=live`. The backend
loads OIDC discovery metadata and validates the token signature, issuer,
audience, expiry, subject, and the Entra API scope before using its subject as
the draft owner. The backend accepts both providers:

| Provider | Required live configuration |
| --- | --- |
| Defra ID | `DEFRA_ID_WELL_KNOWN_URL`, `DEFRA_ID_API_AUDIENCE` |
| Entra ID | `ENTRA_WELL_KNOWN_URL`, `ENTRA_API_AUDIENCE`, `ENTRA_API_SCOPE` |

These are API resource identifiers, not client secrets. The Entra UI deployment
must request the configured `ENTRA_API_SCOPE`. Configure audience/scope values
from the corresponding API registrations; do not use placeholder values in a
live deployment.

Tests use mock authentication, while the repository's local full-stack setup
validates the Defra ID stub's signed access token. Production rejects mock mode.
The development-only `AUTH_ALLOW_INSECURE_LOCAL=true` setting permits HTTP
identity URLs only when their hostname is `localhost`; production continues to
require HTTPS and both provider configurations. Health and connection-health
routes remain unauthenticated.

After authentication, the backend resolves the token's CI subject to a LIMS ID
using the CI-to-LIMS mapping table. Users without a mapping receive `403` and
cannot look up clients, view submissions, or create drafts. The UI also stores
the resolved PVS ID in the authenticated session; backend requests resolve the
mapping independently and never trust a browser-supplied PVS identifier. Draft
reads and writes remain scoped to the validated issuer-and-subject pair.

For local development, start the seeded local DynamoDB from the repository root:

```bash
./local/dynamodb/test-db.sh up
```

Then start the submissions service on port 3100 and the backend on port 3200:

```bash
PORT=3100 npm start --prefix services/adts-submissions-service
NODE_ENV=development AUTH_MODE=mock \
DYNAMODB_ENDPOINT=http://localhost:8000 \
AWS_ACCESS_KEY_ID=local \
AWS_SECRET_ACCESS_KEY=local \
PORT=3200 \
SUBMISSIONS_SERVICE_URL=http://localhost:3100 \
npm start --prefix services/adts-backend
```

Verify the reference data connection with `curl http://localhost:3200/GetSpecies`.
It should return the seeded species list. A `502` from this endpoint usually means
the backend is not configured to use the local DynamoDB or the local database is
not running; restart the backend after changing its environment variables.

`GET /submission-references?clientId=<id>&clientName=<name>&clientFarm=<farm>`
returns matching submitted LIMS references as a string array for the clinical
history autocomplete. `clientId` is forwarded to the submissions service when
available; client name and farm are matched against the returned records.

## Running tests

From the repository root:

```bash
# Route and unit coverage run used in CI
npm run test:coverage --prefix services/adts-backend

# Backend integration tests against local DynamoDB
TEST_CONTAINER_ENGINE=podman npm run test:integration --prefix services/adts-backend
# or
TEST_CONTAINER_ENGINE=docker npm run test:integration --prefix services/adts-backend

# Backend API contract tests
npm run test:contract --prefix services/adts-backend

# Cross-service API health/schema tests
npm run test:api --prefix services/adts-backend
```

### Integration test prerequisites

- Node.js 24.x and npm
- Podman or Docker with Compose available
- Port `8000` free for local DynamoDB

The integration command starts and resets local DynamoDB via
`local/dynamodb/test-db.sh`. Stop local test containers after local runs:

```bash
npm run test:db:down
```

## Reference data (DynamoDB)

`GET /GetSpecies` reads the species from the DynamoDB reference data table and returns
`[{ "speciesId": "<code>", "name": "<description>" }]`, in the table's configured order.
It returns `502` if DynamoDB can't be reached.

`GET /GetAnimalDetails?speciesId=<code>` returns the reference-data options used by the
animal-details form: `ageCategories`, `purposes`, `keepingTypes`, `breeds`, and `sexes`,
plus the age indicators `ageUnits` (Days, Weeks, Months, and Years) and
`organicAccreditationApplicable`. Breed and purpose rows are selected from their
shared type partitions by `speciesCode`. Options with an `isAvian` attribute are
matched to the species' avian status, and sex options marked `excludeAvian` are
omitted for avian species. `forAvianSpecies` and `excludeSpeciesLimsCodes` are also
respected when present. It returns `400` when `speciesId` is missing, `404` for an
unknown species, and `502` if DynamoDB can't be reached.

| Variable | Default | Purpose |
|---|---|---|
| `DYNAMODB_ENDPOINT` | AWS default | Set to `http://localhost:8000` to use the [local DynamoDB](../../local/dynamodb/README.md). |
| `AWS_REGION` | `eu-west-2` | AWS region. |
| `REFERENCE_DATA_TABLE` | `adts-reference-data` | Reference data table name. |
| `CI_LIMS_MAPPING_TABLE` | `adts-ci-lims-mapping` | Maps an authenticated CI subject (`PK`) to its LIMS ID (`limsId`). |

The local DynamoDB SDK connection requires dummy credentials, provided in the
backend start command above. These credentials are for DynamoDB Local only; do
not use them when connecting to AWS.
