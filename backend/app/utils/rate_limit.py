"""Rate limiting utility using slowapi."""

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address

    limiter = Limiter(key_func=get_remote_address)
    RATE_LIMITING_AVAILABLE = True
except ImportError:
    # Fallback if slowapi is not installed (should not happen since we installed it)
    class DummyLimiter:
        def limit(self, limit_value):
            def decorator(func):
                return func
            return decorator

    limiter = DummyLimiter()
    RATE_LIMITING_AVAILABLE = False
