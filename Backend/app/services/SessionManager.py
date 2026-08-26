import hashlib
import secrets
import redis.asyncio as redis
from datetime import timedelta, datetime
from app.config import SESSION_DURATION, _REDIS_URL
from app.schemas.session import SessionResponse

class SessionManager:
    def __init__(self, redis_url: str = _REDIS_URL, duration: timedelta = SESSION_DURATION):
        self._redis = redis.from_url(redis_url, decode_responses=True)      # Return strings instead of bytes
        self._duration = duration   # A session expires after this amount of inactivity.

    def _key(self, browser_id: str, tab_id: str) -> str:
        """Create the Redis key used to store a session."""
        identity = f"{browser_id}:{tab_id}".encode()
        digest = hashlib.sha256(identity).hexdigest()

        return f"tab-session:{digest}"

    async def get(self, browser_id: str, tab_id: str, now: datetime) -> SessionResponse | None:
        """
        Retrieve a session and reset its inactivity timeout |
        Creates a session if none exists.
        GETEX gets the value and refreshes its Redis TTL in one operation.
        If the key has already expired, Redis returns None.
        SETEX sets the the value while supporting an EX option directly.
        """
        key = self._key(browser_id, tab_id)
        ttl_seconds = int(self._duration.total_seconds())

        raw_session = await self._redis.getex(key, ex=ttl_seconds)
        if raw_session:
            return SessionResponse.model_validate_json(raw_session)

        session = SessionResponse(
            session_id=secrets.token_urlsafe(32),
            active_project_id=None,
            project_ids=[],
            created_at=now,
            expires_at=now + self._duration
        )

        await self._redis.setex(key, ttl_seconds, session.model_dump_json())
        return session

    async def save(self, session: SessionResponse) -> None:
        """
        Save session changes and reset the inactivity timeout.
        Use this after changing active_project_id or project_ids.
        """
        await self._redis.set(
            self._key(session.session_id),
            session.model_dump_json(),
            ex=int(self._duration.total_seconds())
        )

    async def delete(self, session_id: str) -> bool:
        """
        Permanently remove a session from Redis
        """
        deleted_count = await self._redis.delete(self._key(session_id))
        return deleted_count > 0        # Returns true if at least one session was True

session_manager = SessionManager()