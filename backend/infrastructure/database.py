"""
Database Configuration with SQLAlchemy

Sets up the ORM, session factory, and database connection
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Database URL - can be SQLite, PostgreSQL, MySQL, etc.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./mixread.db"  # Default to SQLite for development
)

# Create engine
engine = create_engine(
    DATABASE_URL,
    echo=False,  # Set to True for SQL logging
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
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
    """Initialize database - create all tables"""
    Base.metadata.create_all(bind=engine)
