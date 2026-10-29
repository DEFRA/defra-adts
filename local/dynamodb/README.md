# Local DynamoDB for ADTS

A local [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html) instance that implements the data model in [docs/test-database.md](../../docs/test-database.md), for testing service integrations on your machine.

## Usage

Requires Docker Compose or Podman Compose and a running container engine. The harness selects `podman compose`, `docker compose`, or the standalone `docker-compose` client when available. Run these commands from the repository root:

```bash
./local/dynamodb/test-db.sh up                 # start and wait for DynamoDB and initialization
./local/dynamodb/test-db.sh reset              # recreate tables and restore seeded data
SEED_DATA=false ./local/dynamodb/test-db.sh reset  # recreate empty tables
./local/dynamodb/test-db.sh down               # stop containers; keep the volume data
```

`up` starts DynamoDB and waits for the database to become healthy and the initialization job to finish. `reset` drops and recreates the tables, so it removes records left by previous runs before loading the selected state. Seeded data is the default; set `SEED_DATA=false` for empty tables. Repeating either reset produces the same state.

When both engines are installed, set `TEST_CONTAINER_ENGINE=docker` or `TEST_CONTAINER_ENGINE=podman` to select one explicitly. The default `auto` mode detects an available engine.

Each test invocation exports a unique `TEST_RUN_ID` unless one is supplied. The integration npm script and Playwright create one ID per run and pass it through database setup; Playwright also passes it to the backend.

On Windows, run the shell commands from a WSL 2 Linux distribution with Docker Desktop WSL integration enabled. They do not run directly in PowerShell or Command Prompt. See the [feature quickstart](../../specs/002-local-dynamodb/quickstart.md) for WSL 2 setup.

To wipe the persisted database volume as well as stop the containers, run:

```bash
docker compose -f local/dynamodb/docker-compose.yml down -v
# Or: podman compose -f local/dynamodb/docker-compose.yml down -v
```

The optional browser UI is available at `http://localhost:8001` when started with the Compose `ui` profile:

```bash
docker compose -f local/dynamodb/docker-compose.yml --profile ui up -d
# Or: podman compose -f local/dynamodb/docker-compose.yml --profile ui up -d
```

## Connecting from a service

| Setting | Value |
|---|---|
| Endpoint | `http://localhost:8000` |
| Region | `eu-west-2` (any value works) |
| Access key / secret | any non-empty value, e.g. `local` / `local` |

For the AWS SDK v3 set `endpoint: 'http://localhost:8000'`, or export `AWS_ENDPOINT_URL_DYNAMODB=http://localhost:8000`. From another container on the same Compose network use `http://dynamodb:8000`.

## Tables

| Table | Key | Indexes |
|---|---|---|
| `adts-reference-data` | `PK` + `SK` | `ByCode` (`GSI1PK`/`GSI1SK`), `ByName` (`GSI2PK`/`GSI2SK`), `ByAvian` (`GSI3PK`/`GSI3SK`) |
| `adts-submissions` | `PK` | `ByUser` (`GSI1PK`/`GSI1SK`), `ByPractice` (`GSI2PK`/`GSI2SK`) |
| `adts-ci-lims-mapping` | `PK` | none |

Definitions live in [tables/](./tables) and sample data in [seed/](./seed) (DynamoDB JSON). To change a schema, edit the definition and run `./local/dynamodb/test-db.sh reset` to recreate the tables from the updated definitions.
