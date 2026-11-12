# ADTS Submissions Service

Changes to this directory trigger the service's CI build.

The service provides `GET /GetClients`, which retrieves clients from the v1 LIMS
`GET ${LIMS_API_URL}/general/getClients` endpoint, passing the configured `LIMS_PVS_ID`
and an empty `filter`. The LIMS response is returned to the backend, which exposes the
operation to the UI as `GET /GetClients`. Both `LIMS_API_URL` and `LIMS_PVS_ID` are
required for this lookup.
