from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    DATABASE_URL: str = os.environ.get(
        "DATABASE_URL",
        "sqlite+aiosqlite:///./uip.db",
    )
    NEO4J_URI: str = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USER: str = os.environ.get("NEO4J_USER", "neo4j")
    NEO4J_PASSWORD: str = os.environ.get("NEO4J_PASSWORD", "uip_neo4j_password")
    JWT_SECRET: str = os.environ.get(
        "JWT_SECRET", "uip-secret-key-change-in-production"
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440
    OLLAMA_ENDPOINT: str = os.environ.get(
        "OLLAMA_ENDPOINT", "http://host.docker.internal:11434"
    )
    OLLAMA_MODEL: str = os.environ.get("OLLAMA_MODEL", "qwen3:latest")
    UPLOAD_DIR: str = os.environ.get("UPLOAD_DIR", "/app/uploads")

    # ── Multi-Tenant (Data Room) Settings ─────────────────────
    MAX_DATA_ROOMS_PER_USER: int = int(os.environ.get("MAX_DATA_ROOMS_PER_USER", "2"))
    BOOTSTRAP_ADMIN_EMAIL: str = os.environ.get("BOOTSTRAP_ADMIN_EMAIL", "")

    # ── Rate Limiting ─────────────────────────────────────────
    RATE_LIMIT_LOGIN: str = os.environ.get("RATE_LIMIT_LOGIN", "5/minute")
    RATE_LIMIT_REGISTER: str = os.environ.get("RATE_LIMIT_REGISTER", "5/minute")
    RATE_LIMIT_API: str = os.environ.get("RATE_LIMIT_API", "100/minute")
    RATE_LIMIT_AI: str = os.environ.get("RATE_LIMIT_AI", "20/minute")

    # ── Security Headers ──────────────────────────────────────
    ALLOWED_ORIGINS: str = os.environ.get("ALLOWED_ORIGINS", "*")

    class Config:
        env_file = ".env"


settings = Settings()
