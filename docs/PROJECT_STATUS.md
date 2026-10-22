# AgroSaarthi AI — Project Status

> Single source of truth for "where are we". Updated after every phase.
> Status vocabulary (from the specification):
> **LOCAL-TESTED** = implemented and locally tested · **LIVE-VERIFIED** = integrated and tested with live external services ·
> **DEPLOYED** = deployed and production-tested · **BLOCKED** = blocked by missing credentials/external dependencies ·
> **NOT IMPLEMENTED**.

_Last updated: 2026-10-22 21:00 IST_

## Completed phases

| Phase | Scope | Status | Evidence |
|---|---|---|---|
| 0 | Environment inspection, repository init, spec captured | Done | `docs/spec/MASTER_SPECIFICATION.md`, `docs/IMPLEMENTATION_LOG.md` |
| 1 | Backend foundation: config validation + production guards, logging with redaction, error envelope, security middleware (helmet, CORS allowlist, rate limits, NoSQL-operator rejection, CSRF header for cookie endpoints, timeouts), MongoDB connection + readiness, full data model (27 collections), auth (argon2id, JWT access + rotating refresh cookie with reuse detection, lockout), audit service, language registry baseline, health probes | LOCAL-TESTED | `cd backend && npx vitest run` → 6 files, 76 tests passed (2026-10-22 20:57) ; `npx tsc --noEmit` clean ; `npx eslint .` clean |

## In progress

- Phase 2 research (provider/dataset verification) — **first attempt failed** (all 6 agents stopped by an account session limit / DNS error; no reports were saved). Being re-run with incremental saving.

## Pending (next phases)

1. Research (telephony, speech, Gemini, datasets/models, hosting, Indian regulatory) → `docs/research/`.
2. Feature modules: reference data (crops/diseases/languages), knowledge base + retrieval, storage + image analysis + model adapter, Python model service + ML pipeline, assistant (AI provider abstraction, Gemini adapter, safety policy), voice (STT/TTS), telephony (FSM, provider adapter, simulator), cases/experts/callbacks, admin/privacy/metrics, OpenAPI.
3. Angular frontend (farmer app with Tamil i18n, expert dashboard, admin).
4. E2E tests, CI pipeline, security checks, deployment configuration, documentation set.
5. Deployment (requires credentials — see `docs/EXTERNAL_SETUP_CHECKLIST.md`).

## Failed tests

None currently.

## Known bugs / risks

- The pasted specification was truncated mid-Section 26; later sections are unknown (see `docs/DECISIONS.md` D-000).
- Local Node.js is 20.20.2, which reached end-of-life in April 2026. Dependencies were pinned to versions that support Node ^20.19 and ^22/^24; deployment should use Node 22 or 24 LTS.

## Missing credentials (none are configured on this machine)

Gemini API key · MongoDB Atlas (or other managed MongoDB) URI · object storage (S3-compatible) · speech provider(s) · telephony provider account + Indian number · hosting accounts (frontend/backend/model service).

## Deployment status

NOT DEPLOYED.

## Last verified revision

See `git log -1` (foundation commit, 2026-10-22).

## Exact next actions

1. Re-run research wave 1 (ml, gemini, speech, telephony) with agents that save reports incrementally.
2. Implement research-independent modules (knowledge base, cases/experts/callbacks, reference data, storage/image pipeline core, assistant core, telephony FSM + simulator).
