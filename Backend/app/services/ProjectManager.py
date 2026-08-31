# app.services.ProjectManager
import redis.asyncio as redis
from datetime import timedelta, datetime, timezone
from app.config import _REDIS_URL, SESSION_DURATION
from app.schemas.project import Project
from app.schemas.knowledge_base import KnowledgeBaseEntry
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

    async def save(self, session_id: str, project: Project) -> Project | None:
        """Persist changes to an exisiting project and refresh its TTL."""
        existing = await self.get(session_id, project.project_id)

        if existing is None:
            return None

        await self._redis.set(
            self._key(session_id, project.project_id),
            project.model_dump_json(),
            ex-int(self._duration.total_seconds()),
        )

        return project

    async def set_knowledge_base(self, session_id: str, project_id: str, formulas: list) -> Project | None:
        project = await self.get(session_id, project_id)

        if project is None:
            return None

        project.knowledge_base = formulas
        project.status = 'draft'

        return await self.save(session_id, project)

    async def clear_knowledge_base(self, session_id: str, project_id: str) -> Project | None:
        return await self.set_knowledge_base(session_id, project_id, [])

    async def set_goal(self, session_id: str, project_id: str, goal) -> Project | None:
        project = await self.get(session_id, project_id)

        if project is None: return None

        project.goal = goal
        project.status = 'draft'

        return await self.save(session_id, project)

    async def set_cnf_result(self, session_id: str, project_id: str, clauses: list, steps: list[dict[str, str | int]]) -> Project | None:
        project = await self.get(session_id, project_id)

        if project is None: return None

        project.cnf_kb = clauses
        project.cnf_steps = steps
        project.status = 'cnf-complete'

        return await self.save(session_id, project)

    """Named, saved knowledge bases"""
    async def save_knowledge_entry(self, session_id: str, project_id: str, entry: KnowledgeBaseEntry) -> Project | None:
        project = await self.get(session_id, project_id)

        if project is None: return None

        project.knowledge_base.append(entry)
        project.knowledge_base = entry.formulas
        project.status = 'draft'

        return await self.save(session_id, project)

    async def list_knowledge_base_entries(self, session_id: str, project_id: str) -> list[KnowledgeBaseEntry] | None:
        project = await self.get(session_id, project)

        if project is None: return None

        return project.knowledge_bases

    async def get_knowledge_base_entry(self, session_id: str, project_id: str, kb_id: str) -> KnowledgeBaseEntry | None:
        project = await self.get(session_id, project_id)

        if project is None: return None

        return next((entry for entry in project.knowledge_bases if entry.id == kb_id), None)

    async def activate_knowledge_base_entry(self, session_id: str, project_id: str, kb_id: str) -> Project | None:
        project = await self.get(session_id, project_id)

        if project is None: return None

        entry = next((entry for entry in project.knowledge_bases if entry.id == kb_id), None)
        if entry is None: return None

        project.knowledge_base = entry.formulas
        project.status = 'draft'

        return await self.save(session_id, project)
    
    async def delete_knowledge_base_entry(self, session_id: str, project_id: str, kb_id: str) -> Project | None:
        """Load a previously saved named KB back into the project's active working set."""
        project = await self.get(session_id, project_id)

        if project is None: return None

        remaining = [entry for entry in project.knowledge_bases if entry.id != kb_id]

        if len(remaining) == len(project.knowledge_bases):
            return None

        project.knowledge_bases = remaining

        return await self.save(session_id, project)

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

    async def import_project(self, session_id: str, raw_json: str, overwrite: bool = False) -> Project | None:
        """Import a project fron its JSON representation."""
        project = Project.model_validate_json(raw_json)

        if not overwrite:
            existing_project = await self.get(session_id, project.project_id)

            if existing_project is not None:
                raise FileExistsError(project.project_id)

        return await self.create(session_id, project)

    async def export_project(self, session_id: str, project_id: str) -> str | None:
        """Return a project's JSON representation, or None"""
        project = await self.get(session_id, project_id)

        if project is None: return None

        return project.model_dump_json(indent=2)    

    async def refresh_all(self, session_id: str, project_ids: list[str]) -> None:
        if not project_ids:
            return None
        ttl = int(self._duration.total_seconds())

        async with self._redis.pipeline() as pipe:
            for project_id in project_ids:
                pipe.expire(self._key(session_id, project_id), ttl)

            await pipe.execute()

project_manager = ProjectManager()