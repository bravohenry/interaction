from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import Any

from config import get_settings
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse


from logging_config import configure_logging, logger
from middleware import rate_limit_middleware
from routes import api_router
from services import get_email_watch_coordinator, get_trigger_scheduler


# Register global exception handlers for consistent error responses across the API
def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def _validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        logger.debug("validation error", extra={"errors": exc.errors(), "path": str(request.url)})
        return JSONResponse(
            {"ok": False, "error": "Invalid request", "detail": exc.errors()},
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    @app.exception_handler(HTTPException)
    async def _http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        logger.debug(
            "http error",
            extra={"detail": exc.detail, "status": exc.status_code, "path": str(request.url)},
        )
        detail: str | Any = exc.detail
        if isinstance(detail, str):
            return JSONResponse({"ok": False, "error": detail}, status_code=exc.status_code)
        return JSONResponse({"ok": False, "error": json.dumps(detail)}, status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error", extra={"path": str(request.url)})
        return JSONResponse(
            {"ok": False, "error": "Internal server error"},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


configure_logging()
_settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Configure uvicorn loggers to match custom format
    import logging
    import uvicorn.logging

    # Configure uvicorn.error logger (rename to just "uvicorn" to avoid confusion)
    error_logger = logging.getLogger("uvicorn.error")
    error_logger.name = "uvicorn"
    if error_logger.handlers:
        formatter = uvicorn.logging.DefaultFormatter(
            fmt="%(asctime)s - %(name)s - %(levelprefix)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
            use_colors=True,
        )
        error_logger.handlers[0].setFormatter(formatter)

    # Configure uvicorn.access logger (handles HTTP request logs)
    access_logger = logging.getLogger("uvicorn.access")
    if access_logger.handlers:
        formatter = uvicorn.logging.AccessFormatter(
            fmt='%(asctime)s - %(name)s - %(levelprefix)s - %(client_addr)s - "%(request_line)s" %(status_code)s',
            datefmt="%Y-%m-%d %H:%M:%S",
            use_colors=True,
        )
        access_logger.handlers[0].setFormatter(formatter)

    scheduler = get_trigger_scheduler()
    await scheduler.start()
    coordinator = get_email_watch_coordinator()
    await coordinator.start()

    yield

    # Shutdown
    scheduler = get_trigger_scheduler()
    await scheduler.stop()
    coordinator = get_email_watch_coordinator()
    await coordinator.stop()


app = FastAPI(
    title=_settings.app_name,
    version=_settings.app_version,
    docs_url=None,
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_allow_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add rate limiting middleware
app.add_middleware(rate_limit_middleware, settings=_settings)

register_exception_handlers(app)
app.include_router(api_router)


ROOT_PAGE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OpenPoke API</title>
    <style>
        :root {
            color-scheme: light dark;
            font-family: "Inter", "SF Pro Display", "Segoe UI", sans-serif;
        }
        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
            background: radial-gradient(circle at top, rgba(37,99,235,0.15), transparent 55%),
                        linear-gradient(180deg, #0f172a 0%, #111827 100%);
            color: #0f172a;
        }
        @media (prefers-color-scheme: dark) {
            body {
                color: #f8fafc;
                background: radial-gradient(circle at top, rgba(59,130,246,0.35), transparent 55%),
                            linear-gradient(180deg, #020617 0%, #0f172a 100%);
            }
        }
        main {
            width: min(600px, 100%);
            padding: 2.75rem 2.5rem;
            border-radius: 18px;
            backdrop-filter: blur(14px);
            background: rgba(248,250,252,0.86);
            border: 1px solid rgba(148,163,184,0.35);
            box-shadow: 0 30px 60px -24px rgba(15,23,42,0.6);
        }
        @media (prefers-color-scheme: dark) {
            main {
                background: rgba(15,23,42,0.7);
                border: 1px solid rgba(148,163,184,0.3);
                box-shadow: 0 30px 60px -30px rgba(15,23,42,0.9);
            }
        }
        h1 {
            margin: 0;
            font-size: clamp(2.25rem, 5vw, 2.8rem);
            letter-spacing: -0.04em;
        }
        p {
            margin: 1rem 0 0;
            color: rgba(15,23,42,0.72);
            font-size: 1rem;
            line-height: 1.6;
        }
        @media (prefers-color-scheme: dark) {
            p {
                color: rgba(226,232,240,0.85);
            }
        }
        nav {
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            margin-top: 2.25rem;
        }
        a {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            padding: 0.65rem 0.95rem;
            border-radius: 999px;
            font-weight: 600;
            text-decoration: none;
            color: #1d4ed8;
            background: rgba(37,99,235,0.12);
            border: 1px solid rgba(37,99,235,0.18);
            transition: transform 120ms ease, box-shadow 120ms ease;
        }
        a:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 24px -18px rgba(37,99,235,0.45);
        }
        @media (prefers-color-scheme: dark) {
            a {
                color: #93c5fd;
                background: rgba(59,130,246,0.16);
                border: 1px solid rgba(147,197,253,0.22);
            }
        }
        small {
            display: block;
            margin-top: 2rem;
            font-size: 0.875rem;
            color: rgba(15,23,42,0.56);
        }
        @media (prefers-color-scheme: dark) {
            small {
                color: rgba(203,213,225,0.7);
            }
        }
    </style>
</head>
<body>
    <main>
        <h1>OpenPoke API</h1>
        <p>Orchestrating AI agents for email triage, reminders, and persistent task delegation. Point your client to the endpoints below to get started.</p>
        <nav>
            <a href="/api/v1/health">GET&nbsp;/api/v1/health</a>
            <a href="/api/v1/meta">GET&nbsp;/api/v1/meta</a>
            <a href="/api/v1/chat">POST&nbsp;/api/v1/chat</a>
            <a href="/api/v1/gmail/accounts">GET&nbsp;/api/v1/gmail/accounts</a>
            <a href="/api/v1/gmail/connect">POST&nbsp;/api/v1/gmail/connect</a>
        </nav>
        <small>Run locally with <code>uv run pnpm run dev</code> to start both the web and API services.</small>
    </main>
</body>
</html>
"""


FAVICON_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9c"
    b"c\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


@app.get("/", response_class=HTMLResponse)
async def root() -> HTMLResponse:
    """Default landing page for the OpenPoke API."""
    return HTMLResponse(ROOT_PAGE)


@app.get("/favicon.ico")
async def favicon() -> Response:
    """Return a simple favicon to prevent 404 errors."""
    return Response(content=FAVICON_BYTES, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/health")
async def health() -> dict[str, str]:
    """Simple health check endpoint for load balancers and monitoring."""
    return {"status": "ok"}


__all__ = ["app"]
