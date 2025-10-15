"""Database engine and session management."""

from functools import lru_cache
from typing import Generator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from config import get_settings
from logging_config import logger


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    """Get or create SQLAlchemy engine."""
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError("Database not configured. Set DATABASE_HOST, DATABASE_USERNAME, DATABASE_PASSWORD.")
    engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        connect_args={"ssl": {"ssl_mode": "REQUIRED"}},
    )
    logger.info("Database engine created", extra={"host": settings.database_host})
    return engine


def get_db_session() -> Generator[Session, None, None]:
    """Get database session for dependency injection."""
    engine = get_engine()
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def init_db() -> None:
    """Initialize database tables (for testing/development).

    Note: This creates tables, but auth tables (user, session, etc.) are
    managed by Drizzle/Better Auth. Only call this if you need to create
    agent/trigger tables manually.
    """

    get_engine()
    # Don't use create_all - tables already exist from Drizzle migrations
    # Base.metadata.create_all(bind=engine)
    logger.info("Database connection verified")
