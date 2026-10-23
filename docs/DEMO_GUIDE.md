# AgroSaarthi AI — Demonstration Guide

A step-by-step script for presenting the local prototype (about 10 minutes), with what to say honestly about each part.

## 1. Before the presentation (15 minutes before)

1. From the repository root: `powershell -ExecutionPolicy Bypass -File .\start-demo.ps1`
   — opens four windows (MongoDB, model service, API, web app) and then the browser at http://localhost:4200.
2. Demo accounts (creates them, or resets their password, so they always work):
   `cd backend` then `$env:DEMO_PASSWORD='<choose one>'; npm run demo:setup`
   - Farmer: mobile **9000000001** (Murugan, demo farmer, Tamil)
   - Expert: **expert@agrosaarthi.local**
3. Administrator: `$env:ADMIN_PASSWORD='<choose one>'; npm run admin:create -- --email admin@agrosaarthi.local --reset-password`
   — the first sign-in asks for a new password (a deliberate security feature; it's worth showing).
4. Use **Microsoft Edge** for the phone demo if you want Tamil prompts read aloud (Edge has Tamil voices;
   other browsers may show the prompts as text only).
   **Demo photos:** `ml\data\demo-images\` has 11 PlantVillage photos from the held-out test split (never used in
   training), named by their true class, e.g. `Tomato__Late_blight.jpg`. `Tomato__Early_blight.jpg` is a genuine
   mistake by the model (it says Septoria leaf spot) — useful if you want to show why experts stay in the loop.
   A field photo from the internet will often be rejected as "not a leaf we can check" — that is the safety check working.
5. Sign in/out no more than ~100 times in 15 minutes (login rate limit; restarting the API window resets it).

## 2. Demo script

| # | Show | Say |
|---|------|-----|
| 1 | Home page (Tamil by default) → switch to English | Problem: late detection, language barrier, no smartphone. Three channels: photo, Tamil question, phone line; experts for unclear cases. Point at the **status chips**, which are honest about what works. |
| 2 | *Crops & diseases* → Tomato | 25 crops, 38 disease records with Tamil names, served from MongoDB. Photo check is offered only for crops the model covers. |
| 3 | Sign in as the farmer → dashboard | Big tiles and icons for low-literacy users; Tamil first. |
| 4 | *Check my crop* → choose `Tomato__Late_blight.jpg` → crop Tomato → *Check the photo* | Real pipeline: upload → server checks the file type, strips location data → **separate Python model service (ONNX)** → quality and out-of-domain checks → result with confidence. Model: MobileNetV3 (ImageNet-pretrained) + our classifier head trained on PlantVillage — **95.9 % top-1 on 3,577 held-out lab photos with leaf-disjoint splits**. Field-photo accuracy is not measured, so the page says an expert should confirm. Unclear results are automatically sent to an expert. |
| 5 | *Open this request* → request a call back | Case number, status, call-back request. No exact time is promised. |
| 6 | *Ask a question* → 🎤 *Speak instead of typing* (or type) | Browser speech-to-text. The question goes to an expert; the AI assistant (Gemini) is not connected yet. |
| 7 | *Phone demo* → Call → 1 (Tamil) or 2 (English) → 1 → crop → describe → 1 → time | **Simulator** of the phone menu for basic phones (keypad tones, spoken prompts). Signed in as a farmer, it creates a real request marked "[Phone line simulator]". A real number needs a telephony provider (Exotel/Twilio) — not connected. |
| 8 | Sign out → sign in as the expert → *Unassigned* → open the request | Triage view hides farmer details until the expert takes the case (privacy). Take case → write assessment → set *Resolved*. |
| 9 | Sign in as the farmer → *My requests* → switch to Tamil | Farmer sees the expert's answer, in Tamil. |
| 10 | (Optional) Sign in as admin → Operations / Users / Integrations / Audit log | Real metrics, staff creation with one-time passwords, integration status (shows what is NOT configured), audit trail. |

## 3. Honest status (say this if asked)

| Part | Status |
|---|---|
| Web app, accounts, roles, Tamil/English, cases, experts, call backs, admin, audit | Working locally, automated tests (backend 119, frontend 16, browser end-to-end 7) |
| Photo disease detection | Working with a model **we trained**: 38 PlantVillage classes (14 crops), 95.9 % top-1 / macro-F1 0.959 on 3,577 held-out lab photos (leaf-disjoint). **Field-photo accuracy not measured**; rice/banana/coconut not covered |
| Browser voice input (Web Speech API) | Works in Chrome/Edge; not covered by automated tests |
| Phone line | **Simulator only** (in the browser). No telephony account or number. |
| AI assistant (Gemini) and knowledge-base answers | Not implemented yet (needs an API key) |
| Deployment | Not deployed — runs on this laptop |

**Likely questions**
- *"Is the disease detection accurate?"* — On lab photos, yes: 95.9 % top-1 on 3,577 held-out PlantVillage photos, with no leaf
  shared between training and test (a common source of inflated PlantVillage results). Weakest: tomato early blight vs Septoria
  (F1 0.84/0.87). On real field photos it has **not been measured** and will be lower — next step is a field-photo test set and
  fine-tuning with field images. Unclear and unfamiliar photos are routed to an expert instead of guessed.
- *"Why a frozen backbone?"* — CPU-only training on a laptop: pretrained MobileNetV3 features + a logistic-regression head
  train in minutes; full fine-tuning on a GPU is the planned improvement. Details: `ml/README.md`.
- *"Why not just use ChatGPT?"* — Safety: answers will be grounded in a source-cited knowledge base, uncertain cases go to people, and pesticide advice always points to the label and the local officer.
- *"How does the phone part work for real?"* — IVR provider webhook → speech-to-text (Tamil) → same backend case/expert workflow → text-to-speech reply or expert call back.

## 4. If something goes wrong
- "Too many tries" on sign-in → close and restart the **API** window (`npx tsx src/server.ts` in `backend`).
- Photo check error → check that the **model service** window is running (port 8000).
- Blank page → check the **web** window shows "Application bundle generation complete".
- A password is forgotten → re-run the commands in step 1.2 / 1.3.
