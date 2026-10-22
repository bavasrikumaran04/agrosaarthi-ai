# Backend Conventions

Rules for code in `backend/`. They keep modules consistent, secure and independently testable.
Read `backend/src/shared/ports.ts`, `backend/src/lib/*`, `backend/src/middleware/auth.ts` and one
existing module (`backend/src/modules/auth/`) before writing a new module.

## 1. Module layout

```
src/modules/<name>/
  index.ts               # create<Name>Module(deps) -> { service(s), routes: MountedRouter[], port implementations }
  <name>.routes.ts       # Express Router factory (thin: validation + auth + call service + respond)
  <name>.service.ts      # business logic (no Express types)
  <name>.repository.ts   # optional: non-trivial MongoDB queries
  <name>.schemas.ts      # Zod request schemas
  <name>.dto.ts          # document -> response DTO mapping
  *.test.ts              # unit tests next to the code; *.integration.test.ts for HTTP + DB tests
```

- Factories receive dependencies explicitly (`core: CoreContainer` + ports). No module-level singletons,
  no reading `process.env` (use `core.config`), no `new Date()` in business logic (use `core.clock.now()`).
- Cross-module calls go through interfaces in `src/shared/ports.ts`. Never import another module's service
  file directly; the composition root (`src/bootstrap.ts`) wires implementations together.

## 2. Routes

- Base path `/api/v1/<resource>`. Use `route({ body, query, params }, handler)` from `lib/route.ts`.
- Create/update bodies use `z.strictObject` (unknown fields → 400; prevents mass assignment).
  Use `idParams` / `objectIdSchema` for ids and `paginationQuerySchema` for lists.
- Respond only via `sendOk` / `sendCreated` / `sendPaginated` / `sendNoContent` (`lib/http.ts`).
- Errors: throw `Errors.*` from `lib/errors.ts`. Never return raw provider/DB error text.

## 3. Authorization (server-side, always)

- Route level: `core.authMiddleware.requireAuth` + `requirePermission(...)` / `requireAnyPermission(...)`
  with permissions from `shared/permissions.ts`.
- Object level, in the service: e.g. a farmer may read only their own cases; an expert only assigned cases
  (or unassigned ones for triage, with farmer contact details hidden) unless they hold `case:read:all`.
- When a user requests a specific resource they may not see, respond **404 NOT_FOUND** (do not reveal that it
  exists) and record an `authz.denied` audit entry.
- Hiding a button in the UI is never authorization.

## 4. Data access

- Models live in `src/db/models/`. Read with explicit projections and `.lean()`; map to DTOs
  (`*.dto.ts`) — never send documents to clients. Phone numbers: show `maskPhone(last4)`; decrypting
  (`core.protector.revealPhone`) requires the `farmer-contact:reveal` permission + object access + an audit entry.
- Updates use allowlisted fields only. State changes use atomic conditional updates
  (`findOneAndUpdate({ _id, status: from }, …)`) so concurrent requests cannot both succeed.
- Free-text search: `escapeRegex()` user input; bounded result sizes; always paginate lists.

## 5. Auditing and logging

- Every administrative or privileged mutation, and every reveal of personal data, calls
  `core.audit.recordFromRequest(req, { action: '<module>.<verb>', targetType, targetId, details })`.
  `details` must be small and free of personal data (the sanitizer also redacts sensitive keys).
- Logging: `core.logger.child({ module: '<name>' })`. Never log tokens, passwords, phone numbers,
  conversation/transcript text, image or audio content, or signed URLs.

## 6. Providers and simulators

- External services sit behind interfaces in `src/providers/<kind>/`. Each has a real adapter and,
  where useful, a simulator whose every output is labelled `simulated: true`.
- Config validation already refuses simulators in production; features whose provider is `none`
  respond `Errors.serviceNotConfigured('<Service name>')` (HTTP 503) — never fake success.
- Use `lib/resilience.ts`: `withTimeout` on every external call, `withRetry` only for retryable failures
  (timeouts, 429, 5xx), `Semaphore` for concurrency limits, `CircuitBreaker` for outages.

## 7. Languages

- Never hard-code Tamil (or any language) as a special case. Validate language codes with
  `core.languages.isEnabled(code)`; get provider locales/voices from `core.languages.capability(...)`.
- User-facing text produced by the backend (e.g. telephone prompts) lives in per-language message
  catalogues, not inline in logic.

## 8. Tests

- Unit tests for pure logic (state machines, scoring, validation, mappers).
- Integration tests: `useTestDatabase()` (isolated in-memory MongoDB per file),
  `createTestApplication(env, {}, { routes: (core) => [...] })` to mount routers on the real middleware stack,
  `createUser(core, { role })` for authenticated requests.
- Always test the denial paths: unauthenticated (401), wrong role/permission (403), another user's
  resource (404), invalid input (400), invalid state transitions (409).
- Run before finishing: `npx vitest run src/modules/<name>` and `npx tsc -p tsconfig.json --noEmit`.
  Do not claim tests pass without running them.

## 9. Ownership while modules are built in parallel

- Edit only files inside your assigned module/provider directories plus files explicitly assigned to you.
- Shared files (`src/app.ts`, `src/bootstrap.ts`, `src/container.ts`, `src/shared/*`, `src/lib/*`,
  `src/middleware/*`, `test/helpers/*`, `package.json`) are owned by the integrator: if you need a change,
  describe it precisely in your final report instead of making it.
