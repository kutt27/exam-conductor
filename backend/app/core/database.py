import ssl
from urllib.parse import urlparse, parse_qs, urlunparse
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from app.core.config import settings

db_url = settings.DATABASE_URL
connect_args = {}

if db_url.startswith("sqlite:///"):
    db_url = db_url.replace("sqlite:///", "sqlite+aiosqlite:///")
elif db_url.startswith("postgresql://") or db_url.startswith("postgres://") or db_url.startswith("postgresql+asyncpg://"):
    parsed = urlparse(db_url)
    qs = parse_qs(parsed.query)
    
    # Check if SSL is required
    requires_ssl = False
    if "sslmode" in qs or "ssl" in qs or "neon.tech" in parsed.netloc or "supabase.co" in parsed.netloc:
        requires_ssl = True

    # Strip query parameters that asyncpg doesn't accept as URL query params
    filtered_params = {k: v for k, v in qs.items() if k not in ["sslmode", "channel_binding", "ssl"]}
    
    # Rebuild clean asyncpg URL
    scheme = "postgresql+asyncpg"
    clean_query = "&".join([f"{k}={v[0]}" for k, v in filtered_params.items()])
    clean_url = urlunparse((
        scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        clean_query,
        parsed.fragment
    ))
    db_url = clean_url

    connect_args = {
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0
    }
    if requires_ssl:
        connect_args["ssl"] = "require"

engine = create_async_engine(
    db_url,
    echo=False,
    future=True,
    pool_pre_ping=True,
    poolclass=NullPool,
    connect_args=connect_args
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
