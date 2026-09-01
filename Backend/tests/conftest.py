import os


# app.config reads these values while test modules are imported. Unit tests use
# fake Redis objects, so no real service or production secret is required.
os.environ.setdefault("SESSION_SECRET", "unit-test-secret-not-for-production")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")

