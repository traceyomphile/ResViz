import unittest
from unittest.mock import AsyncMock

from app.api.routes.conversion import project_formulas
from app.schemas.knowledge_base import KnowledgeBaseEntry
from app.schemas.project import Project
from app.services.ProjectManager import ProjectManager


class ProjectManagementTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.manager = ProjectManager()
        self.manager.get = AsyncMock()
        self.manager.save = AsyncMock(side_effect=lambda _session, project: project)

    def test_project_formulas_combines_all_named_knowledge_bases(self):
        project = Project(
            project_id="project-1",
            knowledge_bases=[
                KnowledgeBaseEntry(name="Admissions", formulas=["A"]),
                KnowledgeBaseEntry(name="Rules", formulas=["(A -> B)", "E"]),
            ],
        )
        self.assertEqual(
            [str(formula) for formula in project_formulas(project)],
            ["A", "(A -> B)", "E"],
        )

    def test_project_formulas_does_not_duplicate_active_saved_kb(self):
        entry = KnowledgeBaseEntry(name="Admissions", formulas=["A"])
        project = Project(
            project_id="project-1",
            knowledge_base=entry.formulas,
            knowledge_bases=[entry],
        )
        self.assertEqual([str(item) for item in project_formulas(project)], ["A"])

    def test_project_formulas_includes_distinct_unsaved_active_kb(self):
        project = Project(
            project_id="project-1",
            knowledge_base=["E"],
            knowledge_bases=[KnowledgeBaseEntry(name="Admissions", formulas=["A"])],
        )
        self.assertEqual([str(item) for item in project_formulas(project)], ["A", "E"])

    def test_source_change_invalidates_previous_reasoning(self):
        project = Project(
            project_id="project-1",
            cnf_kb=["A"],
            cnf_steps=[{"step_number": 1, "rule": "test"}],
            resolution_result="entailed",
            status="resolution-complete",
        )
        ProjectManager._invalidate_reasoning(project)
        self.assertIsNone(project.cnf_kb)
        self.assertEqual(project.cnf_steps, [])
        self.assertEqual(project.resolution_result, "")
        self.assertEqual(project.status, "draft")

    async def test_saving_named_kb_appends_activates_and_invalidates(self):
        project = Project(project_id="project-1", cnf_kb=["P"], status="cnf-complete")
        self.manager.get.return_value = project
        entry = KnowledgeBaseEntry(name="Admissions", formulas=["A"])
        saved = await self.manager.save_knowledge_base_entry("session-1", "project-1", entry)
        self.assertEqual([item.name for item in saved.knowledge_bases], ["Admissions"])
        self.assertEqual([str(item) for item in saved.knowledge_base], ["A"])
        self.assertIsNone(saved.cnf_kb)
        self.assertEqual(saved.status, "draft")

    async def test_activating_named_kb_loads_its_formulas(self):
        entry = KnowledgeBaseEntry(id="kb-1", name="Admissions", formulas=["A"])
        self.manager.get.return_value = Project(project_id="project-1", knowledge_bases=[entry])
        saved = await self.manager.activate_knowledge_base_entry("session-1", "project-1", "kb-1")
        self.assertEqual([str(item) for item in saved.knowledge_base], ["A"])

    async def test_deleting_active_kb_selects_remaining_kb(self):
        first = KnowledgeBaseEntry(id="kb-1", name="Admissions", formulas=["A"])
        second = KnowledgeBaseEntry(id="kb-2", name="Rules", formulas=["E"])
        self.manager.get.return_value = Project(
            project_id="project-1",
            knowledge_base=second.formulas,
            knowledge_bases=[first, second],
            cnf_kb=["E"],
        )
        saved = await self.manager.delete_knowledge_base_entry("session-1", "project-1", "kb-2")
        self.assertEqual([item.id for item in saved.knowledge_bases], ["kb-1"])
        self.assertEqual([str(item) for item in saved.knowledge_base], ["A"])
        self.assertIsNone(saved.cnf_kb)

    async def test_deleting_only_active_kb_clears_active_formulas(self):
        entry = KnowledgeBaseEntry(id="kb-1", name="Admissions", formulas=["A"])
        self.manager.get.return_value = Project(
            project_id="project-1", knowledge_base=entry.formulas, knowledge_bases=[entry]
        )
        saved = await self.manager.delete_knowledge_base_entry("session-1", "project-1", "kb-1")
        self.assertEqual(saved.knowledge_bases, [])
        self.assertEqual(saved.knowledge_base, [])


if __name__ == "__main__":
    unittest.main()
