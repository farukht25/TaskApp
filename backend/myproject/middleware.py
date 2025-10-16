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
        # Do not interfere with explicit Authorization headers
        if request.META.get("HTTP_AUTHORIZATION"):
            return None

        # Skip auth endpoints (login/register/refresh)
        path = request.path or ""
        if path.startswith(self.SKIP_PREFIXES):
            return None

        token = request.COOKIES.get("access")
        if not token:
            return None

        # Only inject if token parses successfully (avoids raising in AllowAny views)
        if AccessToken is not None:
            try:
                AccessToken(token)  
            except Exception:
                return None

        request.META["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        return None
