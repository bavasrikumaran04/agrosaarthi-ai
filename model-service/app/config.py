"""Environment-driven settings, validated at startup. Secrets are never logged."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass


class SettingsError(ValueError):
    """Raised when the environment is misconfigured."""


@dataclass(frozen=True)
class Settings:
    environment: str
    model_dir: str
    token: str
    max_image_bytes: int
    max_pixels: int
    max_concurrency: int
    queue_timeout_seconds: float
    intra_op_threads: int
    artifact_url: str | None
    artifact_sha256: str | None
    log_level: str


def _get(source: Mapping[str, str], name: str, default: str = "") -> str:
    return source.get(name, default).strip()


def _int(source: Mapping[str, str], name: str, default: int, minimum: int, maximum: int) -> int:
    raw = _get(source, name)
    if raw == "":
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise SettingsError(f"{name} must be an integer") from exc
    if not minimum <= value <= maximum:
        raise SettingsError(f"{name} must be between {minimum} and {maximum}")
    return value


def load_settings(env: Mapping[str, str] | None = None) -> Settings:
    source: Mapping[str, str] = os.environ if env is None else env

    token = _get(source, "MODEL_SERVICE_TOKEN")
    if len(token) < 16:
        raise SettingsError("MODEL_SERVICE_TOKEN is required and must be at least 16 characters")

    artifact_url = _get(source, "MODEL_ARTIFACT_URL") or None
    artifact_sha256 = _get(source, "MODEL_ARTIFACT_SHA256") or None
    if artifact_url:
        if not artifact_url.startswith("https://"):
            raise SettingsError("MODEL_ARTIFACT_URL must use https://")
        if not artifact_sha256 or len(artifact_sha256) != 64:
            raise SettingsError("MODEL_ARTIFACT_SHA256 (64 hex characters) is required with MODEL_ARTIFACT_URL")

    return Settings(
        environment=_get(source, "ENVIRONMENT", "development"),
        model_dir=_get(source, "MODEL_DIR", "./models/current"),
        token=token,
        max_image_bytes=_int(source, "MAX_IMAGE_BYTES", 8 * 1024 * 1024, 1024, 50 * 1024 * 1024),
        max_pixels=_int(source, "MAX_IMAGE_PIXELS", 40_000_000, 10_000, 200_000_000),
        max_concurrency=_int(source, "MAX_CONCURRENCY", 2, 1, 32),
        queue_timeout_seconds=float(_int(source, "QUEUE_TIMEOUT_SECONDS", 10, 1, 120)),
        intra_op_threads=_int(source, "ORT_INTRA_OP_THREADS", 2, 1, 64),
        artifact_url=artifact_url,
        artifact_sha256=artifact_sha256.lower() if artifact_sha256 else None,
        log_level=_get(source, "LOG_LEVEL", "info").lower(),
    )
