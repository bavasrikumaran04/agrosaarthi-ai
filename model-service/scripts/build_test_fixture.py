"""Build the TEST FIXTURE model directory (colour -> class; NOT a crop-disease model).

Used only to exercise the real HTTP integration (backend -> model service) before a
trained model exists. Its name in the model card says so, and the UI displays it.

    python scripts/build_test_fixture.py models/test-fixture
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tests.conftest import build_tiny_model, card  # noqa: E402


def main() -> None:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "models/test-fixture")
    out.mkdir(parents=True, exist_ok=True)
    build_tiny_model(out / "model.onnx")
    (out / "model_card.json").write_text(json.dumps(card(), indent=2), encoding="utf-8")
    print(f"TEST FIXTURE model written to {out}")


if __name__ == "__main__":
    main()
