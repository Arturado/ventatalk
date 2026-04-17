"""
Rate limiting middleware usando Redis.

Protege el webhook de abuso y a los endpoints de la API de brute force.
"""

import time
from typing import Optional

import redis.asyncio as aioredis
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings

settings = get_settings()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting por IP con ventana deslizante usando Redis.

    Límites por defecto:
      - /webhook:          300 req/min (Meta puede enviar en ráfagas)
      - /api/v1/auth/*:    10 req/min  (anti brute-force)
      - Todo lo demás:     120 req/min
    """

    LIMITS = {
        "/webhook":       (300, 60),
        "/api/v1/auth":   (10, 60),
        "default":        (120, 60),
    }

    def __init__(self, app, redis_url: Optional[str] = None):
        super().__init__(app)
        self._redis_url = redis_url or settings.REDIS_URL
        self._redis: Optional[aioredis.Redis] = None

    async def _get_redis(self) -> aioredis.Redis:
        if not self._redis:
            self._redis = await aioredis.from_url(self._redis_url, decode_responses=True)
        return self._redis

    def _get_limit(self, path: str) -> tuple[int, int]:
        for prefix, limit in self.LIMITS.items():
            if prefix != "default" and path.startswith(prefix):
                return limit
        return self.LIMITS["default"]

    async def dispatch(self, request: Request, call_next) -> Response:
        # En dev/test no aplicar rate limiting
        if settings.APP_ENV in ("development", "testing"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        max_requests, window_seconds = self._get_limit(path)

        key = f"rl:{client_ip}:{path.split('/')[1]}"

        try:
            redis = await self._get_redis()
            now = time.time()
            pipe = redis.pipeline()
            pipe.zremrangebyscore(key, 0, now - window_seconds)
            pipe.zcard(key)
            pipe.zadd(key, {str(now): now})
            pipe.expire(key, window_seconds * 2)
            results = await pipe.execute()
            request_count = results[1]

            if request_count >= max_requests:
                return Response(
                    content='{"detail":"Rate limit excedido. Intenta en un momento."}',
                    status_code=429,
                    headers={
                        "Content-Type": "application/json",
                        "Retry-After": str(window_seconds),
                        "X-RateLimit-Limit": str(max_requests),
                        "X-RateLimit-Remaining": "0",
                    },
                )
        except Exception:
            # Si Redis no está disponible, dejar pasar (fail open)
            pass

        response = await call_next(request)
        return response
