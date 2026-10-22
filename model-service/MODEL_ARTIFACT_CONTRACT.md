# Model artifact contract (training pipeline → model service)

The model service loads a **model directory** (`MODEL_DIR`, default `./models/current`) containing:

| File | Required | Purpose |
|---|---|---|
| `model.onnx` | yes | ONNX graph. Input `input` float32 `[N,3,H,W]` (NCHW, normalised). Outputs `logits` `[N,C]` and, optionally, `features` `[N,D]` (penultimate embeddings used for out-of-distribution scoring). |
| `model_card.json` | yes | Metadata below. The backend copies it verbatim into `ModelVersion.modelCard`; metrics must be the ones actually measured. |

Model weights are **never committed to Git**. Deployments either mount the directory or set
`MODEL_ARTIFACT_URL` (a `.zip` containing the two files) **and** `MODEL_ARTIFACT_SHA256`; the service downloads and
verifies the checksum at startup.

## `model_card.json`

```json
{
  "schemaVersion": 1,
  "name": "agrosaarthi-leaf-classifier",
  "version": "2026.10.0",
  "createdAt": "2026-10-22T00:00:00Z",
  "framework": "pytorch->onnx",
  "architecture": "e.g. mobilenetv3_large_100 backbone + linear head",
  "preprocess": {
    "resizeShorterSide": 256,
    "centerCrop": 224,
    "mean": [0.485, 0.456, 0.406],
    "std": [0.229, 0.224, 0.225],
    "interpolation": "bilinear"
  },
  "classes": [
    { "index": 0, "classKey": "Tomato___Early_blight", "cropKey": "tomato", "diseaseKey": "tomato_early_blight", "label": "Tomato — early blight" }
  ],
  "thresholds": {
    "minConfidence": 0.6,
    "minMargin": 0.15
  },
  "ood": {
    "method": "mahalanobis",
    "threshold": 123.4,
    "classMeans": [[0.0]],
    "precision": [[0.0]]
  },
  "quality": {
    "blurVarianceMin": 60.0,
    "minBrightness": 35,
    "maxBrightness": 225,
    "minContrast": 18,
    "minVegetationRatio": 0.12,
    "minDimension": 128
  },
  "dataset": { "name": "...", "license": "...", "url": "...", "split": "...", "notes": "..." },
  "metrics": { "description": "Held-out test metrics measured by ml/evaluate.py — see evaluation report", "...": "..." },
  "limitations": ["Trained on laboratory-style leaf photos; field accuracy is lower — see field evaluation."]
}
```

Rules:
- `classes[i].index` must match the logit index; `classKey` values must match `Disease.modelClassKeys` in the backend.
- `thresholds` and `ood.threshold` are calibrated on the **validation** split (never the test split) by the training pipeline.
- If `ood` is omitted, the service falls back to max-softmax uncertainty only and reports `method: "max_softmax"`.
- `ood.classMeans` is `[C][D]` and `ood.precision` is the shared `[D][D]` precision (inverse covariance) matrix of
  `features` on the training split (Mahalanobis distance = min over classes of (f−μc)ᵀ Σ⁻¹ (f−μc)).
