# Quickstart: Animal Disease Submission

## Prerequisites

- Node.js 24.x and npm.
- Dependencies installed for `services/adts-ui`, `services/adts-backend`, and `services/adts-submissions-service`.
- The backend's own configured draft-storage dependency. The UI requires only a reachable backend service and has no DynamoDB configuration.
- A LIMS test endpoint or deterministic mock that supports submission creation, LIMS-generated submission IDs, and stable idempotency keys.
- A configured `SESSION_SECRET` of at least 32 characters for the UI and service URLs:
  - UI `BACKEND_SERVICE_URL`
  - Backend `SUBMISSIONS_SERVICE_URL` and its own storage configuration
  - Submissions service `LIMS_BASE_URL`

## Start the services

Run each service in a separate terminal, with the backend's storage dependency and a LIMS mock available:

```bash
PORT=9180 LIMS_BASE_URL=http://localhost:8500 npm start --prefix services/adts-submissions-service
PORT=9182 SUBMISSIONS_SERVICE_URL=http://localhost:9180 npm start --prefix services/adts-backend
PORT=9181 SESSION_SECRET=test-session-secret-with-at-least-32-characters BACKEND_SERVICE_URL=http://localhost:9182 npm start --prefix services/adts-ui
```

Configure backend-owned storage separately according to the backend service's development setup. The UI calls backend methods including `createUpdateDraft`, `getDraft`, `getClients`, `getCounties`, `getSpecies`, `getAnimalDetails`, `getTests`, and `completeSubmission`; it does not configure or access the draft table.

## Validate the journey

1. Open `http://localhost:9181` and start a new animal disease report.
2. Complete the mandatory stages in order, add at least one test kit, enter a delivery address, and review the report.
3. Verify the UI obtains form options through the appropriate lookup methods, and each successful progression calls `createUpdateDraft` with the complete form snapshot and saved page.
4. Start a new browser session, call `getDraft` to reopen the draft, and verify the report and last saved page are restored from the backend.
5. Submit the report using `completeSubmission` and verify the LIMS test double receives one report and the selected tests with a stable draft ID as the idempotency key, then returns its LIMS-generated submission ID, with no payment request.
6. Verify a confirmed submission displays document references without requiring the UI to know the submission ID; a failure must not display a success confirmation and must be safely retryable.
7. Repeat with an empty basket, invalid report answers, unavailable kit, stale revision, backend draft-service outage, and LIMS outage. Ensure the user cannot bypass required steps and receives actionable errors without losing the last confirmed draft.

## Test commands

Run the suites in constitution order:

```bash
npm run test:unit --prefix services/adts-ui
npm run test:integration --prefix services/adts-ui
npm run test:routes --prefix services/adts-ui
npm test --prefix services/adts-backend
npm test --prefix services/adts-submissions-service
npm run test:e2e:chromium
```

Use the service-specific Jest commands available in each `package.json` if test selectors are organized differently during implementation. Also run service lint/build commands and the configured coverage report; new code must meet the constitution's 90% coverage threshold or have an approved exception.

See [data-model.md](./data-model.md) and [backend-methods.md](./contracts/backend-methods.md) for the expected persisted state and UI-to-backend method boundary.
