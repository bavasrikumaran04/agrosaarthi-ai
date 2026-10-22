# AgroSaarthi model service

CPU inference service for the crop-disease image classifier (FastAPI + onnxruntime). It is
independent of the web application: the backend calls it over HTTP with a shared bearer token.

It returns **model signals, not diagnoses**: top-k class scores, uncertainty (max probability, margin,
entropy, abstention reasons), an out-of-distribution score (Mahalanobis distance on embeddings when the
model card provides statistics) and image-quality checks (blur, exposure, contrast, size, plant-like colour).
The backend combines these into a farmer-facing outcome (likely match / uncertain / out of domain / poor quality).

## API

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | none | Liveness |
| GET | `/ready` | none | 200 when a model is loaded, otherwise 503 |
| GET | `/v1/model` | Bearer | Model card (classes, preprocessing, thresholds, dataset, metrics, limitations) |
| POST | `/v1/predict` | Bearer | `multipart/form-data`: `image` (JPEG/PNG/WebP), optional `top_k` (1–10, default 3) |

Errors: `{"error": {"code": "...", "message": "..."}}` with codes `UNAUTHORIZED` (401), `EMPTY_FILE` /
`INVALID_IMAGE` / `BAD_REQUEST` (400), `FILE_TOO_LARGE` / `TOO_MANY_PIXELS` (413), `UNSUPPORTED_FORMAT` (415),
`MODEL_NOT_LOADED` / `BUSY` (503). Images are decoded by content (not extension), EXIF orientation is applied,
and decompression bombs are rejected.

## Configuration (environment variables)

| Variable | Default | Notes |
|---|---|---|
| `MODEL_SERVICE_TOKEN` | — (required, ≥ 16 chars) | Same value as the backend's `MODEL_SERVICE_TOKEN` |
| `MODEL_DIR` | `./models/current` | Directory with `model.onnx` + `model_card.json` (see `MODEL_ARTIFACT_CONTRACT.md`) |
| `MODEL_ARTIFACT_URL` / `MODEL_ARTIFACT_SHA256` | unset | Optional HTTPS zip downloaded and checksum-verified at startup |
| `MAX_IMAGE_BYTES` | 8388608 | Upload limit |
| `MAX_IMAGE_PIXELS` | 40000000 | Decompression-bomb guard |
| `MAX_CONCURRENCY` / `QUEUE_TIMEOUT_SECONDS` | 2 / 10 | Bounded parallel inferences; excess waits then gets 503 `BUSY` |
| `ORT_INTRA_OP_THREADS` | 2 | onnxruntime CPU threads per inference |
| `PORT` / `HOST` | 8000 / 0.0.0.0 | Container image defaults to 7860 |
| `ENVIRONMENT` | development | `production` disables `/docs` |

## Local development

```bash
uv venv --python 3.14 .venv
uv pip install --python .venv/Scripts/python.exe -r requirements-dev.txt   # Windows path; use .venv/bin/python elsewhere
.venv/Scripts/python.exe -m pytest -q
MODEL_SERVICE_TOKEN=<16+ chars> MODEL_DIR=../ml/artifacts/current .venv/Scripts/python.exe -m app
```

The tests build a tiny **test-fixture** ONNX graph (colour → class) so the API can be tested without real
weights. That fixture is not a crop-disease model. Real weights come from the training pipeline in `ml/`.
