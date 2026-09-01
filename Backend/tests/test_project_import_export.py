import json
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException, UploadFile

from app.api.routes.project import export_project, import_project
from app.schemas.project import Project
from app.services.ProjectManager import ProjectManager


class ProjectImportExportManagerTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.manager = ProjectManager()
        self.manager.get = AsyncMock()
        self.manager.create = AsyncMock(side_effect=lambda _session, project: project)

    async def test_import_restores_all_project_fields(self):
        raw = json.dumps({
            "project_id": "project-1",
            "name": "Admissions",
            "description": "Demo",
            "knowledge_base": ["A"],
            "knowledge_bases": [],
            "goal": "Q",
            "cnf_kb": ["A"],
            "cnf_steps": [],
            "status": "cnf-complete",
            "resolution_result": "",
        })
        self.manager.get.return_value = None
        project = await self.manager.import_project("session-1", raw)
        self.assertEqual(project.project_id, "project-1")
        self.assertEqual(project.name, "Admissions")
        self.assertEqual(str(project.goal), "Q")
        self.assertEqual(project.cnf_kb, ["A"])

    async def test_duplicate_import_requires_overwrite(self):
        self.manager.get.return_value = Project(project_id="project-1")
        with self.assertRaises(FileExistsError):
            await self.manager.import_project("session-1", '{"project_id":"project-1"}')

    async def test_overwrite_skips_duplicate_rejection(self):
        self.manager.get.return_value = Project(project_id="project-1")
        result = await self.manager.import_project(
            "session-1", '{"project_id":"project-1","name":"Replacement"}', overwrite=True
        )
        self.assertEqual(result.name, "Replacement")

    async def test_export_serialises_existing_project(self):
        self.manager.get.return_value = Project(project_id="project-1", name="Admissions")
        exported = await self.manager.export_project("session-1", "project-1")
        self.assertEqual(json.loads(exported)["name"], "Admissions")

    async def test_export_missing_project_returns_none(self):
        self.manager.get.return_value = None
        self.assertIsNone(await self.manager.export_project("session-1", "missing"))


class ProjectImportExportRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_route_rejects_non_json_extension(self):
        file = UploadFile(filename="project.txt", file=__import__("io").BytesIO(b"{}"))
        with self.assertRaises(HTTPException) as raised:
            await import_project(file, session_id="session-1")
        self.assertEqual(raised.exception.status_code, 415)

    async def test_route_rejects_invalid_project_schema(self):
        file = UploadFile(filename="project.json", file=__import__("io").BytesIO(b'{"name":"Missing id"}'))
        with self.assertRaises(HTTPException) as raised:
            await import_project(file, session_id="session-1")
        self.assertEqual(raised.exception.status_code, 422)

    async def test_route_returns_conflict_for_duplicate(self):
        file = UploadFile(filename="project.json", file=__import__("io").BytesIO(b'{"project_id":"project-1"}'))
        with patch("app.api.routes.project.project_manager.import_project", AsyncMock(side_effect=FileExistsError)):
            with self.assertRaises(HTTPException) as raised:
                await import_project(file, session_id="session-1")
        self.assertEqual(raised.exception.status_code, 409)

    async def test_route_export_uses_safe_attachment_filename(self):
        with patch(
            "app.api.routes.project.project_manager.export_project",
            AsyncMock(return_value='{"project_id":"unsafe/id"}'),
        ):
            response = await export_project("unsafe/id", session_id="session-1")
        self.assertEqual(response.media_type, "application/json")
        self.assertIn("unsafe_id.json", response.headers["content-disposition"])

    async def test_route_export_reports_missing_project(self):
        with patch("app.api.routes.project.project_manager.export_project", AsyncMock(return_value=None)):
            with self.assertRaises(HTTPException) as raised:
                await export_project("missing", session_id="session-1")
        self.assertEqual(raised.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
