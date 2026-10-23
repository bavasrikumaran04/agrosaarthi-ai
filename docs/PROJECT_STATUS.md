# AgroSaarthi AI — Project Status

> Status vocabulary: **LOCAL-TESTED** (implemented and locally tested) · **LIVE-VERIFIED** (tested with live external
> services) · **DEPLOYED** · **BLOCKED** (missing credentials/external dependency) · **NOT IMPLEMENTED**.

_Last updated: 2026-10-23 ~10:55 IST_

## Phase 1 — Web application: LOCAL-TESTED

| Feature | Status | Notes |
|---|---|---|
| Angular app shell, routing, guards, typed i18n (Tamil default + English), API client, auth with in-memory token + refresh cookie | LOCAL-TESTED | Tamil dictionary is machine-assisted, pending native review |
| Home, language choice, registration (consent), login, password change (forced for new staff) | LOCAL-TESTED | Browser E2E |
| Farmer dashboard, crop & disease information pages (from DB) | LOCAL-TESTED | 25 crops, 38 model-mapped disease records seeded |
| Crop photo upload with preview, progress, client + server validation, result display with uncertainty | LOCAL-TESTED | Server strips EXIF/GPS; prediction hidden for poor-quality/off-domain photos |
| Ask a question (sent to an expert as a case) + browser speech input (Web Speech API) | LOCAL-TESTED (text); voice not automated-tested | AI assistant is NOT IMPLEMENTED yet (Phase 3); the page says so |
| Requests list/detail, messages, expert-review request, callback request | LOCAL-TESTED | No callback time is promised |
| Expert desk: counts, queues, triage view, take case (race-safe), assessment, status changes, messages, callback attempts, audited phone reveal, photo via signed URL | LOCAL-TESTED | |
| Admin: metrics from real data, staff creation with one-time password, enable/disable users, provider status, audit log | LOCAL-TESTED | |
| Storage: local + S3-compatible private storage, signed URLs, retention sweep | Local LOCAL-TESTED; S3 adapter unit-tested with mocks only (BLOCKED for live: no bucket) | |
| Backend ↔ model service HTTP integration | LOCAL-TESTED with the labelled **test-fixture** ONNX model | No trained crop-disease model exists yet (Phase 4) — no genuine disease inference |

## Verified results (2026-10-23)

| Command | Result |
|---|---|
| `backend: npx vitest run` | 9 files, **119 passed** |
| `backend: npx tsc --noEmit`, `npx eslint .`, `npm run build`, `npm audit --omit=dev` | all pass, 0 vulnerabilities |
| `model-service: python -m pytest -q` | **28 passed** |
| `frontend: npx ng test --watch=false` | 2 files, **15 passed** |
| `frontend: npx ng build`, `npm audit --omit=dev` | pass, 0 vulnerabilities |
| `e2e: npx playwright test` (live local stack: MongoDB 8.2.6 via dev:mongo, model service, API, ng serve, Chromium) | **6 passed** — Tamil default, crop pages, farmer register → photo → model-service result → callback, farmer denied admin area, admin creates expert, expert takes/assesses/resolves, farmer sees answer in Tamil |

## Not implemented yet
Knowledge base & retrieval (Phase 2) · Gemini assistant (Phase 3) · trained crop-disease model + ML pipeline (Phase 4) ·
server-side STT/TTS and telephony/simulator (Phase 5) · privacy-request workflow, OpenAPI docs, full documentation set.

## Missing credentials / external
Gemini API key · managed MongoDB · S3 bucket · speech provider · telephony account + Indian number · hosting · legal review ·
native Tamil review · expert review of knowledge content. Node 20 (EOL) locally — upgrade recommended.

## Deployment status
NOT DEPLOYED. No remote repository; nothing pushed.

## Exact next actions
1. Phase 2: knowledge base (ingestion, chunking, retrieval with Tamil query expansion) + sourced documents.
2. Phase 3: Gemini assistant behind `AI_PROVIDER=gemini` (needs an API key for live verification).
3. Phase 4: dataset download + CPU training + evaluation + ONNX export; replace the test-fixture model.
