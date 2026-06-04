from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://strykd:strykd@localhost:5432/strykd"
    redis_url: str = "redis://localhost:6379"
    anthropic_api_key: str = ""
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id: str = ""
    resend_api_key: str = ""
    resend_from: str = "Strykd <noreply@strykdapp.com>"
    jwt_secret: str = "changeme"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days
    frontend_url: str = "http://localhost:5173"
    base_domain: str = "strykdapp.com"
    cron_secret: str = "changeme-cron-secret"


settings = Settings()
