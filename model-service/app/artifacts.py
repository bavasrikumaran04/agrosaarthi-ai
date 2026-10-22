"""Optional download of the model artifact at startup (weights are never stored in Git)."""

from __future__ import annotations

import hashlib
import logging
import tempfile
import urllib.request
import zipfile
from pathlib import Path

from .config import Settings

logger = logging.getLogger("model-service.artifacts")

MAX_ARTIFACT_BYTES = 500 * 1024 * 1024
EXPECTED_MEMBERS = {"model.onnx", "model_card.json"}


class ArtifactError(RuntimeError):
    pass


def ensure_model_artifact(settings: Settings) -> None:
    """If MODEL_ARTIFACT_URL is set and the model directory is incomplete, download, verify and extract it."""
    if not settings.artifact_url:
        return
    model_dir = Path(settings.model_dir)
    if all((model_dir / name).is_file() for name in EXPECTED_MEMBERS):
        return
    model_dir.mkdir(parents=True, exist_ok=True)

    digest = hashlib.sha256()
    total = 0
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        tmp_path = Path(tmp.name)
        request = urllib.request.Request(settings.artifact_url, headers={"User-Agent": "agrosaarthi-model-service"})
        with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310 - https enforced in settings
            while chunk := response.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_ARTIFACT_BYTES:
                    raise ArtifactError("model artifact exceeds the size limit")
                digest.update(chunk)
                tmp.write(chunk)
    try:
        if digest.hexdigest() != settings.artifact_sha256:
            raise ArtifactError("model artifact checksum mismatch")
        with zipfile.ZipFile(tmp_path) as archive:
            names = set(archive.namelist())
            if names != EXPECTED_MEMBERS:
                raise ArtifactError("model artifact must contain exactly model.onnx and model_card.json at its root")
            for name in EXPECTED_MEMBERS:
                # Members are fixed, root-level names: no path traversal is possible.
                with archive.open(name) as src, open(model_dir / name, "wb") as dst:
                    dst.write(src.read())
        logger.info("model artifact downloaded and verified", extra={"bytes": total})
    finally:
        tmp_path.unlink(missing_ok=True)
