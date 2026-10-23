# ML pipeline — leaf-disease classifier

`train_head.py` trains the model the model service loads (see `model-service/MODEL_ARTIFACT_CONTRACT.md`).

- **Data:** PlantVillage, Hugging Face copy [`geraldmc/plantvillage-full`](https://huggingface.co/datasets/geraldmc/plantvillage-full)
  (tagged CC0-1.0; the original PlantVillage images by Hughes & Salathé, 2015, are CC BY-SA 3.0, so attribute them).
  It ships a **leaf-grouped train/test split**: all photos of one physical leaf are on the same side.
- **Model:** frozen ImageNet-pretrained `mobilenetv3_large_100` (timm, Apache-2.0) + multinomial logistic-regression
  head; Mahalanobis out-of-domain statistics in a 128-d PCA space. CPU only (about 6 min on this laptop).
- **Leakage prevention:** validation split is carved out of *train* by `leaf_id` groups; the script asserts no leaf is
  shared between train/validation/test. Thresholds and the OOD threshold come from validation only.
- **Same preprocessing as inference:** imports `model-service/app/imaging.preprocess`.

## Run (Windows)

```bash
cd ml
uv venv --python 3.14 .venv
uv pip install --python .venv/Scripts/python.exe --index-url https://download.pytorch.org/whl/cpu \
  --extra-index-url https://pypi.org/simple --index-strategy unsafe-best-match \
  torch torchvision timm scikit-learn pyarrow onnx onnxruntime pillow numpy pydantic
# download data/plantvillage-full/000{0,1}.parquet (≈855 MB) from the dataset's refs/convert/parquet branch
.venv/Scripts/python.exe -u train_head.py --train-per-class 300 --test-per-class 100 --version 2026.10.23-pv38
cp artifacts/2026.10.23-pv38/model.onnx artifacts/2026.10.23-pv38/model_card.json ../model-service/models/current/
```

On a machine with little free memory, features are checkpointed under `cache/features/` and a rerun resumes. Keep
caches on a drive with space (`UV_CACHE_DIR`, `HF_HOME`, `TMP` were pointed at `ml/cache/` here).

## Result of run `2026.10.23-pv38` (measured, held-out leaf-disjoint test split, 3,577 lab photos)

| Metric | Value |
|---|---|
| Top-1 accuracy | 95.9 % |
| Macro F1 | 0.959 |
| Top-3 accuracy | 99.5 % |
| Coverage at thresholds (conf ≥ 0.50, margin ≥ 0.15) | 98.6 % · accuracy on accepted 96.5 % |
| In-distribution test photos flagged out-of-domain | 1.3 % |
| Weakest classes (F1) | Tomato early blight 0.84, Tomato Septoria 0.87, Corn northern leaf blight 0.87, Corn grey leaf spot 0.88 |

Training: 9,496 photos; validation 1,634 (leaf groups held out from train). Full per-class report:
`docs/model/EVALUATION_2026.10.23-pv38.json`. An independent ONNX Runtime check on 136 other test-split photos: 97.1 %.

**Not measured:** accuracy on real field photos (different backgrounds, lighting, multiple leaves). Expect it to be
substantially lower. Crops outside PlantVillage (rice, banana, coconut…) are not covered.
