"""Run with:  python -m app   (PORT defaults to 8000)."""

from __future__ import annotations

import logging
import os
import sys

import uvicorn

from .artifacts import ArtifactError, ensure_model_artifact
from .config import SettingsError, load_settings
from .main import create_app


def main() -> None:
    try:
        settings = load_settings()
    except SettingsError as exc:
        print(f"Invalid configuration: {exc}", file=sys.stderr)
        sys.exit(1)
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    try:
        ensure_model_artifact(settings)
    except (ArtifactError, OSError) as exc:
        logging.getLogger("model-service").error("model artifact download failed: %s", exc)
    app = create_app(settings)
    uvicorn.run(
        app,
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "8000")),
        log_level=settings.log_level,
        access_log=False,  # requests carry farmer images; keep logs minimal
    )


if __name__ == "__main__":
    main()
