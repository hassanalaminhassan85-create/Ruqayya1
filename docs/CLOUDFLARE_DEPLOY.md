Cloudflare deployment checklist for Ruqayya1

This document explains the bindings and environment required when deploying to Cloudflare Pages / Workers.

Required Pages / Worker bindings (set these in Pages -> Functions -> Environment variables & bindings):

- R2_BUCKET: Bind the R2 bucket used for document storage as `R2_BUCKET`.
- MICROSERVICE_URL: The public URL of the Node microservice you will deploy (e.g., https://ruqayya-ms.example.com).
- MICROSERVICE_API_KEY: A strong secret token to protect microservice internal endpoints.

Optional (if using service account):
- SA_JSON: JSON string of Firebase service account credentials (used by the microservice, not Pages Functions).
- FIREBASE_SERVICE_ACCOUNT: alias for SA_JSON.

Microservice (Node) deployment

- Deploy the `microservice/index.ts` as a Node service (Cloud Run, Render, Fly, Heroku, etc.).
- Set environment variables: MICROSERVICE_API_KEY, SA_JSON (service account JSON), PORT.
- Health endpoint: GET /_health

Endpoints exposed by microservice (all protected by Authorization: Bearer <MICROSERVICE_API_KEY> except /_health):

- GET /internal/db/load
- POST /internal/db/save
- GET /internal/session/validate?token=<token>
- GET /internal/push/publicKey
- POST /internal/push/subscribe
- POST /internal/push/send

Pages Function notes

- The preview endpoint is implemented at functions/api/documents/preview.ts and expects the R2 binding to be named `R2_BUCKET` and MICROSERVICE_URL/MICROSERVICE_API_KEY to validate preview tokens.
- Ensure the Pages project has the R2 binding configured and the microservice values set.

Local development

- For local development, you can run the microservice locally:
  - node ./microservice/index.ts (or use ts-node / compile first)
  - export MICROSERVICE_API_KEY=secret
  - export SA_JSON='{"type":...}' (only if you want Firestore integration)

Security

- Keep MICROSERVICE_API_KEY secret. Do not commit it to the repository.
- If you use SA_JSON for Firebase Admin on the microservice, keep that secret in the deployment platform secrets.

Logging

- The microservice and Functions use console logging (structured JSON). Monitor logs to diagnose token validation, DB load/save, R2 access, and push sending.

CI

- Add `npm run lint` (tsc --noEmit) to CI to catch TypeScript/JSX errors before deploy.

