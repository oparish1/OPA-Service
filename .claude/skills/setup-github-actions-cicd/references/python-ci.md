# Python: Lint, Security Scan, Tests

Read this when the project contains Python. Commands come from the project's own configuration; the shapes below say what to look for and how to wire it.

## Contents
1. Detect
2. Setup and caching
3. Lint (Flake8, or the project's linter)
4. Security scan (Bandit)
5. Tests
6. Matrix and services
7. Pitfalls
8. Verify

## 1. Detect

- Dependency source: `uv.lock`, `poetry.lock`, `Pipfile.lock`, `requirements*.txt`, or `pyproject.toml`. Install exactly what the lockfile pins; if `requirements.txt` is unpinned, say so and ask whether to generate a lock.
- Supported Python versions: from `requires-python`, classifiers, `tox.ini`, or `.python-version`. The matrix comes from these, not from what is newest.
- Linter in use: Flake8, Ruff, pylint, or none. Use the project's tool. Flake8 does not read `pyproject.toml` by itself; it reads `.flake8`, `setup.cfg`, or `tox.ini` unless a plugin adds it. If the owner wants Flake8 and the config lives elsewhere, either add a `.flake8` file or use the plugin; record the choice.
- Bandit configuration: a `[tool.bandit]` table (needs the TOML extra to be read), a `.bandit` file, or command-line flags.
- Test runner and how it is invoked: pytest, unittest, tox, nox, or a Makefile target; where coverage is configured.
- Source and test directories, to scope the scanners.

## 2. Setup and caching

- Set up Python with the version the project declares and use the setup action's built-in dependency cache keyed on the lockfile. Look up the current action and its cache inputs in its documentation.
- Install with the project's installer from the lockfile; include the dev/test group but not unrelated extras.
- Do not install tools globally that the project already pins; run them from the environment the project defines.

## 3. Lint (Flake8, or the project's linter)

- Run Flake8 with the project's config over the source and test directories. Fail the job on any reported error; a lint step that only prints is not a check.
- Existing debt: if the codebase already has many violations, agree a policy with the owner: fix first, or lint only changed files on pull requests, or freeze a baseline. Do not enable a check that is red from day one without saying so.
- Formatting checks (Black, Ruff format, isort) are separate steps; add them only if the project uses them.
- Type checking (mypy, pyright) only if the project configures it.

## 4. Security scan (Bandit)

- Run Bandit recursively over the source directory only (exclude tests and virtual environments unless the owner wants tests scanned; test code triggers noise such as assert use).
- Severity and confidence thresholds are owner decisions: options are report-only, fail on medium and above, or fail on high. Bandit returns a non-zero status when it finds issues at or above the selected levels, which is what fails the job.
- On an existing codebase, generate a baseline file of accepted findings and run against it so only **new** findings fail; keep the baseline in the repository and review changes to it.
- Suppress a specific finding in code with a justification comment, not a blanket exclusion and expect reviewers to question each one.
- Output a machine-readable report (JSON or SARIF) and upload it as an artifact; upload SARIF to code scanning only if the repository has that feature (check plan availability).
- Bandit finds Python code smells that are commonly insecure. It does not scan dependencies. For that, add a dependency audit (for example `pip-audit` or the ecosystem's equivalent) as a separate step, or use GitHub's dependency review and Dependabot alerts; ask the owner which.

## 5. Tests

- Run the project's test command. Fail if the run collects zero tests unless the owner accepts that.
- Coverage: collect it if the project does; enforce a threshold only if the owner sets one. Upload the report as an artifact.
- Set the environment the tests need through workflow `env` with non-secret test values. Tests must not depend on production secrets.
- Timeouts: add a job `timeout-minutes` and, where supported, per-test timeouts to stop hangs.

## 6. Matrix and services

- A version matrix only across versions the project claims to support. `fail-fast: false` if the owner wants to see all failures.
- Databases and caches as service containers with health checks so tests start after the service is ready. Use the same engine and major version as production. Ports map to the runner host; connection strings come from the project's test configuration.
- For tests that need the Docker daemon or compose, run them on the runner directly and tear down after.

## 7. Pitfalls

- Caching the virtualenv across Python versions or lockfile changes.
- Running Bandit over `venv/` or `node_modules/` and drowning in noise.
- Flake8 silently ignoring `pyproject.toml` config.
- Installing with `pip install .` without the dev group, then wondering why pytest is missing.
- Tests that pass because of skipped markers; report skips.
- Using `continue-on-error` to make a red check green without recording that decision.

## 8. Verify

- Run the lint, Bandit and test commands locally exactly as the workflow does; record the outcome.
- Introduce a deliberate violation on a scratch branch (or reason through it) to confirm each step can fail.
- Confirm the matrix versions match the declared support range and the cache key uses the lockfile.
