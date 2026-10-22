"""Schema of model_card.json (see MODEL_ARTIFACT_CONTRACT.md)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Preprocess(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    resize_shorter_side: int = Field(alias="resizeShorterSide", ge=32, le=2048)
    center_crop: int = Field(alias="centerCrop", ge=32, le=2048)
    mean: list[float] = Field(min_length=3, max_length=3)
    std: list[float] = Field(min_length=3, max_length=3)
    interpolation: Literal["bilinear", "bicubic"] = "bilinear"

    @model_validator(mode="after")
    def _check(self) -> "Preprocess":
        if self.center_crop > self.resize_shorter_side:
            raise ValueError("centerCrop must not exceed resizeShorterSide")
        if any(s <= 0 for s in self.std):
            raise ValueError("std values must be positive")
        return self


class ClassInfo(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    index: int = Field(ge=0)
    class_key: str = Field(alias="classKey", min_length=1, max_length=120)
    crop_key: str | None = Field(default=None, alias="cropKey")
    disease_key: str | None = Field(default=None, alias="diseaseKey")
    label: str = Field(min_length=1, max_length=200)


class Thresholds(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    min_confidence: float = Field(alias="minConfidence", ge=0, le=1)
    min_margin: float = Field(alias="minMargin", ge=0, le=1)


class OodConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    method: Literal["mahalanobis"]
    threshold: float = Field(gt=0)
    class_means: list[list[float]] = Field(alias="classMeans")
    precision: list[list[float]]


class QualityConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    blur_variance_min: float = Field(default=60.0, alias="blurVarianceMin", ge=0)
    min_brightness: float = Field(default=35, alias="minBrightness", ge=0, le=255)
    max_brightness: float = Field(default=225, alias="maxBrightness", ge=0, le=255)
    min_contrast: float = Field(default=18, alias="minContrast", ge=0)
    min_vegetation_ratio: float = Field(default=0.12, alias="minVegetationRatio", ge=0, le=1)
    min_dimension: int = Field(default=128, alias="minDimension", ge=16)


class ModelCard(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")
    schema_version: Literal[1] = Field(alias="schemaVersion")
    name: str = Field(min_length=1, max_length=120)
    version: str = Field(min_length=1, max_length=60)
    preprocess: Preprocess
    classes: list[ClassInfo] = Field(min_length=2)
    thresholds: Thresholds
    ood: OodConfig | None = None
    quality: QualityConfig = Field(default_factory=QualityConfig)
    dataset: dict[str, Any] | None = None
    metrics: dict[str, Any] | None = None
    limitations: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _check_classes(self) -> "ModelCard":
        indices = sorted(c.index for c in self.classes)
        if indices != list(range(len(self.classes))):
            raise ValueError("class indices must be contiguous starting at 0")
        keys = [c.class_key for c in self.classes]
        if len(set(keys)) != len(keys):
            raise ValueError("classKey values must be unique")
        if self.ood is not None:
            if len(self.ood.class_means) != len(self.classes):
                raise ValueError("ood.classMeans must have one row per class")
            dims = {len(row) for row in self.ood.class_means}
            if len(dims) != 1:
                raise ValueError("ood.classMeans rows must have equal length")
            d = dims.pop()
            if len(self.ood.precision) != d or any(len(r) != d for r in self.ood.precision):
                raise ValueError("ood.precision must be a DxD matrix matching classMeans")
        return self

    def sorted_classes(self) -> list[ClassInfo]:
        return sorted(self.classes, key=lambda c: c.index)

    def public_dict(self) -> dict[str, Any]:
        """Model card as returned by GET /v1/model (OOD statistics omitted: large and not useful to clients)."""
        data = self.model_dump(by_alias=True, exclude={"ood"})
        data["ood"] = (
            {"method": self.ood.method, "threshold": self.ood.threshold} if self.ood is not None else None
        )
        return data
