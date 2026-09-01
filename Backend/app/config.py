# stores the src/config
from pathlib import Path
from datetime import timedelta
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    session_secret: str
    redis_url: str

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / '.env',
        env_file_encoding='utf-8',
        extra='ignore'
    )

settings = Settings()

SESSION_SECRET = settings.session_secret
_REDIS_URL = settings.redis_url

FRONTEND_URLS = [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://192.168.232.157:5173'
]

SESSION_DURATION = timedelta(minutes=20)
SESSION_COOKIE_NAME = 'resviz_session'

