from datetime import datetime, timedelta, timezone

import pytest

from app.services.SessionManager import SessionManager


class FakeRedis:
    def __init__(self):
        self.values = {}
        self.expiries = {}

    async def set(self, key, value, ex=None):
        self.values[key] = value
        self.expiries[key] = ex
        return True

    async def getex(self, key, ex=None):
        self.expiries[key] = ex
        return self.values.get(key)

    async def delete(self, key):
        existed = key in self.values
        self.values.pop(key, None)
        return int(existed)


def manager_with_fake_redis():
    manager = SessionManager.__new__(SessionManager)
    manager._redis = FakeRedis()
    manager._duration = timedelta(minutes=20)
    return manager


def test_session_id_is_deterministic_and_tab_specific():
    manager = manager_with_fake_redis()
    assert manager._session_id("tab-a") == manager._session_id("tab-a")
    assert manager._session_id("tab-a") != manager._session_id("tab-b")
    assert len(manager._session_id("tab-a")) == 64


@pytest.mark.asyncio
async def test_create_persists_session_with_ttl():
    manager = manager_with_fake_redis()
    now = datetime.now(timezone.utc)
    session = await manager.create("session-1", now)
    key = "session:session-1"
    assert session.session_id == "session-1"
    assert key in manager._redis.values
    assert manager._redis.expiries[key] == 1200


@pytest.mark.asyncio
async def test_get_refreshes_expiry_timestamp_and_ttl():
    manager = manager_with_fake_redis()
    original = datetime(2026, 1, 1, tzinfo=timezone.utc)
    await manager.create("session-1", original)
    later = original + timedelta(minutes=5)
    restored = await manager.get("session-1", later)
    assert restored.expires_at == later + timedelta(minutes=20)
    assert manager._redis.expiries["session:session-1"] == 1200


@pytest.mark.asyncio
async def test_get_or_create_restores_same_tab_session():
    manager = manager_with_fake_redis()
    now = datetime.now(timezone.utc)
    first = await manager.get_or_create("tab-a", now)
    second = await manager.get_or_create("tab-a", now + timedelta(minutes=1))
    assert first.session_id == second.session_id


@pytest.mark.asyncio
async def test_delete_reports_whether_session_existed():
    manager = manager_with_fake_redis()
    await manager.create("session-1", datetime.now(timezone.utc))
    assert await manager.delete("session-1") is True
    assert await manager.delete("session-1") is False

