# Local DynamoDB for ADTS

A local [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html) instance that implements the data model in [docs/test-database.md](../../docs/test-database.md), for testing service integrations on your machine.

## Usage

Requires Docker with the Compose plugin.

```bash
cd local/dynamodb
docker compose up -d                    # start, create tables, load sample data
docker compose --profile ui up -d       # as above, plus a browser UI at http://localhost:8001
docker compose down                     # stop (data is kept in a Docker volume)
docker compose down -v                  # stop and wipe all data
SEED_DATA=false docker compose up -d    # create empty tables only
```

Table creation is idempotent, so re-running `docker compose up init` is safe. It re-applies the sample data.

## Connecting from a service

| Setting | Value |
|---|---|
| Endpoint | `http://localhost:8000` |
| Region | `eu-west-2` (any value works) |
| Access key / secret | any non-empty value, e.g. `local` / `local` |

For the AWS SDK v3 set `endpoint: 'http://localhost:8000'`, or export `AWS_ENDPOINT_URL_DYNAMODB=http://localhost:8000`. From another container on the same Docker network use `http://dynamodb:8000`.

## Tables

| Table | Key | Indexes |
|---|---|---|
| `adts-reference-data` | `PK` + `SK` | `ByCode` (`GSI1PK`/`GSI1SK`), `ByName` (`GSI2PK`/`GSI2SK`), `ByAvian` (`GSI3PK`/`GSI3SK`) |
| `adts-submissions` | `PK` | `ByUser` (`GSI1PK`/`GSI1SK`), `ByPractice` (`GSI2PK`/`GSI2SK`) |
| `adts-ci-lims-mapping` | `PK` | none |

Definitions live in [tables/](./tables) and sample data in [seed/](./seed) (DynamoDB JSON). To change a schema, edit the definition and run `docker compose down -v && docker compose up -d`.
