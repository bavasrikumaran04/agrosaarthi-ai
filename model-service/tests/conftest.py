"""Test fixtures.

`tiny_model_dir` builds a TEST FIXTURE ONNX model: GlobalAveragePool -> Flatten (features = per-channel
means of the normalised image) -> Gemm (logits). It has hand-set weights so colour decides the class;
it is NOT a crop-disease model and its outputs mean nothing agronomically.
"""

from __future__ import annotations

import io
import json
from pathlib import Path

import numpy as np
import onnx
import pytest
from fastapi.testclient import TestClient
from onnx import TensorProto, helper, numpy_helper
from PIL import Image

from app.config import load_settings
from app.main import create_app

TOKEN = "test-token-0123456789abcdef"
CLASSES = [
    {"index": 0, "classKey": "Fixture___red", "cropKey": "fixture", "diseaseKey": "fixture_red", "label": "Fixture red"},
    {"index": 1, "classKey": "Fixture___green", "cropKey": "fixture", "diseaseKey": "fixture_green", "label": "Fixture green"},
    {"index": 2, "classKey": "Fixture___blue", "cropKey": "fixture", "diseaseKey": "fixture_blue", "label": "Fixture blue"},
]

MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]


def _normalised_channel_means(rgb: tuple[int, int, int]) -> list[float]:
    return [((c / 255.0) - m) / s for c, m, s in zip(rgb, MEAN, STD)]


def build_tiny_model(path: Path) -> None:
    weights = (np.eye(3, dtype=np.float32) * 6.0)  # features [N,3] @ W [3,3] -> logits favour the dominant channel
    inp = helper.make_tensor_value_info("input", TensorProto.FLOAT, ["N", 3, 224, 224])
    feats = helper.make_tensor_value_info("features", TensorProto.FLOAT, ["N", 3])
    logits = helper.make_tensor_value_info("logits", TensorProto.FLOAT, ["N", 3])
    nodes = [
        helper.make_node("GlobalAveragePool", ["input"], ["pooled"]),
        helper.make_node("Flatten", ["pooled"], ["features"], axis=1),
        helper.make_node("Gemm", ["features", "W", "B"], ["logits"]),
    ]
    graph = helper.make_graph(
        nodes,
        "tiny_fixture",
        [inp],
        [logits, feats],
        initializer=[numpy_helper.from_array(weights, "W"), numpy_helper.from_array(np.zeros(3, np.float32), "B")],
    )
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 17)], producer_name="agrosaarthi-test-fixture")
    model.ir_version = 9
    onnx.checker.check_model(model)
    onnx.save(model, str(path))


def card(ood: bool = True) -> dict:
    data = {
        "schemaVersion": 1,
        "name": "TEST FIXTURE - not a crop model",
        "version": "0.0.0-test",
        "preprocess": {"resizeShorterSide": 256, "centerCrop": 224, "mean": MEAN, "std": STD, "interpolation": "bilinear"},
        "classes": CLASSES,
        "thresholds": {"minConfidence": 0.6, "minMargin": 0.15},
        "quality": {"blurVarianceMin": 5.0, "minBrightness": 35, "maxBrightness": 225, "minContrast": 5, "minVegetationRatio": 0.12, "minDimension": 128},
        "dataset": {"name": "synthetic test fixture"},
        "metrics": {"note": "none - test fixture"},
        "limitations": ["Test fixture only."],
    }
    if ood:
        data["ood"] = {
            "method": "mahalanobis",
            "threshold": 4.0,
            "classMeans": [
                _normalised_channel_means((200, 40, 40)),
                _normalised_channel_means((40, 160, 40)),
                _normalised_channel_means((40, 40, 200)),
            ],
            "precision": np.eye(3).tolist(),
        }
    return data


@pytest.fixture
def tiny_model_dir(tmp_path: Path) -> Path:
    build_tiny_model(tmp_path / "model.onnx")
    (tmp_path / "model_card.json").write_text(json.dumps(card()), encoding="utf-8")
    return tmp_path


@pytest.fixture
def settings_env(tiny_model_dir: Path) -> dict[str, str]:
    return {"MODEL_SERVICE_TOKEN": TOKEN, "MODEL_DIR": str(tiny_model_dir), "MAX_IMAGE_BYTES": str(2 * 1024 * 1024)}


@pytest.fixture
def client(settings_env: dict[str, str]) -> TestClient:
    return TestClient(create_app(load_settings(settings_env)))


def textured_image(rgb: tuple[int, int, int], size: tuple[int, int] = (320, 320), fmt: str = "PNG") -> bytes:
    """Solid colour plus a deterministic checkerboard so blur/contrast checks see texture."""
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w]
    checker = (((yy // 8) + (xx // 8)) % 2).astype(np.float32) * 40.0 - 20.0
    arr = np.clip(np.array(rgb, dtype=np.float32)[None, None, :] + checker[..., None], 0, 255).astype(np.uint8)
    buf = io.BytesIO()
    Image.fromarray(arr, "RGB").save(buf, format=fmt)
    return buf.getvalue()


def auth() -> dict[str, str]:
    return {"Authorization": f"Bearer {TOKEN}"}
