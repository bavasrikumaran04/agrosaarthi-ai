# AgroSaarthi AI — Audit Report

_Audit date: 2026-10-23 (≈10:00 IST). Everything below was checked against the actual repository and commands. Nothing was pushed, deployed or deleted._

## 1. Repository state

- Commits (`main`, local only, no remote):
  1. `19d6ea3` backend foundation
  2. `c1e6fe5` ports, conventions guide, deps (yaml, AWS S3 SDK, @google/genai)
  3. `b546824` model-inference service
- Uncommitted changes:
  - Edits to 4 models (`crop`, `disease`, `language-capability`, `stored-file`) and 4 partial files in `backend/src/providers/storage/`. These came from an implementation agent that was **terminated by an account session limit** before finishing; the work is incomplete and untested.
  - Not yet committed: `frontend/` (an unmodified Angular 21 scaffold), `.github/workflows/ci.yml`, `docs/research/`.
- Empty or missing: `ml/`, `knowledge/`, and every feature module except auth, audit, health and the language-registry baseline.

## 2. Completed (implemented and locally tested)

| Area | Evidence |
|---|---|
| Backend foundation | Zod config with production guards (simulators, local storage and insecure cookies refused); redacted structured logging; error envelope; helmet; CORS allowlist; rate limits; NoSQL-operator rejection; CSRF header; timeouts; graceful shutdown |
| Data model | 27 Mongoose collections with indexes, TTL retention and encrypted phone fields |
| Authentication | Farmer registration (consent required); login by phone or email; argon2id; JWT access tokens; rotating refresh cookie with reuse detection; lockout; password change invalidates tokens; per-request user reload; permission middleware; audit log |
| Health | `/api/health/live`; `/api/health/ready`, which returns 503 when the DB is down |
| Model-inference service (Python) | FastAPI + onnxruntime with bearer auth; content-based image validation; bomb/size limits; top-k results; abstention; Mahalanobis OOD; quality heuristics; checksum-verified artifact download; Dockerfile |
| Dev tooling | `.env.example` (all 82 variables verified to be read by config); `npm run dev:mongo` (local MongoDB without installing it); CI workflow file (never run — nothing has been pushed) |

## 3. Partially implemented

- **Object storage:** 4 provider files written by an interrupted agent. They typecheck, but there are no tests, nothing is wired in, and there is no files module.
- **Language registry:** a baseline exists (ta and en enabled), but no admin API and no verified provider capability entries.
- **Frontend:** only the Angular 21 scaffold (build and its 2 default tests pass). No AgroSaarthi pages, i18n, auth or API client — the frontend-core agent was terminated before writing any files.
- **Research:**
  - Telephony and speech reports are COMPLETE.
  - The datasets/models and Gemini reports are IN PROGRESS: findings were saved, but their recommendation sections are unfinished.
  - None of the reports has been fact-checked.

## 4. Missing (not implemented)

- **Crop disease detection end-to-end.** This needs:
  - a backend upload/analysis module;
  - a **real trained model** (no dataset downloaded, no training run, the `ml/` pipeline doesn't exist).

  The model service has only been tested with a labelled *test-fixture* ONNX graph that is not a crop model. **There is no genuine disease inference yet.**
- **Gemini / conversational assistant:** the SDK is installed, but there is no adapter, prompt, safety policy, conversation handling or endpoints.
- **Knowledge base:** no ingestion, retrieval or source documents.
- **Voice:** no STT or TTS adapters and no audio endpoints. Regional-language voice is not implemented.
- **Telephony:** no FSM, webhooks, provider adapter or simulator. Only the config section exists.
- **Experts and admin:**
  - No case management, expert dashboard, callbacks, AI feedback, admin, user management, metrics or privacy-request APIs.
  - No Angular screens for any of them.
- **Other gaps:** no OpenAPI docs, E2E tests, seed or admin-creation scripts, or the documentation set (README, ARCHITECTURE, DEPLOYMENT, …).

**Placeholders and hardcoded predictions:** none found. No prediction or AI-response code exists yet, so nothing is being faked. The simulators described in the config are not implemented either.

## 5. Test results (actual commands, 2026-10-23)

| Command | Result |
|---|---|
| `backend: npx tsc -p tsconfig.json --noEmit` | exit 0 |
| `backend: npx eslint .` | exit 0 |
| `backend: npx vitest run` | 6 files, **76 passed** |
| `backend: npm run build` | exit 0 |
| `backend: npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| `model-service: python -m pytest -q` | **28 passed** |
| `frontend: npx ng test --watch=false` | 2 passed (default scaffold test only) |
| `frontend: npx ng build` | exit 0 |

## 6. Integration status

- Angular ↔ backend: **not integrated** (no API client or pages).
- Backend ↔ MongoDB: verified in tests only, against an in-memory MongoDB 8.2.6. No real or managed database has been connected.
- Backend ↔ model service: **not integrated** (no backend adapter).
- Backend ↔ Gemini / speech / telephony: **not integrated.**

## 7. External requirements still needed

- Gemini API key, plus a model ID verified by research.
- Managed MongoDB (e.g. Atlas).
- S3-compatible private bucket.
- Speech provider credentials (Tamil): see `docs/research/speech-providers.md`.
- Telephony account with an Indian number and KYC: see `docs/research/telephony-providers.md`.
- Hosting for the frontend, backend and model service.
- A permitted crop-disease dataset download and a training run.
- Legal review: DPDP Act, telecom rules, recording consent.
- Native Tamil review and agricultural expert review of content.
- Recommended: upgrade local Node 20 (end-of-life) to 22 or 24.

## 8. Deployment status

**Not deployed.** No hosting accounts or tokens are configured, and no remote Git repository exists.

## 9. Process issue

- The account session limit terminated **every** background agent three times: research v1, research v2 and implementation wave A.
- About 3M tokens of agent work produced only partial output.
- Future work should run fewer agents in parallel, or be done directly.

## 10. Prioritized remaining tasks

1. Commit the CI file and research reports. Finish or discard the partial storage files, with tests.
2. Knowledge base and retrieval, plus case/expert/callback modules (needed by everything else).
3. ML pipeline:
   - dataset download (PlantVillage, licence per the research report);
   - training on CPU;
   - evaluation with real metrics;
   - ONNX export;
   - backend image-analysis module wired to the model service.
4. Gemini assistant: provider abstraction, grounded guidance, pesticide safety policy, development simulator.
5. Angular core: auth, i18n with Tamil, API client. Then farmer pages, then expert dashboard, then admin.
6. Voice (STT/TTS) and telephony (FSM, simulator, provider adapter), following the completed research.
7. Admin and privacy APIs, OpenAPI docs, E2E tests, documentation.
8. Deployment, once credentials are provided.
