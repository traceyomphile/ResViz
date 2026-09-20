# stores the src/config
from pathlib import Path
from datetime import timedelta
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    session_secret: str
    redis_url: str
    frontend_urls: list[str]

    session_duration: timedelta = timedelta(minutes=20)
    max_active_sessions_per_browser: int = 10
    session_cookie_name: str = 'resviz_session'

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / '.env',
        env_file_encoding='utf-8',
        extra='ignore'
    )

settings = Settings()

