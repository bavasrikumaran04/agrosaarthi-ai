"""Vercel serverless entry point (ASGI). The trained model is downloaded from MODEL_ARTIFACT_URL into /tmp
and SHA-256-verified on cold start (same contract as the container); /ready reports 503 if it is not loaded."""

import logging
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("MODEL_DIR", "/tmp/models/current")
os.environ.setdefault("ENVIRONMENT", "production")

from app.artifacts import ArtifactError, ensure_model_artifact  # noqa: E402
from app.config import load_settings  # noqa: E402
from app.main import create_app  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
settings = load_settings()
try:
    ensure_model_artifact(settings)
except (ArtifactError, OSError) as exc:
    logging.getLogger("model-service").error("model artifact download failed: %s", exc)
app = create_app(settings)

