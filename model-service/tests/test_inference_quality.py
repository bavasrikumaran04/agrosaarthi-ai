from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path
from unittest import mock

import numpy as np
import pytest
from PIL import Image, ImageFilter

from app.artifacts import ArtifactError, ensure_model_artifact
from app.config import load_settings
from app.imaging import decode_image, preprocess
from app.inference import ModelRunner, mahalanobis_min_distance, softmax
from app.model_card import ModelCard, QualityConfig
from app.quality import assess_quality, laplacian_variance

from .conftest import TOKEN, card, textured_image


def test_softmax_is_a_distribution() -> None:
    p = softmax(np.array([1.0, 2.0, 3.0]))
    assert pytest.approx(float(p.sum())) == 1.0
    assert p.argmax() == 2


def test_mahalanobis_distance_is_zero_at_a_class_mean() -> None:
    means = np.array([[0.0, 0.0], [5.0, 5.0]])
    assert mahalanobis_min_distance(np.array([5.0, 5.0]), means, np.eye(2)) == 0.0
    assert mahalanobis_min_distance(np.array([1.0, 0.0]), means, np.eye(2)) == pytest.approx(1.0)


def test_confident_prediction_and_ood_on_matching_colour(tiny_model_dir: Path) -> None:
    runner = ModelRunner(tiny_model_dir)
    img = decode_image(textured_image((200, 40, 40)), 10_000_000, 40_000_000)
    out = runner.predict(img, top_k=3)
    assert out["predictions"][0]["classKey"] == "Fixture___red"
    assert out["outOfDomain"]["flagged"] is False
    assert pytest.approx(sum(p["score"] for p in out["predictions"]), abs=1e-5) == 1.0


def test_abstains_on_ambiguous_input(tiny_model_dir: Path) -> None:
    runner = ModelRunner(tiny_model_dir)
    # The ImageNet mean colour normalises to ~zero features -> equal logits -> uniform probabilities.
    neutral = decode_image(textured_image((124, 116, 104)), 10_000_000, 40_000_000)
    out = runner.predict(neutral)
    assert out["uncertainty"]["abstain"] is True
    assert "LOW_CONFIDENCE" in out["uncertainty"]["reasons"] or "AMBIGUOUS_TOP_CLASSES" in out["uncertainty"]["reasons"]


def test_flags_out_of_distribution_features(tiny_model_dir: Path) -> None:
    runner = ModelRunner(tiny_model_dir)
    white = decode_image(textured_image((250, 250, 250)), 10_000_000, 40_000_000)
    out = runner.predict(white)
    assert out["outOfDomain"]["flagged"] is True
    assert out["outOfDomain"]["score"] > out["outOfDomain"]["threshold"]


def test_runner_without_ood_reports_max_softmax(tiny_model_dir: Path) -> None:
    (tiny_model_dir / "model_card.json").write_text(json.dumps(card(ood=False)), encoding="utf-8")
    out = ModelRunner(tiny_model_dir).predict(decode_image(textured_image((40, 160, 40)), 10_000_000, 40_000_000))
    assert out["outOfDomain"] == {"method": "max_softmax", "score": None, "threshold": None, "flagged": False}


def test_preprocess_shape_and_normalisation() -> None:
    cfg = ModelCard.model_validate(card()).preprocess
    img = Image.new("RGB", (640, 480), (124, 116, 104))  # ~ImageNet mean colour
    arr = preprocess(img, cfg)
    assert arr.shape == (1, 3, 224, 224)
    assert arr.dtype == np.float32
    assert np.abs(arr.mean()) < 0.05


def test_quality_flags_dark_bright_blurry_small_and_non_plant() -> None:
    cfg = QualityConfig.model_validate({"blurVarianceMin": 30.0, "minContrast": 10, "minDimension": 128})
    dark = assess_quality(Image.new("RGB", (300, 300), (5, 5, 5)), cfg)
    assert "TOO_DARK" in dark.issues and not dark.ok
    bright = assess_quality(Image.new("RGB", (300, 300), (252, 252, 252)), cfg)
    assert "TOO_BRIGHT" in bright.issues
    small = assess_quality(Image.open(io.BytesIO(textured_image((40, 160, 40), size=(64, 64)))).convert("RGB"), cfg)
    assert "TOO_SMALL" in small.issues
    sharp = Image.open(io.BytesIO(textured_image((40, 160, 40)))).convert("RGB")
    blurred = sharp.filter(ImageFilter.GaussianBlur(radius=12))
    assert assess_quality(sharp, cfg).metrics["blurVariance"] > assess_quality(blurred, cfg).metrics["blurVariance"]
    assert "BLURRY" in assess_quality(blurred, cfg).issues
    blue = assess_quality(Image.open(io.BytesIO(textured_image((30, 40, 200)))).convert("RGB"), cfg)
    assert "LOW_VEGETATION" in blue.issues
    green = assess_quality(sharp, cfg)
    assert green.ok and "LOW_VEGETATION" not in green.issues


def test_laplacian_of_flat_image_is_zero() -> None:
    assert laplacian_variance(np.full((50, 50), 100.0)) == 0.0


def test_model_card_validation() -> None:
    bad = card()
    bad["classes"][1]["index"] = 5
    with pytest.raises(ValueError):
        ModelCard.model_validate(bad)
    dup = card()
    dup["classes"][1]["classKey"] = dup["classes"][0]["classKey"]
    with pytest.raises(ValueError):
        ModelCard.model_validate(dup)


def _zip_bytes(members: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, data in members.items():
            z.writestr(name, data)
    return buf.getvalue()


class _FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


@pytest.mark.parametrize("tamper", [False, True])
def test_artifact_download_verifies_checksum(tmp_path: Path, tiny_model_dir: Path, tamper: bool) -> None:
    import hashlib

    payload = _zip_bytes({
        "model.onnx": (tiny_model_dir / "model.onnx").read_bytes(),
        "model_card.json": (tiny_model_dir / "model_card.json").read_bytes(),
    })
    digest = hashlib.sha256(payload).hexdigest()
    target = tmp_path / "downloaded"
    settings = load_settings({
        "MODEL_SERVICE_TOKEN": TOKEN,
        "MODEL_DIR": str(target),
        "MODEL_ARTIFACT_URL": "https://example.org/model.zip",
        "MODEL_ARTIFACT_SHA256": ("0" * 64) if tamper else digest,
    })
    with mock.patch("urllib.request.urlopen", return_value=_FakeResponse(payload)):
        if tamper:
            with pytest.raises(ArtifactError):
                ensure_model_artifact(settings)
            assert not (target / "model.onnx").exists()
        else:
            ensure_model_artifact(settings)
            assert (target / "model.onnx").is_file() and (target / "model_card.json").is_file()


def test_artifact_rejects_unexpected_members(tmp_path: Path) -> None:
    import hashlib

    payload = _zip_bytes({"../evil.onnx": b"x", "model_card.json": b"{}"})
    settings = load_settings({
        "MODEL_SERVICE_TOKEN": TOKEN,
        "MODEL_DIR": str(tmp_path / "m"),
        "MODEL_ARTIFACT_URL": "https://example.org/model.zip",
        "MODEL_ARTIFACT_SHA256": hashlib.sha256(payload).hexdigest(),
    })
    with mock.patch("urllib.request.urlopen", return_value=_FakeResponse(payload)):
        with pytest.raises(ArtifactError):
            ensure_model_artifact(settings)
    assert not (tmp_path / "evil.onnx").exists()
