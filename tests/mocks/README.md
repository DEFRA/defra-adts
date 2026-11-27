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
`http://localhost:3400/cdp-defra-id-stub/authorize?...`. Register
`demo.mapped@example.com` at `http://localhost:3400` to sign in with the stable
subject `b198e14c-19e4-4a94-8953-72b4a1f2c835`, which is mapped to `PVS001` in
local DynamoDB. Any other email receives a generated subject with no mapping and
should be denied access with `403`. Re-registering the mapped email replaces its
previous registration with the stable subject. Client ID
`63983fc2-cfff-45bb-8ec2-959e21062b9a` and secret `test_value` are the stub's
published defaults, not real credentials.

If local DynamoDB was initialized before this mapping was added, run
`npm run test:db:reset` to reload the seed. This resets all local tables and
removes locally stored submissions.

The local backend validates the OIDC stub's signed access token and resolves its
`sub` against the same CI-to-LIMS mapping table used outside local development.
The email is used by the stub to find a registration; it is not the mapping key.
The `AUTH_ALLOW_INSECURE_LOCAL` setting is restricted to HTTP URLs on `localhost`
in development so the local stub can be used without relaxing production
authentication.
