"""Image quality and domain heuristics.

These checks are deliberately simple, explainable heuristics. They do not prove an
image is a leaf; they flag images that are likely to give unreliable predictions so
the platform can ask for a better photo or recommend expert review.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from PIL import Image

from .model_card import QualityConfig

WORK_SIZE = 512


@dataclass
class QualityResult:
    ok: bool
    issues: list[str] = field(default_factory=list)
    metrics: dict[str, float] = field(default_factory=dict)


def laplacian_variance(gray: np.ndarray) -> float:
    """Variance of the 4-neighbour Laplacian: low values indicate blur."""
    if gray.shape[0] < 3 or gray.shape[1] < 3:
        return 0.0
    lap = (
        -4.0 * gray[1:-1, 1:-1]
        + gray[:-2, 1:-1]
        + gray[2:, 1:-1]
        + gray[1:-1, :-2]
        + gray[1:-1, 2:]
    )
    return float(lap.var())


def vegetation_ratio(img: Image.Image) -> float:
    """Fraction of pixels with plant-like colour (yellow→green→cyan hue, not grey, not too dark).

    Diseased tissue is often yellow or brown, so the hue band starts at yellow-orange.
    """
    hsv = np.asarray(img.convert("HSV"), dtype=np.float32)
    hue = hsv[..., 0] * (360.0 / 255.0)
    sat = hsv[..., 1] / 255.0
    val = hsv[..., 2] / 255.0
    mask = (hue >= 25.0) & (hue <= 170.0) & (sat >= 0.15) & (val >= 0.15)
    return float(mask.mean())


def assess_quality(img: Image.Image, cfg: QualityConfig) -> QualityResult:
    width, height = img.size
    issues: list[str] = []
    if min(width, height) < cfg.min_dimension:
        issues.append("TOO_SMALL")

    work = img.copy()
    work.thumbnail((WORK_SIZE, WORK_SIZE))
    rgb = np.asarray(work, dtype=np.float32)
    gray = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)

    brightness = float(gray.mean())
    contrast = float(gray.std())
    blur = laplacian_variance(gray)
    veg = vegetation_ratio(work)

    if brightness < cfg.min_brightness:
        issues.append("TOO_DARK")
    elif brightness > cfg.max_brightness:
        issues.append("TOO_BRIGHT")
    if contrast < cfg.min_contrast:
        issues.append("LOW_CONTRAST")
    if blur < cfg.blur_variance_min:
        issues.append("BLURRY")
    if veg < cfg.min_vegetation_ratio:
        issues.append("LOW_VEGETATION")

    metrics = {
        "width": float(width),
        "height": float(height),
        "meanBrightness": round(brightness, 2),
        "contrast": round(contrast, 2),
        "blurVariance": round(blur, 2),
        "vegetationRatio": round(veg, 4),
    }
    # LOW_VEGETATION is a domain hint, not a quality failure on its own.
    quality_failures = [i for i in issues if i != "LOW_VEGETATION"]
    return QualityResult(ok=len(quality_failures) == 0, issues=issues, metrics=metrics)
