# archon-security-gate

A new top-level workflow, built from the `security-review-threat-gate` skill
you attached, following the same authoring conventions used for
`archon-ship-figma` and `archon-prototype-audit`: composed from
existing/new advisory nodes with a deterministic gate protecting the one
place a wrong guess would matter, `context: fresh` and retries on every
judgment lens, and structured `output_format` schemas everywhere a
downstream node or script needs to act on a field rather than re-read prose.

It runs a pre-production security audit — classical app security (authn/
authz, session lifecycle, RBAC, API exposure, data leakage) and
agentic-specific threats (prompt injection, context poisoning, unauthorized
tool execution) — and ends in one **Security Assessment & Threat Gate
Approval Sign-off** document with an explicit PASS / CONDITIONAL PASS / FAIL
decision.

**This workflow is read-only by design.** Unlike `archon-prototype-audit`,
which fixes Release Blockers in the same run, nothing here writes code, runs
a scanner's autofix, or opens a PR — the source skill never asks it to
remediate, only to judge and hand off. The one opt-in mutation is filing
findings as GitHub issues (`file_issues`), and even that only tracks, it
doesn't fix.

## Where these files go

Same placement as the other two: put `security-gate/` inside your existing
`sdlc` pack, as a sibling of `triage/`, `deliver/`, `ship/`, and so on, so it
can reuse `.shared/io.ts` by the same relative path every other component
uses.

```
.archon/workflows/sdlc/
├── .shared/                      # existing — unchanged
├── triage/ … ship/ upkeep/       # existing — unchanged
├── prototype-audit/               # from the prior deliverable, if installed
└── security-gate/                 <-- new, from this deliverable
    ├── archon-security-gate.yaml
    ├── commands/
    │   ├── prime-scope-security.md
    │   ├── audit-identity-access.md
    │   ├── audit-api-data.md
    │   ├── audit-agentic-threats.md
    │   ├── scan-dependencies.md
    │   ├── sast-dast.md
    │   ├── synthesize-gate.md
    │   └── file-security-issues.md
    └── scripts/
        ├── gate-scope.ts
        └── outcome.ts
```

Copy `security-gate/` directly into `.archon/workflows/sdlc/`. Your
`security-review-threat-gate` skill is included under `reference-skill/` for
your own use outside this workflow — the command files are self-contained
adaptations of it, not a runtime reference to the skill file, for the same
reason noted in the other two READMEs: no evidence the engine loads external
skill files into a `command:` node's prompt.

## The five audit lenses, and how they map to the skill

Modeled on `archon-review`'s parallel-lens-then-synthesize shape, pointed at
a whole codebase instead of a diff, with one lens per step of the skill's
own procedure:

| Node | Skill step | Always runs? |
|---|---|---|
| `audit-identity-access` | Step 1: identity, access, agent execution boundary | Yes — the agentic-specific RBAC sub-section is skipped inline when the review is non-agentic |
| `audit-api-data` | Step 2: API & data exposure | Yes — same inline skip for the agentic-specific sub-section |
| `audit-agentic-threats` | Step 3: agentic threat modeling | Only when scope is `agentic` or `both` — the one lens this workflow skips at the node level |
| `scan-dependencies` | Step 4: dependency & model-integration CVE scan | Yes |
| `sast-dast` | Step 5: SAST/DAST | Yes — DAST itself only runs with explicit authorization, see below |

`audit-complete` is a barrier node, the same `trigger_rule: all_done` shape
`archon-review` uses for its own `review-complete`, so `synthesize-gate`
sees every lens's result whether it ran, legitimately skipped, or exhausted
its retries — and can tell those apart, which matters for a decision this
consequential.

## Where this deliberately departs from the skill

Four places, each explained here so you can judge whether the translation
is the one you'd have made:

- **"Ask the user" becomes two tiers, not one**, matching the skill's own
  distinction rather than flattening it. The skill actually treats its
  ambiguities two different ways, and this workflow preserves both:
  - **Hard-gated** (declare an open question, `gate-scope` refuses, the run
    stops): whether the review is agentic, non-agentic, or both; whether the
    system is multi-tenant. Both change how a Critical is scored, and I
    chose to gate the *entire* run on the tenancy question, not just the
    tenant-isolation findings the skill's own text scopes it to — a security
    gate should not proceed on an unresolved input that changes its own
    severity scoring, even if that's a more conservative reading than the
    skill's literal text. This is the one place I made a judgment call
    beyond a direct translation; you may reasonably prefer the narrower
    reading.
  - **Soft** (recorded as a `coverage_gap`, run proceeds, `synthesize-gate`
    is instructed to weigh it toward CONDITIONAL PASS rather than PASS): no
    dependency scanner available, no SAST tool configured, DAST not
    performed, the approver role not evident. The skill itself designs a
    graceful fallback for each of these — "note the gap," "lean toward
    CONDITIONAL PASS" — so this workflow follows that design rather than
    promoting every one of them into a hard stop, which would fragment one
    audit into many small reruns for questions the skill already knew how
    to answer gracefully.
