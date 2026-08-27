import hashlib
import hmac
import redis.asyncio as redis
from datetime import timedelta, datetime
from app.config import SESSION_DURATION, _REDIS_URL, SESSION_SECRET
from app.schemas.session import SessionResponse

class SessionManager:
    def __init__(self, redis_url: str = _REDIS_URL, duration: timedelta = SESSION_DURATION):
        self._redis = redis.from_url(redis_url, decode_responses=True)      # Return strings instead of bytes
        self._duration = duration   # A session expires after this amount of inactivity.

    def _session_id(self, browser_id: str, tab_id: str) -> str:
        identity = f'{browser_id}:{tab_id}'.encode()
        return hmac.new(
            SESSION_SECRET.encode(),
            identity,
            hashlib.sha256,
        ).hexdigest()
    
    def _key(self, session_id) -> str:
        """Create the Redis key used to store a session."""
        return f"session:{session_id}"

    async def get_or_create(self, browser_id: str, tab_id: str, now: datetime) -> SessionResponse | None:
        """
        Retrieve a session and reset its inactivity timeout |
        Creates a session if none exists.
        GETEX gets the value and refreshes its Redis TTL in one operation.
        If the key has already expired, Redis returns None.
        SETEX sets the the value while supporting an EX option directly.
        """
        session_id = self._session_id(browser_id, tab_id)

        session = await self.get(session_id, now)

        if session: return session

        return await self.create(session_id, now)

    async def create(self, session_id: str, now: datetime) -> SessionResponse:
        session = SessionResponse(
            session_id=session_id,
            active_project_id=None,
            project_ids=[],
            created_at=now,
            expires_at=now + self._duration
        )

        await self._redis.set(
            self._key(session_id), 
            session.model_dump_json(),
            ex=int(self._duration.total_seconds())
        )

        return session

    async def get(self, session_id: str, now: datetime) -> SessionResponse | None:
        key = self._key(session_id)
        ttl_seconds = int(self._duration.total_seconds())

        raw_session = await self._redis.getex(key, ex=ttl_seconds)

        if not raw_session:
            return None

        session = SessionResponse.model_validate_json(raw_session)
        session.expires_at = now + self._duration

        await self._redis.set(key, session.model_dump_json(), ex=ttl_seconds)

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