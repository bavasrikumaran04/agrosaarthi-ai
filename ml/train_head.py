"""Train the AgroSaarthi leaf-disease classifier and export it for the model service.

Approach (CPU-friendly transfer learning):
  * frozen ImageNet-pretrained backbone (timm ``mobilenetv3_large_100``, Apache-2.0 weights);
  * multinomial logistic-regression head trained on PlantVillage features;
  * Mahalanobis out-of-distribution statistics in a 128-d PCA space of those features;
  * confidence threshold calibrated on a validation split (never on the test split).

Leakage prevention: the dataset ``geraldmc/plantvillage-full`` provides a leaf-grouped train/test split
(all photos of the same physical leaf are on one side). The validation split is carved out of *train*
by ``leaf_id`` groups. Every reported metric is measured here on the held-out test split.

Images go through ``model-service/app/imaging.preprocess`` — the exact transform used at inference.

Usage:  .venv/Scripts/python.exe train_head.py --train-per-class 200 --test-per-class 80
Output: artifacts/<version>/{model.onnx, model_card.json, evaluation.json}
"""

from __future__ import annotations

import argparse
import faulthandler
import io
import json
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq
import timm
import torch
from PIL import Image
from sklearn.covariance import LedoitWolf
from sklearn.decomposition import PCA
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import GroupShuffleSplit

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "model-service"))
from app.imaging import preprocess  # noqa: E402  (same transform as inference)
from app.model_card import Preprocess  # noqa: E402

BACKBONE = "mobilenetv3_large_100.ra_in1k"
PRE = Preprocess(resizeShorterSide=256, centerCrop=224, mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225], interpolation="bilinear")
CROP_KEYS = {
    "Apple": "apple", "Blueberry": "blueberry", "Cherry_(including_sour)": "cherry", "Corn_(maize)": "maize",
    "Grape": "grape", "Orange": "orange", "Peach": "peach", "Pepper,_bell": "pepper_bell", "Potato": "potato",
    "Raspberry": "raspberry", "Soybean": "soybean", "Squash": "squash", "Strawberry": "strawberry", "Tomato": "tomato",
}
SEED = 20261023


def label_for(class_key: str) -> str:
    crop, _, disease = class_key.partition("___")
    crop = crop.replace("_(including_sour)", "").replace("_(maize)", " (maize)").replace(",_", " ").replace("_", " ")
    disease = disease.replace("_", " ").strip()
    return f"{crop} — {'healthy' if disease == 'healthy' else disease}"


def load_index(data_dir: Path):
    rows = []
    for f in sorted(data_dir.glob("*.parquet")):
        t = pq.read_table(f, columns=["class_label", "class_idx", "split", "leaf_id"])
        for i, (lab, idx, split, leaf) in enumerate(zip(*[t.column(c).to_pylist() for c in t.column_names])):
            rows.append((f, i, lab, idx, split, leaf))
    return rows


def sample(rows, split: str, per_class: int, rng: np.random.Generator):
    by_class = defaultdict(list)
    for r in rows:
        if r[4] == split:
            by_class[r[3]].append(r)
    picked = []
    for idx in sorted(by_class):
        items = by_class[idx]
        take = rng.choice(len(items), size=min(per_class, len(items)), replace=False)
        picked.extend(items[j] for j in sorted(take))
    return picked


def load_images(picked):
    """Read only the selected rows' image bytes (memory-lean: this laptop has little free RAM)."""
    by_file = defaultdict(list)
    for k, r in enumerate(picked):
        by_file[r[0]].append((r[1], k))
    out = [None] * len(picked)
    for f, items in by_file.items():
        pf = pq.ParquetFile(f)
        offset = 0
        for rg in range(pf.num_row_groups):
            n = pf.metadata.row_group(rg).num_rows
            hits = [(i - offset, k) for i, k in items if offset <= i < offset + n]
            if hits:
                col = pf.read_row_group(rg, columns=["image"]).column("image")
                taken = pc.take(col, pa.array([i for i, _ in hits])).combine_chunks()
                for (_, k), v in zip(hits, taken.field("bytes").to_pylist()):
                    out[k] = v
                del col, taken
                pa.default_memory_pool().release_unused()
            offset += n
    return out


@torch.inference_mode()
def extract(model, images, cache: Path, batch=32, chunk=512):
    """Backbone features, checkpointed every `chunk` images so a crash (low-memory laptop) can resume."""
    cache.mkdir(parents=True, exist_ok=True)
    parts = []
    t0 = time.time()
    for c in range(0, len(images), chunk):
        f = cache / f"{c:06d}.npy"
        if f.exists():
            parts.append(np.load(f))
            continue
        feats = []
        for s in range(c, min(c + chunk, len(images)), batch):
            arr = np.concatenate([preprocess(Image.open(io.BytesIO(b)).convert("RGB"), PRE) for b in images[s : min(s + batch, c + chunk, len(images))]])
            feats.append(model.forward_head(model.forward_features(torch.from_numpy(arr)), pre_logits=True).numpy())
        part = np.concatenate(feats).astype(np.float64)
        np.save(f, part)
        parts.append(part)
        done = min(c + chunk, len(images))
        print(f"  features {done}/{len(images)}  ({(done - c) / max(time.time() - t0, 1e-6):.1f} img/s this chunk)", flush=True)
        t0 = time.time()
    return np.concatenate(parts)


