# ADTS Backend

The UI calls this service using `BACKEND_SERVICE_URL`. The backend forwards
submission and client lookup requests to `SUBMISSIONS_SERVICE_URL`.

For local development, run the submissions service on port 3100, then start
the backend with:

```bash
PORT=3200 SUBMISSIONS_SERVICE_URL=http://localhost:3100 npm start
```
