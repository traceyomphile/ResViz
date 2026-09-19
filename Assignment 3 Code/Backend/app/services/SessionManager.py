import hashlib
import hmac
import redis.asyncio as redis
from datetime import timedelta, datetime, timezone
from app.config import MAX_ACTIVE_SESSIONS_PER_BROWSER, SESSION_DURATION, _REDIS_URL, SESSION_SECRET
from app.schemas.session import SessionResponse

class SessionLimitExceededError(Exception):
    """Raised when one browser already has the maximum number of live sessions."""
class SessionManager:
    def __init__(self, redis_url: str = _REDIS_URL, duration: timedelta = SESSION_DURATION, max_active_sessions_per_browser: int = MAX_ACTIVE_SESSIONS_PER_BROWSER):
        self._redis = redis.from_url(redis_url, decode_responses=True)      # Return strings instead of bytes
        self._duration = duration   # A session expires after this amount of inactivity.
        self._max_active_sessions_per_browser = max_active_sessions_per_browser

    def _session_id(self, browser_id: str, tab_id: str) -> str:
        """Creates a deterministic session id for one browser tab."""
        value=f"{browser_id}:{tab_id}"

        return hmac.new(
            SESSION_SECRET.encode(),
            value.encode(),
            hashlib.sha256,
        ).hexdigest()

    def _browser_id_hash(self, browser_id: str) -> str:
        """Hash the browser id before using it in Redis key names."""
        return hmac.new(
            SESSION_SECRET.encode(),
            browser_id.encode(),
            hashlib.sha256,
        ).hexdigest()
    
    def _key(self, session_id) -> str:
        """Create the Redis key used to store a session."""
        return f"session:{session_id}"

    def _owner_key(self, session_id: str) -> str:
        """Maps a session back to the browser-session index that owns it."""
        return f"session-owner:{session_id}"

    def _browser_session_key(self, browser_id: str) -> str:
        browser_hash = self._browser_id_hash(browser_id)
        return f"browser-sessions:{browser_hash}"

    def _ttl_seconds(self) -> int:
        return int(self._duration.total_seconds())

    def session_id_for(self, browser_id: str, tab_id: str) -> str:
        return self._session_id(browser_id, tab_id)

    async def get_or_create(self, browser_id: str, tab_id: str, now: datetime) -> SessionResponse:
        """
        Restore the session belonging to this browser/tab pair.
        If no session exists, create one only when this browser is still below
        its active-session limit.
        """
        if not browser_id:
            raise ValueError("browser_id must not be empty")

        if not tab_id:
            raise ValueError("tab_id must not be empty")
        
        session_id = self._session_id(browser_id, tab_id)

        session = await self.get(session_id, now)
        if session: return session

        return await self.create(browser_id, session_id, now)

    async def create(self, browser_id: str, session_id: str, now: datetime) -> SessionResponse:
        """
        Create a session while atomically enforcing the per-browser limit.
        The browser's sessions are stored in a sorted set. The score is the 
        session expiry timestamp, so expired sesssions can be removed cheaply
        beofre counting how many active sessions remain.
        """
        ttl_seconds = self._ttl_seconds()
        expires_at = now + self._duration
        expires_epoch = expires_at.timestamp()
        now_epoch = now.timestamp()

        session = SessionResponse(
            session_id=session_id,
            active_project_id=None,
            project_ids=[],
            created_at=now,
            expires_at=expires_at
        )

        session_key = self._key(session_id)
        owner_key = self._owner_key(session_id)
        browser_session_key = self._browser_session_key(browser_id)

        # Two tabs created at the same instant do not both pass
        create_script = """
        redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', ARGV[1])

        if redis.call('EXISTS', KEYS[1]) == 1 then
            return 2
        end

        local active_count = redis.call('ZCARD', KEYS[3])
        if active_count >= tonumber(ARGV[3]) then
            return 0
        end

        redis.call('SET', KEYS[1], ARGV[5], 'EX', ARGV[4])
        redis.call('SET', KEYS[2], KEYS[3], 'EX', ARGV[4])
        redis.call('ZADD', KEYS[3], ARGV[2], ARGV[6])
        redis.call('EXPIRE', KEYS[3], ARGV[4])

        return 1
        """

        result = await self._redis.eval(
            create_script,
            3,
            session_key,
            owner_key,
            browser_session_key,
            now_epoch,
            expires_epoch,
            self._max_active_sessions_per_browser,
            ttl_seconds,
            session.model_dump_json(),
            session_id,
        )

        if result == 0:
            raise SessionLimitExceededError(
                f"Maximum of {self._max_active_sessions_per_browser} "
                "active sessions reached for this browser."
            )

        if result == 2:
            existing = await self.get(session_id, now)
            if existing is not None:
                return existing

        return session

    async def get(self, session_id: str, now: datetime) -> SessionResponse | None:
        key = self._key(session_id)
        owner_key = self._owner_key(session_id)
        ttl_seconds = self._ttl_seconds()

        raw_session = await self._redis.get(key)
        if not raw_session:
            return None

        session = SessionResponse.model_validate_json(raw_session)
        session.expires_at = now + self._duration

        browser_session_key = await self._redis.get(owner_key)

        pipeline = self._redis.pipeline(transaction=True)
        pipeline.set(key, session.model_dump_json(), ex=ttl_seconds)

        if browser_session_key:
            pipeline.set(owner_key, browser_session_key, ex=ttl_seconds)
            pipeline.zadd(
                browser_session_key, {session_id: session.expires_at.timestamp()},
            )
            pipeline.expire(browser_session_key, ttl_seconds)

        await pipeline.execute()
        return session

    async def save(self, session: SessionResponse) -> None:
        """
        Save session changes and reset the inactivity timeout.
        Use this after changing active_project_id or project_ids.
        """
        ttl_seconds = self._ttl_seconds()
        session.expires_at = datetime.now(timezone.utc) + self._duration

        key = self._key(session.session_id)
        owner_key = self._owner_key(session.session_id)
        browser_session_key = await self._redis.get(owner_key)

        pipeline = self._redis.pipeline(transaction=True)
        pipeline.set(key, session.model_dump_json(), ex=ttl_seconds)

        if browser_session_key:
            pipeline.set(owner_key, browser_session_key, ex=ttl_seconds)
            pipeline.zadd(
                browser_session_key,
                {session.session_id: session.expires_at.timestamp()},
            )
            pipeline.expire(browser_session_key, ttl_seconds)

        await pipeline.execute()

    async def delete(self, session_id: str) -> bool:
        """
        Permanently remove a session and its browser-index entry from Redis
        """
        key = self._key(session_id)
        owner_key = self._owner_key(session_id)
        browser_session_key = await self._redis.get(owner_key)

        pipeline = self._redis.pipeline(transaction=True)
        pipeline.delete(key)
        pipeline.delete(owner_key)

        if browser_session_key:
            pipeline.zrem(browser_session_key, session_id)

        results = await pipeline.execute()
        return bool(results[0])
    
session_manager = SessionManager()