# Running AgroSaarthi locally

**Quick start (after the one-time setup below):** `powershell -ExecutionPolicy Bypass -File .\start-demo.ps1` from the
repository root starts all four services in separate windows. Demo accounts: `cd backend; $env:DEMO_PASSWORD='…'; npm run demo:setup`.
Presentation script: [DEMO_GUIDE.md](DEMO_GUIDE.md).

Requirements: Node 20.19+ (22/24 recommended), Python 3.14 + `uv`. No MongoDB install needed.

```bash
# 1. Backend config (once): copy and fill secrets — see comments in the file
cp backend/.env.example backend/.env        # generate the secrets as described inside
cd backend && npm install
npm run dev:mongo                            # terminal 1: local MongoDB (data in backend/.dev-mongo-data)
npm run admin:create -- --email you@example.org --name "Your Name"   # prints a one-time password

# 2. Model service (terminal 2). Until a trained model exists, only the labelled TEST FIXTURE model is available:
cd model-service && uv venv --python 3.14 .venv && uv pip install --python .venv/Scripts/python.exe -r requirements-dev.txt
.venv/Scripts/python.exe scripts/build_test_fixture.py models/test-fixture
MODEL_SERVICE_TOKEN=<same as backend .env> MODEL_DIR=models/test-fixture .venv/Scripts/python.exe -m app
#   (or set IMAGE_MODEL_PROVIDER=simulated in backend/.env to skip the model service — results are labelled TEST)

# 3. API (terminal 3):   cd backend && npm run dev          -> http://localhost:4000/api/health/ready
# 4. Web  (terminal 4):   cd frontend && npm install && npx ng serve   -> http://localhost:4200
```

Tests: `backend: npm test` · `model-service: .venv/Scripts/python.exe -m pytest -q` · `frontend: npx ng test --watch=false` ·
`e2e: npm install && npx playwright install chromium && npx playwright test` (needs steps 1–4 running; set
`E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`, and reset with `npm run admin:create -- --email … --reset-password` between runs).
