"""Oracle database connection pool and dependency injection."""
import oracledb
from typing import Generator
from contextlib import contextmanager
from .config import get_settings

settings = get_settings()

pool = None

def init_pool():
    global pool
    if pool is None:
        pool = oracledb.create_pool(
            user=settings.db_user,
            password=settings.db_password,
            dsn=settings.db_dsn,
            min=2,
            max=10,
            increment=1,
        )
    return pool

@contextmanager
def get_db() -> Generator[oracledb.Connection, None, None]:
    """Yield a connection from the pool."""
    p = init_pool()
    conn = p.acquire()
    try:
        yield conn
    finally:
        conn.close()

def get_db_dependency() -> Generator[oracledb.Connection, None, None]:
    """FastAPI dependency version."""
    with get_db() as conn:
        yield conn