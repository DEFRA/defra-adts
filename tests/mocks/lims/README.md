# Standalone LIMS Mock

This local-only HTTP server implements the observed legacy LIMS endpoints used by the ADTS Submission Service. It uses synthetic data and in-memory draft/submission state; restarting it resets state. It is not authoritative LIMS behavior and must never be exposed publicly or used with production credentials/data.

## Start

From the repository root, start the mock:

```sh
LIMS_USERNAME=e2e-user LIMS_PASSWORD=e2e-password npm run mock:lims
```

Defaults: bind `127.0.0.1:8500`, LIMS prefix `/LIMSRestAPi/`, Basic Authentication username/password `e2e-user` / `e2e-password`.

In another terminal, start the Submission Service against it:

```sh
PORT=9182 \
LIMS_BASE_URL=http://127.0.0.1:8500 \
LIMS_PREFIX=/LIMSRestAPi/ \
LIMS_USERNAME=e2e-user \
LIMS_PASSWORD=e2e-password \
LIMS_TIMEOUT_MS=2000 \
LIMS_ALLOW_HTTP=true \
npm start --prefix services/adts-submissions-service
```

`LIMS_ALLOW_HTTP=true` is required because the local mock uses HTTP and the service rejects HTTP unless the temporary exception flag is explicit. This is test-only configuration; production risk/exception rules remain in the feature spec and service README.

The mock listens only on loopback by default. Override with `HOST` or `PORT` only for isolated test environments.

## Verify

Check mock health and an authenticated LIMS request:

```sh
curl http://127.0.0.1:8500/health
curl -u e2e-user:e2e-password 'http://127.0.0.1:8500/LIMSRestAPi/general/getProducts?filter=mastitis'
```

Check the service process and product route:

```sh
curl http://127.0.0.1:9182/health
curl 'http://127.0.0.1:9182/v1/products?filter=mastitis&species=CATTLE'
```

Reset in-memory drafts and submissions:

```sh
curl -X POST http://127.0.0.1:8500/__admin/reset
```

The reset endpoint is only exposed on the loopback-bound mock.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `HOST` | `127.0.0.1` | Bind address; keep loopback for local testing. |
| `PORT` | `8500` | HTTP port. |
| `LIMS_MOCK_PREFIX` | `/LIMSRestAPi/` | Prefix removed before matching legacy endpoint paths. |
| `LIMS_MOCK_USERNAME` | `LIMS_USERNAME`, then `e2e-user` | Expected Basic Auth username. |
| `LIMS_MOCK_PASSWORD` | `LIMS_PASSWORD`, then `e2e-password` | Expected Basic Auth password. |
| `LIMS_MOCK_FAILURE_ENDPOINT` | unset | Exact relative endpoint where a failure should be injected, such as `submissions/confirmDraftSubmission`. |
| `LIMS_MOCK_FAILURE_MODE` | unset | `http-500`, `http-503`, `invalid-json`, `business-error`, or `delay`. |
| `LIMS_MOCK_DELAY_MS` | `3000` | Delay duration for `delay` mode; useful for timeout tests. |

Failure injection applies only when both endpoint and mode are configured. For example:

```sh
LIMS_MOCK_FAILURE_ENDPOINT=submissions/cancelSubmission \
LIMS_MOCK_FAILURE_MODE=business-error \
LIMS_USERNAME=e2e-user LIMS_PASSWORD=e2e-password \
npm run mock:lims
```

## Supported Operations

The mock covers health ping, product/client/PVS lookups, submission ID and record searches, draft retrieval/view, delivery addresses, latest results/charges, release-summary/PDF response, draft create/update, confirmation, and cancellation. The report endpoint returns JSON with base64 `LastReportString`; the Submission Service decodes and serves an inline PDF.

Defaults are intentionally synthetic. Upstream validation rules, idempotency, exact status transitions, complete report/result schemas, and edge-case behavior must be confirmed against the LIMS owner/test environment before relying on them as production guarantees. Draft creation allocates an in-memory ID, and the mock is reset by restarting or calling the loopback reset endpoint.
