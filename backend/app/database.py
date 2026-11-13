from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

if "sqlite" in settings.DATABASE_URL:
    engine = create_async_engine(settings.DATABASE_URL, echo=False, future=True, connect_args={"check_same_thread": False})
else:
    engine = create_async_engine(settings.DATABASE_URL, echo=False, future=True, pool_size=50, max_overflow=100)

async_session_maker = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db():
    """Async generator yielding an AsyncSession for dependency injection."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables if they don't exist."""
    async with engine.begin() as conn:
        from app.models import User, Document, Activity, Organization, Team, Role, AuditLog, Investigation, Hypothesis, ExtractionRule, KnowledgeEvolution, DomainSubscription, Settings
        from app.models.intelligence import DigitalTwin, Scenario, Simulation, Forecast, RiskAssessment, Strategy
        from app.models.multi_tenant import DataRoom, RoomMembership, InviteCode, RoomGroup, RoomGroupMember

        await conn.run_sync(Base.metadata.create_all)
