"""HTTP API of the inference service.

Endpoints
  GET  /health        liveness (no auth)
  GET  /ready         readiness: 200 when a model is loaded, else 503 (no auth)
  GET  /v1/model      model card (bearer token)
  POST /v1/predict    multipart field "image" (+ optional "top_k") -> predictions, uncertainty,
                      out-of-domain and quality signals (bearer token)
Errors are JSON: {"error": {"code": "...", "message": "..."}}.
"""

from __future__ import annotations

import hmac
import logging
import threading
from typing import Any

from fastapi import FastAPI, File, Form, Header, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from . import __version__
from .config import Settings
from .imaging import ImageRejected, decode_image
from .inference import ModelNotLoaded, ModelRunner

logger = logging.getLogger("model-service")

MULTIPART_OVERHEAD = 64 * 1024


class ServiceError(Exception):
    def __init__(self, code: str, message: str, status: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def error_response(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


class BodySizeLimitMiddleware:
    """Reject request bodies above a limit before multipart parsing buffers them."""

    def __init__(self, app: ASGIApp, max_body: int) -> None:
        self.app = app
        self.max_body = max_body

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        for name, value in scope.get("headers", []):
            if name == b"content-length" and value.isdigit() and int(value) > self.max_body:
                await error_response(413, "FILE_TOO_LARGE", "The request body is too large")(scope, receive, send)
                return
        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_body:
                    raise ServiceError("FILE_TOO_LARGE", "The request body is too large", 413)
            return message

        try:
            await self.app(scope, limited_receive, send)
        except ServiceError as exc:
            await error_response(exc.status, exc.code, exc.message)(scope, receive, send)


def create_app(settings: Settings, runner: ModelRunner | None = None, load_model: bool = True) -> FastAPI:
    production = settings.environment == "production"
    app = FastAPI(
        title="AgroSaarthi model service",
        version=__version__,
        docs_url=None if production else "/docs",
        redoc_url=None,
        openapi_url=None if production else "/openapi.json",
    )
    app.add_middleware(BodySizeLimitMiddleware, max_body=settings.max_image_bytes + MULTIPART_OVERHEAD)

    state: dict[str, Any] = {"runner": runner, "load_error": None}
    if runner is None and load_model:
        try:
            state["runner"] = ModelRunner(settings.model_dir, settings.intra_op_threads)
            logger.info("model loaded: %s %s", state["runner"].card.name, state["runner"].card.version)
        except (ModelNotLoaded, OSError, ValueError) as exc:
            # Start anyway so /health and /ready can report the problem.
            state["load_error"] = str(exc)
            logger.error("model not loaded: %s", exc)

    slots = threading.BoundedSemaphore(settings.max_concurrency)
    expected_auth = f"Bearer {settings.token}".encode()

    def check_token(authorization: str | None) -> None:
        if authorization is None or not hmac.compare_digest(authorization.encode(), expected_auth):
            raise ServiceError("UNAUTHORIZED", "Missing or invalid service token", 401)

    def get_runner() -> ModelRunner:
        current = state["runner"]
        if current is None:
            raise ServiceError("MODEL_NOT_LOADED", "No model is loaded", 503)
        return current

    @app.exception_handler(ServiceError)
    async def _service_error(_: Request, exc: ServiceError) -> JSONResponse:
        return error_response(exc.status, exc.code, exc.message)

    @app.exception_handler(ImageRejected)
    async def _image_rejected(_: Request, exc: ImageRejected) -> JSONResponse:
        return error_response(exc.status, exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        return error_response(400, "BAD_REQUEST", "Invalid request: expected multipart field 'image' and optional 'top_k' (1-10)")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/ready")
    def ready() -> JSONResponse:
        current = state["runner"]
        if current is None:
            return JSONResponse(status_code=503, content={"status": "not_ready", "reason": "model not loaded"})
        return JSONResponse(content={"status": "ready", "model": {"name": current.card.name, "version": current.card.version}})

    @app.get("/v1/model")
    def model_info(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        check_token(authorization)
        return get_runner().card.public_dict()

    @app.post("/v1/predict")
    def predict(
        image: UploadFile = File(...),
        top_k: int = Form(default=3, ge=1, le=10),
        authorization: str | None = Header(default=None),
    ) -> dict[str, Any]:
        check_token(authorization)
        current = get_runner()
        data = image.file.read(settings.max_image_bytes + 1)
        img = decode_image(data, settings.max_image_bytes, settings.max_pixels)
        if not slots.acquire(timeout=settings.queue_timeout_seconds):
            raise ServiceError("BUSY", "The model service is busy; retry shortly", 503)
        try:
            return current.predict(img, top_k=top_k)
        finally:
            slots.release()

    return app
