# app.services.ProjectManager
import redis.asyncio as redis
from datetime import timedelta
from app.config import _REDIS_URL, SESSION_DURATION
from app.schemas.project import Project

class ProjectManager:
    def __init__(self, redis_url: str = _REDIS_URL, duration: timedelta = SESSION_DURATION):
        self._redis = redis.from_url(redis_url, decode_responses=True)
        self._duration = duration

    def _key(self, session_id: str, project_id: str) -> str:
        return f"project:{session_id}:{project_id}"

    async def create(self, session_id: str, project: Project) -> Project | None:
        key = self._key(session_id, project.project_id)

        await self._redis.set(
            key,
            project.project_id,
            ex=int(self._duration.total_seconds()),
        )

        return project

    async def get(self, session_id: str, project_id: str) -> Project | None:
        raw = await self._redis.get(self._key(session_id, project_id))

        if not raw:
            return None

        return Project.model_validate_json(raw)

    async def delete(self, session_id: str, project_id: str) -> bool:
        deleted_count = await self._redis.delete(self._key(session_id, project_id))

        return deleted_count > 0

    async def get_all(self, session_id: str) -> list[Project]:
        values = await self._redis.hvals()