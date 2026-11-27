# ADTS UI

Changes to this directory trigger the service's CI build.

## Sign-in

The UI uses DEFRA's Hapi OIDC plugins. Deploy the same UI image separately for
each audience, configuring one provider per deployment:

- `AUTH_PROVIDER=defra-id` for veterinary-practice users signing in with Defra
  Customer Identity.
- `AUTH_PROVIDER=entra` for staff signing in with Microsoft Entra ID.

Outside automated tests, set `AUTH_MODE` explicitly; the UI will not silently
sign in a mock user when the mode is missing. `AUTH_MODE=mock` uses the OIDC
plugin's built-in sample identity and does not exercise an OIDC login flow.
To test local sign-in, run `npm run dev:defra-id-stub` from the repository root;
it starts the mock OIDC provider and runs the UI in live mode.

Production must set `AUTH_PROVIDER` and `AUTH_MODE=live`; mock authentication
is rejected in production. Live configuration is supplied through environment
variables and secrets, not source control:

| Provider | Required live configuration |
| --- | --- |
| Defra ID | `DEFRA_ID_WELL_KNOWN_URL`, `DEFRA_ID_CLIENT_ID`, `DEFRA_ID_CLIENT_SECRET`, `DEFRA_ID_SERVICE_ID`, `DEFRA_ID_POLICY`, `DEFRA_ID_PUBLIC_BASE_URL` |
| Entra ID | `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_PUBLIC_BASE_URL` |

Configure each provider's registered callback
URL to match its plugin callback path (`/auth/defra-id/callback` or
`/auth/entra/callback`). The public base URL must be the externally visible
HTTPS origin of that deployment.

All application pages require sign-in; health checks, static assets, and OIDC
routes remain public. The initial policy does not check identity roles. This UI
forwards the session's access token to `adts-backend` as a bearer token; the
Backend validates it before processing API requests. Entra live mode requires
`ENTRA_API_SCOPE` so the requested access token is intended for the Backend API.
The Backend resolves the authenticated CI subject through its CI-to-LIMS
mapping table. Users without a mapping cannot access clients, submissions, or
drafts; mapped users can proceed. The UI stores the resolved PVS ID in the
authenticated session, while the Backend independently checks the mapping and
does not trust a browser-supplied ID. Draft ownership uses the validated
issuer-and-subject pair.

