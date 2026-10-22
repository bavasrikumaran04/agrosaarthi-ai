# Architecture & Engineering Decisions

Each decision records the context, the choice, and its trade-offs. Provider choices that depend on
external facts reference the research reports in `docs/research/` (with sources).

## D-000 — Handling the truncated specification
- **Context:** The specification paste was cut off part-way through Section 26 (directory structure). Sections 27+ (if any) were not received.
- **Decision:** Implement everything in Sections 1–26 as received; adapt the partial directory structure in Section 26 to the repository. Flag the gap in status reports so the owner can supply the remainder.
- **Trade-off:** Any requirement in the missing sections is unknown until supplied.

## D-001 — Runtime and dependency versions
- **Context:** The development machine runs Node.js 20.20.2 (EOL April 2026). Newest majors of Angular (22), Vitest (5), jsdom (30) require Node ≥ 22.
- **Decision:** Pin versions that support Node `^20.19 || ^22 || ^24` (Angular 21.2 LTS, TypeScript 5.9, Vitest 4.1, Express 5, Mongoose 8.24, Zod 4). Deploy on Node 22/24 LTS; recommend upgrading the dev machine.
- **Trade-off:** Angular 21 reaches end of LTS earlier than 22 (upgrade path documented later).

## D-002 — Modular monolith + separate model service
- **Decision:** One Express/TypeScript backend organised by modules (route → controller/handler → service → repository/model). The crop-disease classifier runs in a **separate Python service** (FastAPI + onnxruntime).
- **Why separate:** the ML ecosystem (training, evaluation, ONNX export) is Python; serving with the same preprocessing code as evaluation avoids train/serve skew; model memory/CPU needs differ from the API; the spec asks for a model interface independent of the web app.
- **Trade-off:** one more deployable unit and an internal authenticated HTTP hop.

## D-003 — Mongoose 8 (not 9)
- **Decision:** Mongoose 8.24.x (maintained, Node ≥ 16.20) instead of 9.x.
- **Why:** Mongoose 9 changes middleware semantics (e.g. `next()` in pre hooks); 8.x is stable and widely understood. Revisit when upgrading Node.

## D-004 — Password hashing: argon2id via `@node-rs/argon2`
- **Decision:** argon2id, defaults m=19456 KiB, t=2, p=1 (OWASP minimum guidance), configurable; production refuses lower memory cost.
- **Why `@node-rs/argon2`:** ships prebuilt binaries for Windows/Linux/macOS; the `argon2` package attempted a native compile here (no toolchain) — a risk on hosting platforms too.

## D-005 — Authentication model
- **Decision:** Short-lived JWT access token (HS256, 15 min, held in memory by the SPA) + opaque refresh token in an `HttpOnly` cookie scoped to `/api/v1/auth`, rotated on every use, stored only as SHA-256 hash; re-use of a rotated token outside a 15 s grace window revokes the token family. `tokenVersion` on the user invalidates all access tokens on password change / sign-out-everywhere. The user record is loaded on every request so disabling an account takes effect immediately.
- **CSRF:** cookie-authenticated endpoints require an allowlisted `Origin` (when present) **and** a custom `X-CSRF-Protection: 1` header (forces a CORS preflight that only allowlisted origins pass).
- **Farmers** sign in with phone number + password (no SMS OTP: no SMS provider is configured — documented limitation). **Staff** (experts, administrators) are created by administrators and sign in with email.

## D-006 — Personal data protection
- **Decision:** Phone numbers are never stored in clear text: keyed HMAC hash (lookup), AES-256-GCM ciphertext (excluded from queries by default, decrypted only for authorised, audited reveals) and last 4 digits (masked display).
- **Decision:** Phone-call history is **not** auto-linked to a web account with the same number, because without OTP verification anyone could register another farmer's number and read their call history.

## D-007 — Simulators are explicit, labelled and blocked in production
- **Decision:** Each provider kind (AI, image model, STT, TTS, telephony) has a `none` mode and a clearly labelled simulator for development/tests. Config validation **refuses to start in production** with a simulator selected (the telephony simulator requires an explicit `ALLOW_TELEPHONY_SIMULATOR_IN_PRODUCTION=true` and marks every session `isSimulated`). When a real provider is not configured, the feature reports `SERVICE_NOT_CONFIGURED` (HTTP 503) instead of faking output.

## D-008 — API shape
- **Decision:** Versioned JSON API under `/api/v1/*`; probes at `/api/health/live` and `/api/health/ready`. Every response uses `{ success, data | error, meta: { requestId, pagination? } }`. Validation with Zod at the route boundary (unknown keys stripped or rejected with `strictObject`), plus a global guard rejecting `$`-prefixed / prototype keys (NoSQL-operator injection defence in depth).

## D-009 — Testing database
- **Decision:** No MongoDB is installed locally, so tests use `mongodb-memory-server` (a real `mongod` 8.2.6 binary). One server per run, one uniquely named database per test file; indexes are built before tests so unique constraints are exercised.
