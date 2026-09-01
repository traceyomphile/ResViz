import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

from app.services.SessionManager import SessionManager


class SessionManagerTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.duration = timedelta(minutes=20)
        self.manager = SessionManager(duration=self.duration)
        self.manager._redis = AsyncMock()
        self.now = datetime(2026, 9, 1, tzinfo=timezone.utc)

    def test_same_tab_produces_same_session_identifier(self):
        self.assertEqual(self.manager._session_id("tab-a"), self.manager._session_id("tab-a"))

    def test_different_tabs_produce_different_session_identifiers(self):
        self.assertNotEqual(self.manager._session_id("tab-a"), self.manager._session_id("tab-b"))

    def test_session_identifier_does_not_expose_tab_identifier(self):
        self.assertNotEqual(self.manager._session_id("tab-a"), "tab-a")

    async def test_create_stores_initial_session_with_twenty_minute_ttl(self):
        session = await self.manager.create("session-1", self.now)
        self.assertIsNone(session.active_project_id)
        self.assertEqual(session.project_ids, [])
        self.assertEqual(session.expires_at, self.now + self.duration)
        self.manager._redis.set.assert_awaited_once()
        self.assertEqual(self.manager._redis.set.await_args.kwargs["ex"], 1200)

    async def test_get_refreshes_ttl_and_expiry(self):
        raw = json.dumps({
            "session_id": "session-1",
            "active_project_id": None,
            "project_ids": [],
            "created_at": self.now.isoformat(),
            "expires_at": (self.now + self.duration).isoformat(),
        })
        self.manager._redis.getex.return_value = raw
        later = self.now + timedelta(minutes=5)
        session = await self.manager.get("session-1", later)
        self.assertEqual(session.expires_at, later + self.duration)
        self.manager._redis.getex.assert_awaited_once_with("session:session-1", ex=1200)
        self.manager._redis.set.assert_awaited_once()

    async def test_get_or_create_restores_existing_session(self):
        expected = object()
        self.manager.get = AsyncMock(return_value=expected)
        self.manager.create = AsyncMock()
        actual = await self.manager.get_or_create("tab-a", self.now)
        self.assertIs(actual, expected)
        self.manager.create.assert_not_awaited()

    async def test_get_or_create_replaces_expired_session(self):
        self.manager.get = AsyncMock(return_value=None)
        self.manager.create = AsyncMock(return_value="new-session")
        actual = await self.manager.get_or_create("tab-a", self.now)
        self.assertEqual(actual, "new-session")
        self.manager.create.assert_awaited_once()

    async def test_delete_reports_whether_session_existed(self):
        self.manager._redis.delete.side_effect = [1, 0]
        self.assertTrue(await self.manager.delete("session-1"))
        self.assertFalse(await self.manager.delete("session-1"))


if __name__ == "__main__":
    unittest.main()
