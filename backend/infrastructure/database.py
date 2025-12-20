"""
Database Configuration with SQLAlchemy

Sets up the ORM, session factory, and database connection
"""

import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

# Database URL - can be SQLite, PostgreSQL, MySQL, etc.
if os.getenv("DATABASE_URL"):
    DATABASE_URL = os.getenv("DATABASE_URL")
else:
    # Default to mixread.db in the backend directory (parent of infrastructure)
    # This ensures it works regardless of where the app is run from
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "mixread.db")
    DATABASE_URL = f"sqlite:///{db_path}"

# Create engine with SQLite-specific optimizations
if "sqlite" in DATABASE_URL:
    # SQLite optimizations for concurrent access
    connect_args = {
        "check_same_thread": False,
        "timeout": 30.0,  # 30 second timeout for locks
    }
else:
    connect_args = {}

engine = create_engine(
    DATABASE_URL,
    echo=False,  # Set to True for SQL logging
    connect_args=connect_args,
    pool_pre_ping=True,  # Test connections before using them
    pool_recycle=3600,   # Recycle connections after 1 hour
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class for ORM models
Base = declarative_base()


def get_db():
    """
    Dependency injection function for FastAPI
    Yields a database session for each request
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database - create all tables and apply optimizations"""
    # Apply SQLite optimizations
    if "sqlite" in DATABASE_URL:
        with engine.connect() as conn:
            # Enable optimizations for SQLite
            conn.execute(text("PRAGMA journal_mode=WAL"))  # Write-Ahead Logging for better concurrency
            conn.execute(text("PRAGMA synchronous=NORMAL"))  # Balance between safety and performance
            conn.execute(text("PRAGMA cache_size=10000"))  # Increase cache
            conn.execute(text("PRAGMA temp_store=MEMORY"))  # Use memory for temp storage
            conn.commit()

    Base.metadata.create_all(bind=engine)