- **DAST requires an explicit prior-authorization input, not an in-run ask.**
  The skill is emphatic that DAST must never run without the user's explicit
  confirmation, since it's active, intrusive testing even in dev. A workflow
  run has no one to confirm with mid-run, so `dast_authorized` defaults to
  `"false"` and must be set `"true"` up front for `sast-dast` to attempt any
  active probing — and even then, only against a server this run itself
  finds running locally, never anything the input's name doesn't cover.
- **No `output_dir` input.** Same reasoning as `archon-prototype-audit`:
  `$ARTIFACTS_DIR` is always this run's destination, which the engine
  already supplies, so there's nothing to ask.
- **No remediation step, by design — not an oversight.** The skill's own
  scope ends at the sign-off document and a summary; it never asks the audit
  to fix what it finds, unlike `archon-prototype-audit`'s Step 6. This
  workflow honors that: the closest thing to remediation here is the opt-in
  `file_issues`, which only tracks findings as issues for a later,
  human-triaged `archon-ship` run — it does not attempt to fix anything
  itself.

## New inputs

| Input | Default | Meaning |
|---|---|---|
| `jira_issue_keys` | `""` | Forwarded to priming's own Jira handling — prior findings and compliance obligations often live there. |
| `confluence_page_ids` | `""` | Forwarded to priming's own Confluence handling. |
| `dast_authorized` | `"false"` | Explicit prior authorization for `sast-dast` to attempt active DAST probing against a locally reachable dev server this run finds. Without it, DAST is recorded as a coverage gap, never attempted. |
| `file_issues` | `"false"` | File one GitHub issue per Critical/High finding. Medium/Low stay in the report's own Residual Risk Accepted section for a human approver, never auto-filed. Needs a working GitHub connection; refuses cleanly per-node if none is available. |

## Running it

```
archon-security-gate \
  dast_authorized="false" \      # default; set "true" only with real prior authorization
  file_issues="true"             # optional
```

(As with the other two workflows in this family, I haven't verified the
exact CLI invocation syntax your Archon build uses.)

## Reading the result

`passed` collapses PASS and CONDITIONAL_PASS into `true`, and FAIL alone
into `false` — see the comment at the top of `outcome.ts` for exactly why,
and read `summary` (or the sign-off document itself) for the real three-way
`gate_decision`, since a caller that only checks `passed` would otherwise
miss the difference between "clear" and "clear with tracked conditions."

| Deliverable | Path | What it's for |
|---|---|---|
| Sign-off document | `$ARTIFACTS_DIR/security-assessment-signoff.md` | The artifact that gets signed off: gate decision, rationale, conditions/blocking issues, sign-off role, findings by category, residual risk, full appendix. |
| Per-lens findings | `identity-access-findings.md`, `api-data-findings.md`, `agentic-threat-model.md`, `dependency-scan.md`, `sast-dast-results.md` | Backing evidence, if you want the unconsolidated detail from a specific lens. |
| Scope note | `scope.md` | The resolved review scope and tenancy, and how each was determined. |

If `gate-scope` refused, only `scope.md` exists — read its Open Questions
section, resolve them, and rerun.

## What I did not build, and why

- **No fixtures.** Same caveat as the other two workflows in this family:
  the `sdlc` pack's own README states its bar for a real guard is that the
  fixture suite can exercise it. `gate-scope` is written to pass that test —
  it protects every lens's spend on a question `prime-scope-security` asked
  and could not answer — but I didn't have the pack's dry-run engine to
  write and check `.stubs.yaml` fixtures against it.
- **No mid-run interactive Q&A**, same reasoning as the other two: no
  verified example of this pack's engine reading a free-form human answer
  back into structured node output mid-run, so both the hard-gated and the
  DAST-authorization questions are resolved by rerunning with more
  information, not by pausing in place.
- **No docx output.** The skill allows the `docx` skill for formal
  circulation on explicit request. This workflow always produces the
  markdown deliverable; converting it to a Word document for circulation is
  a manual follow-up in a chat session with the `docx` skill, since I have
  no verified way for this YAML engine to invoke that skill as a workflow
  node.
