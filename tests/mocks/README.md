# Test Mocks

This folder is for shared mocks and stubs used by tests.

Expected mock areas:
- LIMS
- Customer Identity
- Entra ID
- Microsoft Graph API

Mocks that belong only to one service can remain inside that service test folder.

## Defra ID stub (local sign-in)

`npm run dev` starts DynamoDB and the full local stack, including DEFRA's
[cdp-defra-id-stub](https://github.com/DEFRA/cdp-defra-id-stub). To start only the
stub and app services when DynamoDB is already running, use `npm run dev:defra-id-stub`.
The stub is cloned on first run into the git-ignored `defra-id-stub/.cache` and listens
on port 3400; the UI uses live mode against it. It requires Node 24 or later.
`AUTH_ALLOW_INSECURE_LOCAL=true` permits HTTP cookies and URLs only for a `localhost`
public base URL.

To demonstrate the redirect, open `http://localhost:3000/` in a private window: you are
redirected to `/auth/defra-id/start`, then to
`http://localhost:3400/cdp-defra-id-stub/authorize?...`. Register a test user at
`http://localhost:3400` to complete sign-in. Client ID `63983fc2-cfff-45bb-8ec2-959e21062b9a`
and secret `test_value` are the stub's published defaults, not real credentials.

The local backend uses mock authentication with `LOCAL_DRAFT_OWNER_ID=user-456`
by default, which has a seeded LIMS mapping. To demonstrate an authenticated
session without a mapping, start the stack with
`LOCAL_DRAFT_OWNER_ID=demo-unmapped npm run dev`; that subject has no mapping,
so protected pages return `403`. This changes the backend's mock subject; it
does not change the subject issued by the OIDC stub.
