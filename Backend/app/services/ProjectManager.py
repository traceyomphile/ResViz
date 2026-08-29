# app.services.ProjectManager
import redis.asyncio as redis
from datetime import timedelta, datetime, timezone
from app.config import _REDIS_URL, SESSION_DURATION
from app.schemas.project import Project
from app.services.SessionManager import session_manager

class ProjectManager:
    def __init__(self, redis_url: str = _REDIS_URL, duration: timedelta = SESSION_DURATION):
        self._redis = redis.from_url(redis_url, decode_responses=True)
        self._duration = duration

    def _key(self, session_id: str, project_id: str) -> str:
        return f"project:{session_id}:{project_id}"

    async def create(self, session_id: str, project: Project) -> Project | None:
        now = datetime.now(timezone.utc)
        session = await session_manager.get(session_id, now)

        if session is None: return None

        key = self._key(session_id, project.project_id)
        await self._redis.set(
            key,
            project.model_dump_json(),
            ex=int(self._duration.total_seconds()),
        )

        if project.project_id not in session.project_ids:
            session.project_ids.append(project.project_id)

        session.active_project_id = project.project_id
        await session_manager.save(session)
        
        return project

    async def get(self, session_id: str, project_id: str) -> Project | None:
        key = self._key(session_id, project_id)

        raw = await self._redis.getex(key, ex=int(self._duration.total_seconds()))

        if not raw:
            return None

        return Project.model_validate_json(raw)

    async def delete(self, session_id: str, project_id: str) -> bool:
        deleted_count = await self._redis.delete(self._key(session_id, project_id))

        return deleted_count > 0

    async def get_all(self, session_id: str) -> list[Project]:
        now = datetime.now(timezone.utc)
        session = await session_manager.get(session_id, now)

        if session is None: return []

        if not session.project_ids: return []

        projects: list[Project] = []
        for proj_id in session.project_ids:
            proj = await self.get(session_id, proj_id)

            if proj is not None:
                projects.append(proj)

        return projects

    async def refresh_all(self, session_id: str, project_ids: list[str]) -> None:
        if not project_ids:
            return None
        ttl = int(self._duration.total_seconds())

        async with self._redis.pipeline() as pipe:
            for project_id in project_ids:
                pipe.expire(self._key(session_id, project_id), ttl)

            await pipe.execute()

project_manager = ProjectManager()