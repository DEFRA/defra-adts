# API Tests

This folder is for cross-service API smoke and schema tests.

Service-specific API tests can live inside the relevant service test folder.
Shared schemas and test data can be stored here where they are used by more than one service.

## Running

Run these tests from the backend service folder so they use the existing Jest toolchain:

```bash
npm run test:api --prefix services/adts-backend
```
