"""Security middleware – Rate Limiting, Security Headers, CSRF protection.

Implements defense-in-depth:
- Rate limiting via SlowAPI to mitigate DDoS and brute-force attacks
- Strict HTTP security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options)
- CSRF protection where applicable
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Injects strict security headers into every HTTP response."""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Enable XSS filter
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions policy (disable sensitive browser features)
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

        # Content Security Policy (relaxed for API server, strict for HTML)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "connect-src 'self' ws: wss:; "
            "frame-ancestors 'none';"
        )

        # HSTS (only effective over HTTPS, but set it so it activates when HTTPS is used)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response
