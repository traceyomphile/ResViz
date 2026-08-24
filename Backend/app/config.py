# stores the src/config
import redis.asyncio as redis
from datetime import datetime, timedelta, timezone 

_REDIS = redis.from_url('redis://localhost:6379')
FRONTEND_URL = 'http://localhost:5173'

SESSION_DURATION = timedelta(minutes=20)
SESSION_COOKIE_NAME = 'resviz_session'

