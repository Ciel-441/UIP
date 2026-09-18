"""Unified Intelligence Platform – FastAPI Application."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db
from app.neo4j_driver import init_neo4j, close_neo4j
from app.middleware.security import SecurityHeadersMiddleware

# ── Rate Limiting ────────────────────────────────────────────
from app.utils.rate_limit import limiter, RATE_LIMITING_AVAILABLE
try:
    from slowapi.errors import RateLimitExceeded
    from slowapi import _rate_limit_exceeded_handler
except ImportError:
    pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown events."""
    # Create upload directory
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # Initialize databases
    await init_db()
    
    # Seed AI User for Team Chat Personas
    from app.database import async_session_maker
    from app.models.user import User
    from app.utils.security import hash_password
    from sqlalchemy import select
    
    async with async_session_maker() as session:
        ai_check = await session.execute(select(User).where(User.email == 'ai@system.local'))
        if not ai_check.scalars().first():
            ai_user = User(
                email='ai@system.local',
                name='System AI',
                hashed_password=hash_password('system_ai_password_not_used')
            )
            session.add(ai_user)
            await session.commit()

    try:
        init_neo4j()
    except Exception as e:
        print(f"Warning: Neo4j init failed (will retry on first request): {e}")

    # Start Continuous Discovery Engine heartbeat
    from app.services.discovery_engine import continuous_discovery_heartbeat
    import asyncio
    discovery_task = asyncio.create_task(continuous_discovery_heartbeat())

    yield

    # Shutdown
    discovery_task.cancel()
    close_neo4j()


app = FastAPI(
    title="Unified Intelligence Platform",
    description="Knowledge graph + document intelligence API",
    version="0.3.0",
    lifespan=lifespan,
    redirect_slashes=False,
)

# ── Rate Limiting Setup ──────────────────────────────────────
if RATE_LIMITING_AVAILABLE:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Security Headers Middleware ──────────────────────────────
app.add_middleware(SecurityHeadersMiddleware)

# ── CORS ─────────────────────────────────────────────────────
# Parse allowed origins from config (comma-separated)
allowed_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Room-Id"],
)

# ── Routers ──────────────────────────────────────────────────
from app.routers import (
    auth,
    entities,
    relationships,
    documents,
    search,
    ai,
    dashboard,
    analytics,
    reports,
    settings as settings_router,
    communication,
    investigations,
    feed,
    extraction_rules,
    digital_twins,
    predictive_analytics,
    rooms,
)
from app.routers.profile import router as profile_router

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(rooms.router, prefix="/api/rooms", tags=["Rooms"])
app.include_router(entities.router, prefix="/api/entities", tags=["Entities"])
app.include_router(relationships.router, prefix="/api/relationships", tags=["Relationships"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(search.router, prefix="/api/search", tags=["Search"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["Settings"])
app.include_router(profile_router, prefix="/api/profile", tags=["Profile"])
app.include_router(communication.router, prefix="/api/communication", tags=["Communication"])
app.include_router(investigations.router, prefix="/api/investigations", tags=["Investigations"])
app.include_router(feed.router, prefix="/api/feed", tags=["Feed"])
app.include_router(extraction_rules.router, prefix="/api/extraction-rules", tags=["Extraction Rules"])
app.include_router(digital_twins.router, prefix="/api/digital-twins", tags=["Digital Twins"])
app.include_router(predictive_analytics.router, prefix="/api/predictive", tags=["Predictive Analytics"])


# ── Health ───────────────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
async def health_check():
    """Basic health check returning database connectivity status."""
    from app.database import async_session_maker
    from app.neo4j_driver import get_neo4j_driver
    from sqlalchemy import text

    pg_ok = False
    neo4j_ok = False

    try:
        async with async_session_maker() as session:
            await session.execute(text("SELECT 1"))
            pg_ok = True
    except Exception:
        pass

    try:
        driver = get_neo4j_driver()
        if driver:
            with driver.session() as s:
                s.run("RETURN 1")
            neo4j_ok = True
    except Exception:
        pass

    return {"status": "ok", "postgres": pg_ok, "neo4j": neo4j_ok}