class Exported(torch.nn.Module):
    """backbone -> standardise -> (logits, PCA features for Mahalanobis OOD)."""

    def __init__(self, backbone, mu, sd, coef, intercept, pca_mean, pca_comp):
        super().__init__()
        self.backbone = backbone
        f32 = lambda a: torch.tensor(np.asarray(a), dtype=torch.float32)  # noqa: E731
        self.register_buffer("mu", f32(mu))
        self.register_buffer("sd", f32(sd))
        self.register_buffer("w", f32(coef))
        self.register_buffer("b", f32(intercept))
        self.register_buffer("pm", f32(pca_mean))
        self.register_buffer("pc", f32(pca_comp))

    def forward(self, x):
        f = self.backbone.forward_head(self.backbone.forward_features(x), pre_logits=True)
        z = (f - self.mu) / self.sd
        return z @ self.w.T + self.b, (z - self.pm) @ self.pc.T


def main() -> None:
    faulthandler.enable()
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(ROOT / "data" / "plantvillage-full"))
    ap.add_argument("--train-per-class", type=int, default=200)
    ap.add_argument("--test-per-class", type=int, default=80)
    ap.add_argument("--pca-dims", type=int, default=128)
    ap.add_argument("--version", default=datetime.now(timezone.utc).strftime("%Y.%m.%d-head"))
    args = ap.parse_args()
    rng = np.random.default_rng(SEED)
    torch.manual_seed(SEED)

    rows = load_index(Path(args.data))
    class_keys = {r[3]: r[2] for r in rows}
    classes = [class_keys[i] for i in range(len(class_keys))]
    print(f"{len(rows)} images, {len(classes)} classes")

    train_rows = sample(rows, "train", args.train_per_class, rng)
    test_rows = sample(rows, "test", args.test_per_class, rng)
    # Validation = leaf groups held out from the train split (for threshold/OOD calibration only).
    gss = GroupShuffleSplit(n_splits=1, test_size=0.15, random_state=SEED)
    tr_idx, va_idx = next(gss.split(train_rows, groups=[r[5] for r in train_rows]))
    leaves_train = {train_rows[i][5] for i in tr_idx}
    assert not leaves_train & {train_rows[i][5] for i in va_idx}, "leaf leakage train/val"
    assert not leaves_train & {r[5] for r in test_rows}, "leaf leakage train/test"
    print(f"train {len(tr_idx)} · val {len(va_idx)} · test {len(test_rows)} (leaf-disjoint)")

    model = timm.create_model(BACKBONE, pretrained=True, num_classes=0).eval()
    imgs_train = load_images(train_rows)
    imgs_test = load_images(test_rows)
    print("extracting train/val features…")
    cache = ROOT / "cache" / "features" / f"{BACKBONE}-{args.train_per_class}-{args.test_per_class}-{SEED}"
    f_trval = extract(model, imgs_train, cache / "trainval")
    print("extracting test features…")
    f_test = extract(model, imgs_test, cache / "test")
    y_trval = np.array([r[3] for r in train_rows])
    y_test = np.array([r[3] for r in test_rows])
    f_tr, y_tr, f_va, y_va = f_trval[tr_idx], y_trval[tr_idx], f_trval[va_idx], y_trval[va_idx]

    mu, sd = f_tr.mean(0), f_tr.std(0) + 1e-6
    z = lambda f: (f - mu) / sd  # noqa: E731
    clf = LogisticRegression(C=0.5, max_iter=3000)
    t0 = time.time()
    clf.fit(z(f_tr), y_tr)
    print(f"head trained in {time.time() - t0:.1f}s")
    assert list(clf.classes_) == list(range(len(classes))), "every class must appear in the training portion"

    def probs(f):
        logits = z(f) @ clf.coef_.T + clf.intercept_
        e = np.exp(logits - logits.max(1, keepdims=True))
        return e / e.sum(1, keepdims=True)

    # Confidence threshold calibrated on validation: lowest value keeping accepted-set accuracy >= 97%.
    p_va = probs(f_va)
    top_va, pred_va = p_va.max(1), p_va.argmax(1)
    srt = np.sort(p_va, 1)
    margin_va = srt[:, -1] - srt[:, -2]
    min_margin = 0.15
    min_conf = 0.9
    for c in np.arange(0.40, 0.91, 0.05):
        acc_mask = (top_va >= c) & (margin_va >= min_margin)
        if acc_mask.sum() and (pred_va[acc_mask] == y_va[acc_mask]).mean() >= 0.97:
            min_conf = round(float(c), 2)
            break

    # Mahalanobis OOD in PCA space; threshold = 99th percentile of validation distances.
    pca = PCA(n_components=args.pca_dims, random_state=SEED).fit(z(f_tr))
    g_tr = pca.transform(z(f_tr))
    means = np.stack([g_tr[y_tr == k].mean(0) for k in range(len(classes))])
    centred = g_tr - means[y_tr]
    precision = LedoitWolf().fit(centred).precision_

    def maha(g):
        d = g[:, None, :] - means[None, :, :]
        return np.einsum("nkd,de,nke->nk", d, precision, d).min(1)

    ood_threshold = float(np.percentile(maha(pca.transform(z(f_va))), 99))

    # Held-out leaf-disjoint test evaluation.
    p_te = probs(f_test)
    pred_te = p_te.argmax(1)
    srt_te = np.sort(p_te, 1)
    accepted = (srt_te[:, -1] >= min_conf) & ((srt_te[:, -1] - srt_te[:, -2]) >= min_margin)
    ood_te = maha(pca.transform(z(f_test))) > ood_threshold
    report = classification_report(y_test, pred_te, labels=list(range(len(classes))), target_names=classes, output_dict=True, zero_division=0)
    metrics = {
        "description": "Measured by ml/train_head.py on the held-out, leaf-disjoint PlantVillage test split (lab-style photos).",
        "testImages": int(len(y_test)),
        "top1Accuracy": round(float(accuracy_score(y_test, pred_te)), 4),
        "macroF1": round(float(f1_score(y_test, pred_te, average="macro")), 4),
        "top3Accuracy": round(float(np.mean([y in np.argsort(-p)[:3] for p, y in zip(p_te, y_test)])), 4),
        "coverageAtThresholds": round(float(accepted.mean()), 4),
        "accuracyOnAccepted": round(float((pred_te[accepted] == y_test[accepted]).mean()), 4) if accepted.any() else None,
        "inDistributionFlaggedAsOod": round(float(ood_te.mean()), 4),
        "validationImages": int(len(y_va)),
        "trainImages": int(len(y_tr)),
    }
    print(json.dumps(metrics, indent=2))

    out = ROOT / "artifacts" / args.version
    out.mkdir(parents=True, exist_ok=True)
    net = Exported(model, mu, sd, clf.coef_, clf.intercept_, pca.mean_, pca.components_).eval()
    dummy = torch.from_numpy(preprocess(Image.open(io.BytesIO(imgs_test[0])).convert("RGB"), PRE))
    torch.onnx.export(net, (dummy,), str(out / "model.onnx"), input_names=["input"], output_names=["logits", "features"],
                      dynamic_axes={"input": {0: "n"}, "logits": {0: "n"}, "features": {0: "n"}}, opset_version=17, dynamo=False)
    with torch.inference_mode():
        ref_logits, _ = net(dummy)

    card = {
        "schemaVersion": 1,
        "name": "agrosaarthi-leaf-classifier",
        "version": args.version,
        "createdAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "framework": "pytorch->onnx",
        "architecture": f"{BACKBONE} (frozen, ImageNet-pretrained, timm, Apache-2.0) + multinomial logistic-regression head; Mahalanobis OOD on {args.pca_dims}-d PCA features",
        "preprocess": PRE.model_dump(by_alias=True),
        "classes": [{"index": i, "classKey": k, "cropKey": CROP_KEYS.get(k.split("___")[0]), "label": label_for(k)} for i, k in enumerate(classes)],
        "thresholds": {"minConfidence": min_conf, "minMargin": min_margin},
        "ood": {"method": "mahalanobis", "threshold": round(ood_threshold, 4), "classMeans": means.round(6).tolist(), "precision": precision.round(8).tolist()},
        "quality": {"blurVarianceMin": 60.0, "minBrightness": 35, "maxBrightness": 225, "minContrast": 18, "minVegetationRatio": 0.12, "minDimension": 128},
        "dataset": {
            "name": "PlantVillage (geraldmc/plantvillage-full, leaf-grouped split)",
            "url": "https://huggingface.co/datasets/geraldmc/plantvillage-full",
            "license": "Hugging Face copy tagged CC0-1.0; original PlantVillage images (Hughes & Salathé, 2015) released under CC BY-SA 3.0 — attribute accordingly",
            "split": f"leaf-disjoint: {args.train_per_class}/class sampled from train (15% leaf groups held out as validation), {args.test_per_class}/class from test",
            "notes": "Laboratory-style photos of single leaves on plain backgrounds.",
        },
        "metrics": metrics,
        "limitations": [
            "Trained and tested on laboratory-style PlantVillage photos; accuracy on real field photos is expected to be substantially lower and has NOT been measured.",
            "Only the 38 PlantVillage classes (14 crops). Rice, banana, coconut and other Tamil Nadu crops are not covered.",
            "Frozen backbone with a linear head (CPU training); not fine-tuned end to end.",
            "Not a diagnosis. Uncertain or out-of-domain photos must go to an agricultural expert.",
        ],
    }
    (out / "model_card.json").write_text(json.dumps(card, ensure_ascii=False), encoding="utf-8")
    (out / "evaluation.json").write_text(json.dumps({"metrics": metrics, "thresholds": card["thresholds"], "oodThreshold": ood_threshold, "perClass": report, "referenceLogits0": ref_logits[0].tolist()}, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
