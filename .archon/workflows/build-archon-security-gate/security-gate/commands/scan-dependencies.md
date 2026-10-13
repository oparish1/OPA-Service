# Dependency & Model Integration Vulnerability Scan

Read `$ARTIFACTS_DIR/scope.md` first. The dependency manifests this run's priming located are `$INPUTS.key_areas`'s `dependency_manifests`. This is a read-only scan: never run a scanner's `--fix` or equivalent autofix option and never modify a lockfile.

## Run a real scanner if one is available

Run whatever dependency-vulnerability tooling is available in this environment against these manifests — `npm audit`, `pip-audit`, `osv-scanner`, `cargo audit`, or the language-appropriate equivalent — if the tool and network access are available.

If no scanner tool is available, do not silently fall back to a lighter-weight spot-check as if it were equivalent coverage. Perform a manual spot-check instead (auth libraries, serialization libraries, the LLM SDK itself, checked against known CVE databases via web search), but record in `coverage_gaps` that no automated scanner was available and a manual spot-check was performed instead, naming the materially lower coverage explicitly — this is exactly the gap `synthesize-gate` needs to weigh toward CONDITIONAL PASS rather than PASS.

## Model integration versions

Identify which LLM/embedding providers and SDK versions are in use and check for known vulnerabilities or advisories in that SDK version — deserialization issues, SSRF in provider clients, known prompt-injection-adjacent CVEs in agent frameworks (LangChain, AutoGPT-style loops and equivalents).

## Flag risky dependency practices

Flag any dependency that is unpinned, uses a wildcard version range, or is pulled from an unofficial or unverified source, as its own finding even where no specific CVE is known for it yet.

## Classify

Classify each finding by CVSS severity where available; record `patched_version` when a fix exists, `null` when none is available yet.

## Write the scan report

Write `$ARTIFACTS_DIR/dependency-scan.md`: one section for automated/manual scan findings, one for model-integration SDK findings, one for risky dependency practices, each with severity and patch availability.

## Declare

- `findings` — `id` (e.g. `DEP-1`), `package`, `current_version`, `patched_version` (or null), `cve_id` (or null), `severity` (Critical/High/Medium/Low/Unknown), `description`.
- `coverage_gaps` — whether an automated scanner ran and if not, what was substituted and its lower coverage named explicitly.
- `summary` — a few sentences: what was scanned, tool used or gap noted and the headline dependency risk if any.
- `report` — the pointer to `dependency-scan.md`.
