import logging
import time
from django.utils.deprecation import MiddlewareMixin

try:
    from rest_framework_simplejwt.tokens import AccessToken
except Exception:  # pragma: no cover
    AccessToken = None


class JWTAuthCookieMiddleware(MiddlewareMixin):
    """Inject Authorization from the 'access' cookie when appropriate.

    - Skips auth endpoints to avoid 401s from expired/invalid cookies on AllowAny views
    - Validates the cookie token format before injecting; if invalid/expired, do not inject
    """

    SKIP_PREFIXES = ("/auth/",)

    def process_request(self, request):
        logger = logging.getLogger("myproject.auth")
        # Do not interfere with explicit Authorization headers
        if request.META.get("HTTP_AUTHORIZATION"):
            logger.debug("Auth header present; skipping cookie injection path=%s", getattr(request, 'path', ''))
            return None

        # Skip auth endpoints (login/register/refresh)
        path = request.path or ""
        if path.startswith(self.SKIP_PREFIXES):
            logger.debug("Skipping JWT cookie injection for path=%s", path)
            return None

        token = request.COOKIES.get("access")
        if not token:
            logger.debug("No access cookie present for path=%s", path)
            return None

        # Only inject if token parses successfully (avoids raising in AllowAny views)
        if AccessToken is not None:
            try:
                AccessToken(token)  
            except Exception as exc:
                logger.info("Invalid access cookie; not injecting Authorization path=%s err=%s", path, exc.__class__.__name__)
                return None

        request.META["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        logger.debug("Injected Authorization from access cookie for path=%s", path)
        return None


class AccessLogMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request._access_log_start = time.time()
        request._has_access_cookie = bool(request.COOKIES.get("access"))
        request._has_refresh_cookie = bool(request.COOKIES.get("refresh"))

    def process_response(self, request, response):
        try:
            duration_ms = int((time.time() - getattr(request, "_access_log_start", time.time())) * 1000)
            logger = logging.getLogger("myproject.access")
            logger.info(
                "method=%s path=%s status=%s dur_ms=%s user=%s has_access=%s has_refresh=%s",
                getattr(request, 'method', ''),
                getattr(request, 'path', ''),
                getattr(response, 'status_code', ''),
                duration_ms,
                getattr(getattr(request, 'user', None), 'id', None),
                getattr(request, '_has_access_cookie', False),
                getattr(request, '_has_refresh_cookie', False),
            )
        except Exception:
            pass
        return response
