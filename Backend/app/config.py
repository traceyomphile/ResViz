# stores the src/config
import redis.asyncio as redis
from datetime import timedelta

_REDIS_URL = 'redis://127.0.0.1:6379'
FRONTEND_URL = 'http://127.0.0.1:5173'

SESSION_DURATION = timedelta(minutes=20)
SESSION_COOKIE_NAME = 'resviz_session'

