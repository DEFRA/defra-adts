# ADTS Backend

Changes to this directory trigger the service's CI build.

The UI calls this service using `BACKEND_SERVICE_URL`. The backend forwards
submission and client lookup requests to `SUBMISSIONS_SERVICE_URL`.

For local development, run the submissions service on port 3100, then start
the backend with:

```bash
PORT=3200 SUBMISSIONS_SERVICE_URL=http://localhost:3100 npm start
```

## Running tests

From the repository root:

```bash
# Route/unit/component coverage run used in CI
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
plus `organicAccreditationApplicable`. Species-specific breed and purpose records take
precedence over avian-specific or generic fallbacks. Other options respect
`forAvianSpecies` and `excludeSpeciesLimsCodes` attributes when present. It returns `400`
when `speciesId` is missing, `404` for an unknown species, and `502` if DynamoDB can't
be reached.

| Variable | Default | Purpose |
|---|---|---|
| `DYNAMODB_ENDPOINT` | AWS default | Set to `http://localhost:8000` to use the [local DynamoDB](../../local/dynamodb/README.md). |
| `AWS_REGION` | `eu-west-2` | AWS region. |
| `REFERENCE_DATA_TABLE` | `adts-reference-data` | Reference data table name. |

Locally, the SDK also needs credentials, so set `AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local`.
