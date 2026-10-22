from __future__ import annotations

import io
import json

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import SettingsError, load_settings
from app.main import create_app

from .conftest import TOKEN, auth, textured_image


def test_health_and_ready(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok"}
    ready = client.get("/ready")
    assert ready.status_code == 200
    assert ready.json()["model"]["version"] == "0.0.0-test"


def test_ready_reports_missing_model(tmp_path) -> None:
    app = create_app(load_settings({"MODEL_SERVICE_TOKEN": TOKEN, "MODEL_DIR": str(tmp_path / "nothing")}))
    c = TestClient(app)
    assert c.get("/health").status_code == 200
    assert c.get("/ready").status_code == 503
    r = c.post("/v1/predict", headers=auth(), files={"image": ("a.png", textured_image((40, 160, 40)), "image/png")})
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "MODEL_NOT_LOADED"


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer wrong-token-xxxxxxxx"}, {"Authorization": TOKEN}])
def test_auth_required(client: TestClient, headers: dict[str, str]) -> None:
    assert client.get("/v1/model", headers=headers).status_code == 401
    r = client.post("/v1/predict", headers=headers, files={"image": ("a.png", textured_image((40, 160, 40)), "image/png")})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHORIZED"


def test_model_card_omits_ood_statistics(client: TestClient) -> None:
    body = client.get("/v1/model", headers=auth()).json()
    assert body["name"].startswith("TEST FIXTURE")
    assert body["ood"] == {"method": "mahalanobis", "threshold": 4.0}
    assert len(body["classes"]) == 3


def test_predict_green_image(client: TestClient) -> None:
    r = client.post("/v1/predict", headers=auth(), files={"image": ("leaf.png", textured_image((40, 160, 40)), "image/png")}, data={"top_k": "2"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["model"] == {"name": "TEST FIXTURE - not a crop model", "version": "0.0.0-test"}
    assert len(body["predictions"]) == 2
    assert body["predictions"][0]["classKey"] == "Fixture___green"
    assert body["predictions"][0]["score"] >= body["predictions"][1]["score"]
    assert set(body["uncertainty"]) == {"maxProbability", "margin", "entropy", "abstain", "reasons"}
    assert body["outOfDomain"]["method"] == "mahalanobis"
    assert body["quality"]["metrics"]["vegetationRatio"] > 0.5
    assert body["inferenceMs"] >= 0


def test_jpeg_and_webp_accepted(client: TestClient) -> None:
    for fmt, mime in (("JPEG", "image/jpeg"), ("WEBP", "image/webp")):
        r = client.post("/v1/predict", headers=auth(), files={"image": (f"x.{fmt.lower()}", textured_image((40, 160, 40), fmt=fmt), mime)})
        assert r.status_code == 200, (fmt, r.text)


def test_rejects_non_images_and_unsupported_formats(client: TestClient) -> None:
    r = client.post("/v1/predict", headers=auth(), files={"image": ("x.png", b"not really a png", "image/png")})
    assert r.status_code == 400 and r.json()["error"]["code"] == "INVALID_IMAGE"

    buf = io.BytesIO()
    Image.new("RGB", (200, 200), (10, 200, 10)).save(buf, format="GIF")
    r = client.post("/v1/predict", headers=auth(), files={"image": ("x.gif", buf.getvalue(), "image/gif")})
    assert r.status_code == 415 and r.json()["error"]["code"] == "UNSUPPORTED_FORMAT"

    r = client.post("/v1/predict", headers=auth(), files={"image": ("x.png", b"", "image/png")})
    assert r.status_code == 400 and r.json()["error"]["code"] == "EMPTY_FILE"


def test_rejects_truncated_image(client: TestClient) -> None:
    data = textured_image((40, 160, 40), fmt="JPEG")
    r = client.post("/v1/predict", headers=auth(), files={"image": ("x.jpg", data[: len(data) // 2], "image/jpeg")})
    assert r.status_code == 400


def test_rejects_oversized_upload(client: TestClient) -> None:
    big = b"\x89PNG" + b"0" * (3 * 1024 * 1024)
    r = client.post("/v1/predict", headers=auth(), files={"image": ("big.png", big, "image/png")})
    assert r.status_code == 413


def test_rejects_decompression_bomb(settings_env) -> None:
    env = dict(settings_env, MAX_IMAGE_PIXELS="250000")
    c = TestClient(create_app(load_settings(env)))
    buf = io.BytesIO()
    Image.new("RGB", (2000, 2000), (20, 160, 20)).save(buf, format="PNG")
    r = c.post("/v1/predict", headers=auth(), files={"image": ("bomb.png", buf.getvalue(), "image/png")})
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "TOO_MANY_PIXELS"


def test_rejects_bad_top_k(client: TestClient) -> None:
    r = client.post("/v1/predict", headers=auth(), files={"image": ("a.png", textured_image((40, 160, 40)), "image/png")}, data={"top_k": "50"})
    assert r.status_code == 400


def test_settings_validation() -> None:
    with pytest.raises(SettingsError):
        load_settings({})
    with pytest.raises(SettingsError):
        load_settings({"MODEL_SERVICE_TOKEN": TOKEN, "MODEL_ARTIFACT_URL": "http://insecure.example/model.zip", "MODEL_ARTIFACT_SHA256": "a" * 64})
    with pytest.raises(SettingsError):
        load_settings({"MODEL_SERVICE_TOKEN": TOKEN, "MODEL_ARTIFACT_URL": "https://example.org/model.zip"})
    with pytest.raises(SettingsError):
        load_settings({"MODEL_SERVICE_TOKEN": TOKEN, "MAX_CONCURRENCY": "0"})


def test_invalid_model_card_is_reported_not_crashing(tiny_model_dir) -> None:
    card_path = tiny_model_dir / "model_card.json"
    data = json.loads(card_path.read_text(encoding="utf-8"))
    data["classes"] = data["classes"][:2]  # card/graph class-count mismatch
    data.pop("ood")
    card_path.write_text(json.dumps(data), encoding="utf-8")
    c = TestClient(create_app(load_settings({"MODEL_SERVICE_TOKEN": TOKEN, "MODEL_DIR": str(tiny_model_dir)})))
    assert c.get("/ready").status_code == 503
