# Python

Covers web APIs (FastAPI, Flask, Django), workers and scripts/agents.

## Contents
1. What to read in the project
2. Base image
3. Dockerfile pattern
4. Serving
5. Health check
6. Pitfalls

## 1. What to read in the project

- Dependency source of truth: `uv.lock` / `pyproject.toml` (uv), `poetry.lock`, `Pipfile.lock`, `requirements.txt` (check whether it is fully pinned; if not, ask whether to generate a lock), or `pip-tools` output.
- Python version from `.python-version`, `pyproject`'s `requires-python`, or CI config. If unclear, ask.
- Entry point: the real module and app object (`app.main:app`), `manage.py` for Django, or the script/CLI the agent runs. Never guess module paths.
- Port and bind: many dev servers bind `127.0.0.1` (Flask's default, `uvicorn` default). The production command must bind `0.0.0.0`.
- System libraries needed at build or run time (`libpq`, `libjpeg`, `ffmpeg`, `poppler`) — read the imports and the docs and confirm by building.
- Django: `ALLOWED_HOSTS`, static files (collectstatic and who serves them), database, migrations.

## 2. Base image

- Look up the current supported Python and pin an explicit version tag. Use a `-slim` (Debian) image. Avoid Alpine for Python: musl means many wheels are unavailable and packages compile from source, making builds slow and sometimes broken.
- Compiled dependencies: install build tools (compiler, `-dev` headers) only in the builder stage, then copy the built virtual environment into the runtime stage. Install only the runtime shared libraries in the final image.

## 3. Dockerfile pattern

- Environment: `PYTHONDONTWRITEBYTECODE=1`, `PYTHONUNBUFFERED=1` (logs appear immediately) and `PIP_NO_CACHE_DIR=1` where pip is used.
- Builder stage creates a virtual environment (or uses `uv` to sync from the lockfile with dev groups excluded) and installs dependencies from the lockfile **before** copying source, so dependency layers cache. Use a cache mount for the installer's cache.
- Runtime stage copies the virtual environment and the application source only, puts the venv's `bin` on `PATH`, creates and switches to a non-root user with a fixed UID/GID and owns only the state directories.
- Use the exec form: `CMD ["gunicorn", ...]` or `CMD ["uvicorn", ..., "--host", "0.0.0.0"]`. The Python process must be PID 1 or run under `init: true` so signals arrive.
- Install the project itself in non-editable mode; do not ship `pip`/`uv` caches, tests, or docs.
- For agents/scripts with no server, the `CMD` is the actual entry command; see `agent.md`.

## 4. Serving

- Do not run a framework's development server in production (`flask run`, `manage.py runserver`, `uvicorn --reload`).
- ASGI apps: `uvicorn` (optionally under `gunicorn` with the uvicorn worker) or `hypercorn`. WSGI apps: `gunicorn`. Ask about or measure worker count; do not copy a formula without knowing the container's CPU allotment.
- If a proxy fronts the app, configure forwarded-header trust for only that proxy's address, not `*`, unless the network guarantees only the proxy can reach it.
- Set graceful-shutdown timeouts to fit the orchestrator's stop grace period.

## 5. Health check

Slim images normally lack `curl`. Use a Python one-liner with `urllib.request` against the app's health route, exiting non-zero on any error or non-2xx. Point it at a real route, adding a minimal one only with the owner's agreement. For workers with no HTTP surface, use a heartbeat file the process touches and a check on its age (see `agent.md`).

## 6. Pitfalls

- Running as root, or writing to the source directory at runtime.
- Unpinned `requirements.txt` producing different images each build.
- Copying `.venv`, `__pycache__`, or `.env` into the image (fix in `.dockerignore`).
- Build tools left in the final image.
- `pip install` at container start.
- Timezone or locale assumptions; set only what the app needs.
- Django: forgetting `collectstatic`, or running migrations implicitly on every replica at start.
