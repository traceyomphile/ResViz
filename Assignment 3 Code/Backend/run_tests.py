"""Portable runner for the current ResViz backend unit tests."""
import os
import pathlib
import sys
import types
import unittest
from datetime import timedelta
from dotenv import load_dotenv

ROOT = pathlib.Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent
sys.path.insert(0, str(PROJECT_ROOT))

ENV_FILE = PROJECT_ROOT/ ".env.test"
load_dotenv(ENV_FILE, override=False)

def require_env(name: str) -> str:
    """Return a required environment variable or fail clearly."""
    value = os.getenv(name)

    if not value:
        raise ValueError(
            f'Required environment variable {name!r} is not configured. '
            f'Add it to {ENV_FILE} or provide it through the environment.'
        )
    return value

SESSION_SECRET = require_env('SESSION_SECRET')
REDIS_URL = require_env("REDIS_URL")
FRONTEND_URLS = require_env('FRONTEND_URLS')

# Keep unit tests independent of a developer's local .env file. The real
# application still uses app.config; tests provide only its public constants.
config_stub = types.ModuleType("app.config")

config_stub._REDIS_URL = REDIS_URL
config_stub.SESSION_SECRET = SESSION_SECRET
config_stub.SESSION_DURATION = timedelta(minutes=20)
config_stub.SESSION_COOKIE_NAME = "resviz_session"
config_stub.FRONTEND_URLS = [url.strip() for url in FRONTEND_URLS.split(",") if url.strip()]

sys.modules.setdefault("app.config", config_stub)

def main() -> int:
    """Discover and run the backend unit tests."""
    test_directory = ROOT / 'tests'

    suite = unittest.defaultTestLoader.discover(str(test_directory), pattern="test_*.py")
    result = unittest.TextTestRunner(verbosity=2).run(suite)

    return 0 if result.wasSuccessful() else 1

if __name__ == '__main__':
    raise SystemExit(main()) 
