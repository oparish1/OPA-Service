---
name: prototype-stability-check
description: "Audits an early-stage prototype codebase for structural debt, missing test coverage, fragile prompt/context handling and non-deterministic behavior, then produces a prioritized MVP Code Audit Report and a Claude Code-sequenced remediation plan. Use when the user asks to check if a prototype is stable, audit an MVP, assess pre-harness/pre-hardening readiness, or turn prototype cleanup into a sequenced sprint backlog. Optional arguments: jira-issue-keys, confluence-page-ids, path-glob, output-dir."
---

# Prototype Stability Check

## Objective

Early prototypes accumulate debt fast: hardcoded prompt strings, untested edge cases,
global/shared state that leaks between calls and "happy path only" logic with no
deterministic fallback. Before that prototype becomes the basis for a formal test harness or
production hardening effort, this skill audits it, prioritizes what's found and converts the
findings into a remediation backlog that Claude Code can execute sprint-by-sprint — fixing the
release-blocking issues immediately and scheduling the rest.

This skill assumes the prototype is functionally working but structurally unproven. The goal
is not a rewrite — it's de-risking the foundation.

**Governing rule for this whole process: where a decision depends on information only the
user has — deployment context, risk tolerance, which code is actually the core path, whether
to introduce new tooling like a test framework — ask, rather than assuming a plausible
default.** Silent assumptions here don't just waste effort; they can produce a report that
misjudges what actually blocks release, or fixes made to the wrong subsystem.

## Process

Run `/prime-codebase` first (or reuse its output if already primed this session) so the audit
is grounded in real codebase structure. Then work through the audit, backlog, reporting and
remediation steps in full detail in **`references/procedure.md`**. Report deliverable
templates are in **`references/report-templates.md`**.

Steps, at a glance:

0. Prime the codebase (and ask about deployment context / risk tolerance)
1. Structural weakness audit (hardcoded prompts, unhandled edge cases, missing test seams)
2. Context & state integrity audit (context leaks, state corruption, deterministic fallback)
3. Consolidate findings into a prioritized backlog (Release Blockers / Parallel Feature
   Cleanups / Deferrable Debt)
4. Write the MVP Code Audit Report
5. Write the Claude Code-Sequenced Remediation Plan
6. Execute the Release Blockers now, in this session

## Output

Determine the output directory in this order:
1. An `output-dir` argument passed to this skill, if given.
2. Otherwise, ask the caller/user where to save the deliverables.

Do not assume or hardcode a path (e.g. do not default to "the outputs directory" or
`$ARTIFACTS_DIR`) — the right destination depends entirely on the context this skill is
invoked from and only the caller knows it.

Deliver, in this order, into the resolved output directory:

1. **MVP Code Audit Report** (markdown file, or Word doc if explicitly requested)
2. **Claude Code-Sequenced Remediation Plan** (markdown file) — this is the artifact meant to
   be dropped into the sprint backlog / fed to Claude Code in future sessions
3. A short inline summary of which Sprint 0 fixes were completed in this session, which were
   flagged as too large to execute unattended and what the immediate next step is

Present both files together — the audit and the plan are companion documents and should be
reviewed as a pair.
