"""Rate limiting middleware using Upstash Redis."""

from __future__ import annotations

from typing import Any, Awaitable, Callable

from config import get_settings
from fastapi import FastAPI, Request, Response, status
from fastapi.responses import JSONResponse
from logging_config import logger
from starlette.middleware.base import BaseHTTPMiddleware
from upstash_ratelimit import FixedWindow, Ratelimit
from upstash_redis import Redis


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware to enforce rate limiting on all endpoints using Upstash Redis."""

    def __init__(self, app: FastAPI, redis_url: str | None, redis_token: str | None) -> None:
        super().__init__(app)
        self.ratelimit: Ratelimit | None = None

        if redis_url and redis_token:
            try:
                redis = Redis(url=redis_url, token=redis_token)
                self.ratelimit = Ratelimit(
                    redis=redis,
                    limiter=FixedWindow(max_requests=10, window=10),  # 10 requests per 10 seconds
                    prefix="@openpoke/ratelimit",
                )
                logger.info("Rate limiting initialized with Upstash Redis")
            except Exception as e:
                logger.warning(f"Failed to initialize rate limiting: {e}")
                self.ratelimit = None
        else:
            logger.warning("Rate limiting disabled: Upstash Redis credentials not configured")

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        """Apply rate limiting to all requests based on client IP."""
        if self.ratelimit is None:
            # Rate limiting not configured, pass through
            response: Response = await call_next(request)
            return response

        # Extract client IP from request (handle Railway proxy headers)
        client_ip = self._get_client_ip(request)

        try:
            # Check rate limit
            response = self.ratelimit.limit(client_ip)

            if not response.allowed:
                logger.debug(f"Rate limit exceeded for IP: {client_ip}")
                return JSONResponse(
                    {"ok": False, "error": "Rate limit exceeded. Please try again later."},
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                )

            # Request is allowed, proceed
            response_obj: Response = await call_next(request)
            return response_obj

        except Exception as e:
            # If rate limiting fails, log error but allow request through
            logger.error(f"Rate limiting error: {e}", exc_info=True)
            fallback_response: Response = await call_next(request)
            return fallback_response

    def _get_client_ip(self, request: Request) -> str:
        """
        Extract client IP address from request headers.

        Priority order for Railway and other proxies:
        1. X-Forwarded-For (first IP in the list)
        2. X-Real-IP
        3. Direct client host
        """
        # Check X-Forwarded-For header (Railway uses this)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP in the comma-separated list
            return forwarded_for.split(",")[0].strip()

        # Check X-Real-IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()

        # Fall back to direct client host
        if request.client:
            return request.client.host

        # Ultimate fallback
        return "unknown"


def rate_limit_middleware(app: FastAPI, settings: Any = None) -> RateLimitMiddleware:
    """Factory function to create and attach rate limiting middleware."""
    if settings is None:
        settings = get_settings()

    return RateLimitMiddleware(
        app,
        redis_url=settings.upstash_redis_rest_url,
        redis_token=settings.upstash_redis_rest_token,
    )
