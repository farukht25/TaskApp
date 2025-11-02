import logging
import time
from functools import wraps
from typing import Callable, Optional

from django.core.cache import cache
from rest_framework.response import Response


def log_api(name: Optional[str] = None, level: int = logging.INFO) -> Callable:
    """Lightweight logging decorator for function-based DRF views.

    - Logs start and completion with duration and status code
    - Includes method, path, and user id (if available)
    - Avoids logging request bodies to keep logs safe
    """

    logger = logging.getLogger("myapp.api")

    def decorator(view_func: Callable) -> Callable:
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            label = name or getattr(view_func, "__name__", "view")
            user_id = getattr(getattr(request, "user", None), "id", None)
            method = getattr(request, "method", "")
            path = getattr(request, "path", "")
            start = time.time()
            logger.log(level, "start label=%s method=%s path=%s user=%s", label, method, path, user_id)
            try:
                resp = view_func(request, *args, **kwargs)
                status_code = getattr(resp, "status_code", "?")
                dur_ms = int((time.time() - start) * 1000)
                logger.log(level, "done label=%s status=%s dur_ms=%s user=%s", label, status_code, dur_ms, user_id)
                return resp
            except Exception as exc:
                dur_ms = int((time.time() - start) * 1000)
                logger.exception("error label=%s dur_ms=%s user=%s err=%s", label, dur_ms, user_id, exc.__class__.__name__)
                raise

        return wrapper

    return decorator


def cache_response(seconds: int, key_prefix: Optional[str] = None, vary_by_user: bool = False) -> Callable:
    """Cache GET responses for a short time.

    - Only caches GET requests.
    - Keyed by prefix + optional user id.
    - Stores/returns DRF Response with cached .data
    """

    def decorator(view_func: Callable) -> Callable:
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if getattr(request, "method", "GET").upper() != "GET":
                return view_func(request, *args, **kwargs)

            parts = [key_prefix or getattr(view_func, "__name__", "view")]
            if vary_by_user:
                user_id = getattr(getattr(request, "user", None), "id", None)
                parts.append(str(user_id))
            cache_key = ":".join(parts)

            cached = cache.get(cache_key)
            if cached is not None:
                return Response(cached)

            resp = view_func(request, *args, **kwargs)
            try:
                data = getattr(resp, "data", None)
                if data is not None:
                    cache.set(cache_key, data, seconds)
            except Exception:
                pass
            return resp

        return wrapper

    return decorator

