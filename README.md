# AgroSaarthi AI

**AI-powered crop disease detection and multilingual (Tamil / English) assistance for farmers** — academic prototype.

Farmers upload a leaf photo and get possible diseases with an honest confidence estimate; unclear or unfamiliar
photos are sent to an agricultural expert, who can answer in the app and call the farmer back. A browser simulator
shows how the planned telephone line for basic phones would work.

## What works (verified locally)

| Area | Status |
|---|---|
| Angular web app (Tamil default, English), farmer / expert / admin roles | Working — unit + browser E2E tests |
| Accounts, JWT + refresh-token rotation, RBAC, audit log, encrypted phone numbers | Working |
| Photo check: upload → validation & EXIF/GPS strip → Python model service (ONNX) → quality + out-of-domain checks | Working |
| Disease model `agrosaarthi-leaf-classifier 2026.10.23-pv38` (MobileNetV3 + trained head, 38 PlantVillage classes) | 95.9 % top-1 on 3,577 held-out **lab** photos (leaf-disjoint split). Field-photo accuracy **not measured** |
| Cases, expert assignment, assessments, call-back requests | Working |
| Phone-line (IVR) **simulator** in the browser | Working — no real telephony |
| Gemini AI assistant, server-side speech, real telephony, SMS | **Not implemented / not configured** |

## Architecture

```
Angular 21 SPA (frontend/)  ──/api──▶  Node 20+ / Express 5 API (backend/)  ──▶  MongoDB
                                              │
                                              └──HTTP + bearer token──▶  Python FastAPI + ONNX Runtime (model-service/)
ml/train_head.py  ──produces──▶  model.onnx + model_card.json  (contract: model-service/MODEL_ARTIFACT_CONTRACT.md)
```

## Run locally (Windows)

One-time setup is described in [docs/LOCAL_RUN.md](docs/LOCAL_RUN.md). Then:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-demo.ps1   # MongoDB, model service, API, web app → http://localhost:4200
```

Tests: `backend: npm test` · `model-service: python -m pytest -q` · `frontend: npx ng test --watch=false` · `e2e: npx playwright test`.

## Model weights

Weights are not stored in Git. The trained model is published as a GitHub Release asset (`model-2026.10.23-pv38.zip`)
and the model service downloads and SHA-256-verifies it at startup (`MODEL_ARTIFACT_URL`, `MODEL_ARTIFACT_SHA256`).
Training: [ml/README.md](ml/README.md). Dataset: PlantVillage (Hughes & Salathé, 2015, CC BY-SA 3.0) via
[`geraldmc/plantvillage-full`](https://huggingface.co/datasets/geraldmc/plantvillage-full).

## Live demo

https://agrosaarthi-ai.vercel.app (Vercel + MongoDB Atlas; see docs/DEPLOYMENT.md)

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): three Vercel projects (web, API, model service) and MongoDB Atlas.

## Disclaimer

Suggestions are not a confirmed diagnosis. For pesticides, follow the product label and the local agricultural officer.
