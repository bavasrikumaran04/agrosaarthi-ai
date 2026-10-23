# Deployment

| Part | Host (free tier) | Config |
|---|---|---|
| Source + model weights | GitHub (repo + Release asset `model-2026.10.23-pv38.zip`, SHA-256 `24a313ba…98af`) | — |
| Model service (FastAPI + ONNX Runtime) | Render web service, Docker | `render.yaml` → `agrosaarthi-model`, health `/ready` (503 until the model is loaded) |
| API (Node/Express) | Render web service, Node 22 | `render.yaml` → `agrosaarthi-api`, health `/api/health/ready` |
| Database | MongoDB Atlas M0 (free) | `MONGODB_URI` secret on Render |
| Web app (Angular) | Vercel | `frontend/vercel.json` — SPA fallback + `/api/*` proxy to the API (keeps the refresh cookie first-party) |

## Steps
1. **Atlas:** create an M0 cluster, a database user (readWrite on `agrosaarthi`), network access `0.0.0.0/0`
   (Render free has no static IPs). Copy the `mongodb+srv://…/agrosaarthi` string.
2. **Render:** New → Blueprint → this repo. Fill the `sync:false` values: `MONGODB_URI`, `FRONTEND_ORIGINS` and
   `PUBLIC_BASE_URL` (the Vercel URL), `MODEL_SERVICE_URL` (the `agrosaarthi-model` public URL).
3. **Vercel:** import the repo with Root Directory `frontend`. If the API URL differs from
   `https://agrosaarthi-api.onrender.com`, edit the rewrite in `frontend/vercel.json`.
4. Create the first administrator from the Render shell: `npm run admin:create -- --email … --name "…"`.

## Verified locally (2026-10-23)
- Model service downloads the release asset, verifies SHA-256, loads the model; `/ready` = ready; held-out
  `Tomato__Late_blight.jpg` → Tomato — Late blight (0.9995).
- API starts with `NODE_ENV=production` and the settings above (production safety checks pass).

## Known free-tier limits
- Render free services sleep after ~15 min idle; the first request takes ~1 min (timeout raised to 60 s).
- Uploaded photos are on ephemeral disk (`ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true`); use S3-compatible storage
  (`STORAGE_PROVIDER=s3`) for durability.
- Gemini, speech and telephony are not configured (`none`).
