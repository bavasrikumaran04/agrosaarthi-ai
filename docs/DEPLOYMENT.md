# Deployment (live, verified 2026-10-23)

| Part | Where | URL |
|---|---|---|
| Web app (Angular SPA) | Vercel project `agrosaarthi-ai` (`frontend/vercel.json`: SPA fallback + `/api/*` proxy) | https://agrosaarthi-ai.vercel.app |
| API (Express, serverless function `backend/api/index.mjs`) | Vercel project `agrosaarthi-api` | https://agrosaarthi-api.vercel.app/api/health/ready |
| Model service (FastAPI + ONNX Runtime, `model-service/api/index.py`) | Vercel project `agrosaarthi-model` (Python 3.12) | https://agrosaarthi-model.vercel.app/ready |
| Database | MongoDB Atlas M0, project `agrosaarthi-ai`, cluster `agrosaarthi` (AWS us-east-1), user `agrosaarthi-api` (readWrite on `agrosaarthi`) | — |
| Model weights | GitHub Release `model-2026.10.23-pv38` — downloaded to `/tmp` and SHA-256-verified on cold start | — |

Browsers only talk to `agrosaarthi-ai.vercel.app`; `/api` is proxied to the API, so the refresh cookie is first-party.
Secrets (MongoDB URI, JWT/encryption/hash/signing keys, model-service token) are Vercel environment variables only.

## Redeploy
`vercel deploy --prod` from `frontend/`, `backend/` or `model-service/` (each folder is linked to its Vercel project).
`render.yaml` remains as an alternative (Render) blueprint; it is not used by the live deployment.

## Verified on the public deployment
- Playwright suite (7 journeys) with `E2E_BASE_URL=https://agrosaarthi-ai.vercel.app`: 7 passed.
- Demo farmer uploads `Tomato__Late_blight.jpg` → API 201 → model service → "Tomato — Late blight", LIKELY_MATCH, not simulated.
- Admin/case endpoints: 401 without a token, 403 for a farmer on admin routes; login without the CSRF header: 400.
- Data persists across a backend redeploy (Atlas).

## Limits
- Uploaded photos are stored in the function's `/tmp` (ephemeral, per instance): the photo may not be viewable later from
  the expert page. Configure S3-compatible storage (`STORAGE_PROVIDER=s3`) for durability.
- Rate limits are in-memory per serverless instance (weaker than on a single server).
- Cold starts: first request after idle can take several seconds (model download ≈16 MB).
- Gemini, server-side speech, telephony and SMS are not configured.
