import secrets
import redis.asyncio as redis
from datetime import timedelta, datetime
from app.config import SESSION_DURATION, _REDIS
from app.schemas.session import SessionResponse

class SessionManager:
    def __init__(self, redis_url: str = _REDIS, duration: timedelta = SESSION_DURATION):
        self._redis = redis.from_url(redis_url, decode_responses=True)      # Return strings instead of bytes
        self._duration = duration   # A session expires after this amount of inactivity.

    def _key(self, session_id: str) -> str:
        """Create the Redis key used to store a session."""
        return f"session:{session_id}"

    async def get(self, session_id: str, now: datetime) -> SessionResponse | None:
        """
        Retrieve a session and reset its inactivity timeout.
        GETEX gets the value and refreshes its Redis TTL in one operation.
        If the key has already expired, Redis returns None.
        """
        raw = await self._redis.getex(self._key(session_id), ex=int(self._duration.total_seconds()))

        return SessionResponse.model_validate_json(raw) if raw else None

    async def create(self, now: datetime) -> SessionResponse:
        session_id = secrets.token_urlsafe(32)
        session = SessionResponse(
            session_id=session_id,
            active_project_id=None,
            project_ids=[],
            created_at=now
        )

        await self._redis.set(
            self._key(session_id),
            session.model_dump_json(),
            ex=int(self._duration.total_seconds()),
        )
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