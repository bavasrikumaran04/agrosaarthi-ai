# Frontend Conventions (Angular 21)

Applies to `frontend/`. Angular 21.2, standalone components, **zoneless** change detection, strict TypeScript
and strict templates, Vitest + jsdom unit tests via `ng test`.

## 1. Structure

```
src/app/
  core/                 # singletons: config, api, auth, i18n, layout shell, error handling
    config/             # runtime config (public/app-config.json) loaded before bootstrap
    api/                # ApiClient (envelope unwrapping, ApiError), shared API types
    auth/               # AuthService (signals), interceptor, guards
    i18n/               # I18nService, `t` pipe, typed dictionaries (en.ts is the key schema; ta.ts must match)
    layout/             # app shell, header, navigation, footer, skip link
  shared/ui/            # small presentational components (alert, spinner, empty-state, field-errors, status-badge ...)
  features/
    public/             # landing, language selection, login, register, help, safety, privacy, not-found
    farmer/             # analyze, analysis result, ask (chat + voice), cases, case detail, callback request, account
    expert/             # dashboard, queues, case detail/review, assessment, callbacks, profile
    admin/              # users, knowledge, reference data, languages, providers, models, metrics, audit, callbacks, privacy
```

- Feature areas are lazy-loaded route trees (`loadChildren`). Components are small; logic lives in services.
- State: signals in services (`signal`, `computed`); components read signals. No NgRx (project size does not justify it).
- Forms: Reactive Forms with typed `FormGroup`s; validation messages come from i18n keys via `<app-field-errors>`.

## 2. Runtime configuration

`public/app-config.json` (`{ "apiBaseUrl": "", "environmentName": "development" }`) is fetched before bootstrap.
An empty `apiBaseUrl` means same origin (development uses the `ng serve` proxy to `http://localhost:4000`).
Production deployments replace this file — the same build artifact works in every environment. **No secrets** ever go
into frontend code or this file.

## 3. API access

- Always use `ApiClient` (never `HttpClient` directly in features). It prefixes `apiBaseUrl`, unwraps
  `{ success, data, meta }`, returns `{ items, pagination }` for paginated lists, and converts failures to `ApiError`
  (`status`, `code`, `message`, `details`, `requestId`).
- Show errors with `I18nService.errorMessage(err)`, which maps backend error codes (e.g. `RATE_LIMITED`,
  `SERVICE_NOT_CONFIGURED`, `VALIDATION_ERROR`) to translated, non-technical text. Never show stack traces or raw provider text.
- Uploads use `ApiClient.upload()` (XHR backend, so upload progress events work — do not enable `withFetch()`).

## 4. Authentication

- Access token is kept **in memory only**; the refresh token is an `HttpOnly` cookie set by the API on `/api/v1/auth`.
  Requests to auth endpoints use `withCredentials: true`; refresh/logout send `X-CSRF-Protection: 1`.
- The interceptor adds `Authorization: Bearer …` **only** to requests for the configured API origin, retries once after a
  single-flight refresh on 401, and signs the user out if refresh fails.
- On startup `AuthService.restoreSession()` attempts a silent refresh.
- Guards (`authGuard`, `roleGuard(...)`, `permissionGuard(...)`, `guestGuard`) only improve navigation; the API enforces
  authorization. Never treat a hidden button as security.

## 5. Internationalisation

- Every user-visible string comes from the dictionaries via the `t` pipe (`{{ 'farmer.analyze.title' | t }}`) or
  `i18n.t('key', { param })`. No hard-coded user-facing strings in templates or components.
- `en.ts` defines the key schema; other dictionaries are typed against it, so a missing Tamil key is a **compile error**.
  Keys are type-checked in templates too (strict templates).
- The selected language is stored (try/catch around `localStorage`), applied to `<html lang>`, and saved to the profile
  when signed in. Language names are shown in their own script (தமிழ், English).
- Tamil strings are machine-assisted and marked for native-speaker review in `docs/KNOWN_LIMITATIONS.md`.
- Avoid technical AI vocabulary in farmer screens ("possible problem" not "inference"; "how sure the computer is" not
  "softmax confidence"). Always present diagnoses as possibilities and show sources.

## 6. Accessibility and design

- Mobile-first, high contrast (WCAG 2.2 AA), minimum 44×44 px touch targets, visible focus outlines, skip link,
  semantic landmarks, one `<h1>` per page, labels for every input, `aria-live="polite"` for async status
  (upload progress, analysis status, assistant replies), focus moved to the page heading on navigation,
  `prefers-reduced-motion` respected, no decorative animation, no fake statistics.
- Design tokens are CSS custom properties in `src/styles.css`; components use the shared utility classes
  (`.btn`, `.card`, `.alert`, `.field`, `.badge`, `.stack`, `.cluster`, `.grid`) instead of ad-hoc styles.
- System font stack with Tamil coverage (`"Noto Sans Tamil", "Nirmala UI", "Latha", system-ui, sans-serif`) —
  no external font downloads (slow rural networks, privacy).

## 7. Tests

- Unit-test services (HttpTestingController), guards, the interceptor, and components' key behaviours
  (rendering, validation messages, loading/empty/error states, keyboard access, `aria` labels).
- Run `npx ng test --watch=false` and `npx ng build` before finishing; never claim results you did not observe.
