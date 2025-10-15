from django.utils.deprecation import MiddlewareMixin


class JWTAuthCookieMiddleware(MiddlewareMixin):
    """If no Authorization header is present, but an 'access' cookie exists,
    inject an Authorization: Bearer <token> header so DRF SimpleJWT can authenticate.
    """

    def process_request(self, request):
        auth = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth:
            access = request.COOKIES.get("access")
            if access:
                request.META["HTTP_AUTHORIZATION"] = f"Bearer {access}"
        return None

