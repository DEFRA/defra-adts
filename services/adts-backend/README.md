# ADTS Backend

Changes to this directory trigger the service's CI build.

The UI calls this service using `BACKEND_SERVICE_URL`. The backend forwards
submission and client lookup requests to `SUBMISSIONS_SERVICE_URL`.

For local development, run the submissions service on port 3100, then start
the backend with:

```bash
PORT=3200 SUBMISSIONS_SERVICE_URL=http://localhost:3100 npm start
```

## Reference data (DynamoDB)

`GET /GetSpecies` reads the species from the DynamoDB reference data table and returns
`[{ "speciesId": "<code>", "name": "<description>" }]`, in the table's configured order.
It returns `502` if DynamoDB can't be reached.

| Variable | Default | Purpose |
|---|---|---|
| `DYNAMODB_ENDPOINT` | AWS default | Set to `http://localhost:8000` to use the [local DynamoDB](../../local/dynamodb/README.md). |
| `AWS_REGION` | `eu-west-2` | AWS region. |
| `REFERENCE_DATA_TABLE` | `adts-reference-data` | Reference data table name. |

Locally, the SDK also needs credentials, so set `AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local`.

