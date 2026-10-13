# End-to-End Tests with Playwright

Read this when the project has, or should get, browser-based end-to-end tests. E2E is the slowest and flakiest layer; wire it so failures are diagnosable and the cost is controlled.

## Contents
1. Detect
2. Deciding where the app runs
3. Browsers and caching
4. Running the tests
5. Artifacts and diagnosis
6. Speed, sharding and flakiness
7. Test data and secrets
8. Gating
9. Verify

## 1. Detect

- Playwright config (`playwright.config.*`): projects (which browsers), `baseURL`, `webServer` (a command Playwright starts and waits on), retries, workers, reporters and trace settings.
- The test command from `package.json` or the docs; the Playwright version from the lockfile.
- How the app is started for tests today: a dev server, a production build, or a compose stack. CI should test what ships, so prefer a production build or the built container over a dev server.
- Services the app needs (database, cache, mock APIs) and how they are seeded.

## 2. Deciding where the app runs

Choose with the owner, in order of fidelity:
1. **The built container or compose stack** from the same image the pipeline builds. Highest fidelity; start with compose, wait for the health check, then run tests against its URL.
2. **A production build served on the runner**, started by Playwright's `webServer` or a workflow step. Good default without Docker.
3. **A dev server.** Fastest to set up, least representative. Say so if chosen.

Never run e2e against production. Point the tests at an isolated, seeded environment with test-only accounts.

## 3. Browsers and caching

- Install only the browsers the config uses (for example a single browser project) plus their system dependencies, using Playwright's install command with the dependencies option; each extra browser adds minutes.
- Cache the browser download keyed on the Playwright version, or use the official Playwright container image whose tag **matches the installed Playwright version exactly**; a mismatch produces confusing browser-launch failures. Look up current guidance in Playwright's CI documentation.
- Do not cache browsers across Playwright version changes.

## 4. Running the tests

- Set the CI flag so the config's CI branches apply (forbid `test.only`, enable retries, limit workers).
- Wait for readiness properly: a health-check URL, not a fixed sleep.
- Run with the reporters CI needs: a concise console reporter plus the HTML report and optionally a machine-readable one for annotations.
- Give the job a generous but bounded `timeout-minutes` and a per-test timeout in the config.

## 5. Artifacts and diagnosis

- Upload the HTML report and traces **even when tests fail**: use an always-run condition that still respects cancellation. A failed e2e without a trace is nearly undebuggable.
- Configure traces, screenshots and video to capture on failure or first retry, not for every test (storage and time cost).
- Set a short artifact retention to avoid storage bloat.
- Add the run link and failing test names to the job summary if practical.

## 6. Speed, sharding and flakiness

- Split slow suites across parallel jobs with Playwright's sharding option and a matrix; merge reports afterward if a single report is wanted.
- Retries: allow a small number in CI to survive infrastructure noise, but **track flaky tests** (tests that pass only on retry) and fix or quarantine them. Retries that hide flakiness forever are a debt.
- Isolate tests: no shared mutable state between tests, unique data per test, reset between runs.
- Prefer stable locators (roles, labels, test ids) over CSS chains; that is a test-authoring rule to pass to the owner if failures cluster.

## 7. Test data and secrets

- Test accounts and seed data are non-production and non-sensitive. If login credentials are needed, use repository secrets or environment-scoped test values, never a real user.
- Fork pull requests do not receive secrets; e2e that needs them will not run for forks. Decide whether to skip e2e for forks or use secret-free test data.
- Third-party integrations (payments, email) should be stubbed or run in provider test mode in CI.
- Do not print tokens in traces: traces can capture request headers and bodies. Review what gets uploaded, particularly for public repositories.

## 8. Gating

- E2E is commonly a required check on the default branch merge and optionally on pull requests if fast enough. Agree with the owner: block always, block only on main, or report only. Slow, flaky required checks cause people to bypass protection.
- Deploy depends on e2e passing if the owner wants that gate; otherwise the deploy depends on lint, tests and the image build only and e2e runs against the deployed staging environment afterward.

## 9. Verify

- Run the e2e command locally with the same environment the workflow sets.
- Confirm the browser cache key or container tag matches the Playwright version.
- Confirm reports and traces upload on failure.
- Confirm the readiness wait uses a health check.
- State which behaviors only a real run can show: runner timing, browser dependencies and flakiness.
