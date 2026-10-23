# Implementation Log

Chronological record of what was done, what was run, and what happened. Newest entries last.

## 2026-10-22

### Phase 0 — Inspection (≈12:00 IST)

- Working directory `D:\Bava Workspace\Sprint26` was **empty** and **not a Git repository** (no existing work to preserve).
- Tooling found: Windows 11 Home (10.0.26200), Node.js 20.20.2, npm 10.8.2, Git 2.55, Python 3.14.7 (+ uv 0.11), Java 26, GitHub CLI 2.98 (authenticated).
- Not installed: MongoDB, Docker, ffmpeg, Angular CLI.
- Credential environment variables checked by name only (values never printed): Gemini, Google, MongoDB, Twilio, Exotel, Plivo, Azure, Sarvam, Bhashini, AWS, Cloudinary, Render, Vercel, Netlify, Railway, Fly, Hugging Face, GitHub tokens — **none set**.
- Dependency compatibility check: Angular 22 / Vitest 5 / jsdom 30 / file-type 22 require Node ≥ 22. Chosen pins support Node ^20.19 || ^22 || ^24: Angular 21.2, TypeScript 5.9.3 (Angular 21 needs `>=5.9 <6.0`), Vitest 4.1.12, jsdom 28, Express 5.3, Mongoose 8.24, Zod 4.6, ESLint 10.13.
- Python 3.14 wheels confirmed available for torch 2.14.1, torchvision 0.29.1, onnxruntime 1.31.0, onnx 1.23.2, timm 1.0.30, scikit-learn 1.9.1, fastapi 0.159.1.
- `git init -b main`; `.gitignore` excludes `.env*`, datasets, model weights, uploads, recordings.
- Specification saved verbatim to `docs/spec/MASTER_SPECIFICATION.md` (noting truncation in Section 26).

### Research attempt 1 (≈12:35–20:50 IST) — FAILED

- Launched a 6-agent research workflow (telephony, speech, Gemini, datasets/models, hosting, regulatory) with adversarial verification.
- Result: **all six agents failed** — five with "session limit reached", one with a DNS error (`ENOTFOUND`). The agents were instructed to write reports only at the end, so **nothing was saved**.
- Corrective action: re-run with agents that create the report file immediately and append findings as they go.

### Phase 1 — Backend foundation (≈12:40–20:57 IST)

- `npm install` failures and fixes:
  1. `ECONNRESET` (network) → retried with `--fetch-retries=6`.
  2. ESLint 9 reported as unsupported → moved to ESLint 10.13 (supports Node ^20.19).
  3. `argon2@0.45.1` had no prebuilt binary for this platform and tried to compile (no Visual Studio) → replaced with `@node-rs/argon2@2.2.2` (prebuilt N-API binaries, no compile step).
  4. Removed unused `pino-http` (a lighter in-house access logger avoids logging bodies/query strings).
- Typecheck failure: Mongoose `InferSchemaType` collapsed because `baseOptions()` returned a broad `SchemaOptions` type. Verified with a minimal probe (inline literal options OK, broad type broken, `const` generic helper OK) and fixed by making the helper generic.
- Test failure: duplicate auto-named `caseId_1` indexes (field `index: true` + partial unique index) in `expert_assignments` and `callback_requests` → removed field-level indexes, named the partial unique indexes, added compound `{caseId, createdAt}` indexes.
- Final verification (20:57 IST):
  - `npx tsc -p tsconfig.json --noEmit` → exit 0
  - `npx eslint .` → exit 0
  - `npx vitest run` → **6 test files, 76 tests passed** (unit + integration on an in-memory MongoDB 8.2.6 started by `mongodb-memory-server`)

## 2026-10-23

### Audit (≈10:00 IST)
- `docs/FINAL_AUDIT_REPORT.md` written: foundation only; frontend was an empty scaffold.

### Phase 1 — Web application (≈10:05–10:55 IST)
- Kept and completed the interrupted agent's storage contracts: added local + S3 adapters, files service (retention sweep), signed-file route.
- Backend modules added: reference data (seeded idempotently, admin edits preserved), cases/experts/callbacks
  (state machine, triage view, race-safe assignment, assessments, messages, callbacks, audited phone reveal),
  image analysis (content validation, EXIF/GPS strip, model-service adapter with timeout/retry, labelled simulator,
  outcome rules, auto-escalation, duplicate-submission guard), admin (staff, metrics, providers, model versions, audit).
- Scripts: `admin:create` (+ `--reset-password` recovery that revokes sessions), `db:seed`.
- Angular app built: core (config, API client, auth, typed Tamil/English i18n), shell, public/farmer/expert/admin pages.
- Honesty fix: `.env.example` defaulted AI/STT/TTS to "simulated" although no such code existed, so health reported
  them as simulated — changed defaults to `none`.
- E2E: Playwright journey against the running stack. Failures fixed were all in the test script (URL wait race,
  hidden menu button, language preference applied on sign-in, ambiguous label); one run was correctly blocked by the
  auth rate limiter (20/15 min) — backend restarted to clear the in-memory limiter.
- Results: backend 119 passed; model-service 28 passed; frontend 15 passed; E2E 6 passed; builds/lint/typecheck/audits pass.
