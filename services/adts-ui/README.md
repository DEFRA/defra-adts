# ADTS UI

Changes to this directory trigger the service's CI build.

## Sign-in

The UI uses DEFRA's Hapi OIDC plugins. Deploy the same UI image separately for
each audience, configuring one provider per deployment:

- `AUTH_PROVIDER=defra-id` for veterinary-practice users signing in with Defra
  Customer Identity.
- `AUTH_PROVIDER=entra` for staff signing in with Microsoft Entra ID.

Local development defaults to Defra ID mock mode. Production must set
`AUTH_PROVIDER` and `AUTH_MODE=live`; mock authentication is rejected in
production. Live configuration is supplied through environment variables and
secrets, not source control:

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
The Backend keeps client lookups and non-draft submission searches disabled
until the applicant organization-to-PVS mapping and staff role policy are
defined. Draft ownership uses the validated issuer-and-subject pair.

