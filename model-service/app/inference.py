"""Model loading and prediction with uncertainty and out-of-distribution signals."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import numpy as np
import onnxruntime as ort

from .imaging import preprocess
from .model_card import ModelCard
from .quality import QualityResult, assess_quality


class ModelNotLoaded(RuntimeError):
    pass


def softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - logits.max(axis=-1, keepdims=True)
    exp = np.exp(shifted)
    return exp / exp.sum(axis=-1, keepdims=True)


def mahalanobis_min_distance(features: np.ndarray, class_means: np.ndarray, precision: np.ndarray) -> float:
    """min_c (f - mu_c)^T P (f - mu_c) for a single feature vector."""
    diffs = class_means - features[np.newaxis, :]
    distances = np.einsum("cd,de,ce->c", diffs, precision, diffs)
    return float(distances.min())


class ModelRunner:
    """Wraps one ONNX model + its card. Thread-safe for concurrent `predict` calls (onnxruntime sessions are)."""

    def __init__(self, model_dir: str | Path, intra_op_threads: int = 2) -> None:
        directory = Path(model_dir)
        card_path = directory / "model_card.json"
        model_path = directory / "model.onnx"
        if not card_path.is_file() or not model_path.is_file():
            raise ModelNotLoaded(f"model directory {directory} must contain model.onnx and model_card.json")
        self.card = ModelCard.model_validate(json.loads(card_path.read_text(encoding="utf-8")))

        options = ort.SessionOptions()
        options.intra_op_num_threads = intra_op_threads
        options.inter_op_num_threads = 1
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(str(model_path), sess_options=options, providers=["CPUExecutionProvider"])

        inputs = self.session.get_inputs()
        if len(inputs) != 1:
            raise ModelNotLoaded("model must have exactly one input")
        self.input_name = inputs[0].name
        output_names = [o.name for o in self.session.get_outputs()]
        if "logits" not in output_names:
            raise ModelNotLoaded("model must expose an output named 'logits'")
        self.has_features = "features" in output_names
        self.output_names = ["logits", "features"] if self.has_features else ["logits"]

        self.classes = self.card.sorted_classes()
        self._ood = None
        if self.card.ood is not None:
            if not self.has_features:
                raise ModelNotLoaded("model card configures Mahalanobis OOD but the model has no 'features' output")
            self._ood = (
                np.asarray(self.card.ood.class_means, dtype=np.float64),
                np.asarray(self.card.ood.precision, dtype=np.float64),
                float(self.card.ood.threshold),
            )

        # Validate the class count against the graph with one dry run.
        dummy = np.zeros((1, 3, self.card.preprocess.center_crop, self.card.preprocess.center_crop), dtype=np.float32)
        out = self.session.run(self.output_names, {self.input_name: dummy})
        if out[0].shape[-1] != len(self.classes):
            raise ModelNotLoaded(f"model outputs {out[0].shape[-1]} logits but the card lists {len(self.classes)} classes")

    def predict(self, img, top_k: int = 3) -> dict[str, Any]:
        started = time.perf_counter()
        quality: QualityResult = assess_quality(img, self.card.quality)
        batch = preprocess(img, self.card.preprocess)
        outputs = self.session.run(self.output_names, {self.input_name: batch})
        logits = np.asarray(outputs[0], dtype=np.float64)[0]
        probs = softmax(logits)
        order = np.argsort(-probs)
        k = max(1, min(top_k, len(self.classes)))
        predictions = []
        for idx in order[:k]:
            info = self.classes[int(idx)]
            predictions.append(
                {
                    "classKey": info.class_key,
                    "cropKey": info.crop_key,
                    "diseaseKey": info.disease_key,
                    "label": info.label,
                    "score": round(float(probs[idx]), 6),
                }
            )

        max_prob = float(probs[order[0]])
        second = float(probs[order[1]]) if len(order) > 1 else 0.0
        margin = max_prob - second
        entropy = float(-(probs * np.log(np.clip(probs, 1e-12, 1.0))).sum())
        reasons: list[str] = []
        if max_prob < self.card.thresholds.min_confidence:
            reasons.append("LOW_CONFIDENCE")
        if margin < self.card.thresholds.min_margin:
            reasons.append("AMBIGUOUS_TOP_CLASSES")

        if self._ood is not None:
            means, precision, threshold = self._ood
            features = np.asarray(outputs[1], dtype=np.float64)[0]
            score = mahalanobis_min_distance(features, means, precision)
            ood = {"method": "mahalanobis", "score": round(score, 4), "threshold": threshold, "flagged": score > threshold}
        else:
            # Without feature statistics only the softmax signals are available.
            ood = {"method": "max_softmax", "score": None, "threshold": None, "flagged": False}

        return {
            "model": {"name": self.card.name, "version": self.card.version},
            "predictions": predictions,
            "uncertainty": {
                "maxProbability": round(max_prob, 6),
                "margin": round(margin, 6),
                "entropy": round(entropy, 6),
                "abstain": len(reasons) > 0,
                "reasons": reasons,
            },
            "outOfDomain": ood,
            "quality": {"ok": quality.ok, "issues": quality.issues, "metrics": quality.metrics},
            "inferenceMs": round((time.perf_counter() - started) * 1000.0, 2),
        }
