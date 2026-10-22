"""Safe image decoding and model preprocessing."""

from __future__ import annotations

import io
import warnings

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from .model_card import Preprocess

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


class ImageRejected(Exception):
    """The upload is not an acceptable image. `code` is a stable machine-readable reason."""

    def __init__(self, code: str, message: str, status: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def decode_image(data: bytes, max_bytes: int, max_pixels: int) -> Image.Image:
    """Decode by content (never by file extension); reject bombs, corrupt and unsupported files."""
    if len(data) == 0:
        raise ImageRejected("EMPTY_FILE", "The uploaded file is empty", 400)
    if len(data) > max_bytes:
        raise ImageRejected("FILE_TOO_LARGE", "The image file is too large", 413)

    Image.MAX_IMAGE_PIXELS = max_pixels
    with warnings.catch_warnings():
        # Pillow warns (not errors) between 1x and 2x MAX_IMAGE_PIXELS; treat that as a rejection too.
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        try:
            probe = Image.open(io.BytesIO(data))
            fmt = probe.format
            if fmt not in ALLOWED_FORMATS:
                raise ImageRejected("UNSUPPORTED_FORMAT", "Only JPEG, PNG and WebP images are supported", 415)
            if probe.width * probe.height > max_pixels:
                raise ImageRejected("TOO_MANY_PIXELS", "The image dimensions are too large", 413)
            probe.verify()  # structural integrity check (invalidates the object)
            img = Image.open(io.BytesIO(data))
            img.load()  # full decode catches truncated data
        except ImageRejected:
            raise
        except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
            raise ImageRejected("TOO_MANY_PIXELS", "The image dimensions are too large", 413) from exc
        except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
            raise ImageRejected("INVALID_IMAGE", "The file could not be read as an image", 400) from exc

    img = ImageOps.exif_transpose(img)
    return img.convert("RGB")


def preprocess(img: Image.Image, cfg: Preprocess) -> np.ndarray:
    """Resize shorter side, centre-crop, scale to [0,1], normalise, NCHW float32 (batch of 1).

    Must stay identical to the evaluation transform used by the training pipeline.
    """
    resample = Image.Resampling.BICUBIC if cfg.interpolation == "bicubic" else Image.Resampling.BILINEAR
    w, h = img.size
    scale = cfg.resize_shorter_side / min(w, h)
    new_w, new_h = max(cfg.center_crop, round(w * scale)), max(cfg.center_crop, round(h * scale))
    resized = img.resize((new_w, new_h), resample)
    left = (new_w - cfg.center_crop) // 2
    top = (new_h - cfg.center_crop) // 2
    cropped = resized.crop((left, top, left + cfg.center_crop, top + cfg.center_crop))
    arr = np.asarray(cropped, dtype=np.float32) / 255.0
    arr = (arr - np.array(cfg.mean, dtype=np.float32)) / np.array(cfg.std, dtype=np.float32)
    return np.ascontiguousarray(arr.transpose(2, 0, 1)[np.newaxis, ...], dtype=np.float32)
