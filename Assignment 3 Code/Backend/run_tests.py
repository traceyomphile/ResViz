"""Portable runner for the current ResViz backend unit tests."""
import os
import pathlib
import sys
import types
import unittest
from datetime import timedelta

ROOT = pathlib.Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent
sys.path.insert(0, str(PROJECT_ROOT))

os.environ.setdefault("SESSION_SECRET", "unit-test-secret")
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6379/15")

# Keep unit tests independent of a developer's local .env file. The real
# application still uses app.config; tests provide only its public constants.
config_stub = types.ModuleType("app.config")
config_stub._REDIS_URL = os.environ["REDIS_URL"]
config_stub.SESSION_SECRET = os.environ["SESSION_SECRET"]
config_stub.SESSION_DURATION = timedelta(minutes=20)
config_stub.SESSION_COOKIE_NAME = "resviz_session"
config_stub.FRONTEND_URLS = ["http://localhost:5173"]
sys.modules.setdefault("app.config", config_stub)

suite = unittest.defaultTestLoader.discover(str(ROOT / "tests"), pattern="test_*.py")
result = unittest.TextTestRunner(verbosity=2).run(suite)
raise SystemExit(0 if result.wasSuccessful() else 1)
