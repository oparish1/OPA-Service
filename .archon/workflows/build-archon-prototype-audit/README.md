# archon-prototype-audit

A new top-level workflow — not a variation of an existing one — built from the
`prototype-stability-check` skill you attached. It audits an early-stage
prototype for structural debt, missing test coverage, fragile prompt/context
handling and non-deterministic behavior, then produces two companion
deliverables: an MVP Code Audit Report and a Claude Code-sequenced
remediation plan. By default it also fixes the Release Blockers tier in the
same run and revalidates, matching the source skill's own Step 6; filing the
rest as GitHub issues and opening a PR for the fixes are both explicit
opt-ins.

Like `archon-ship-figma`, this composes rather than forks: it includes
`archon-implement`, `archon-validate` and `archon-pr` unmodified for the
three steps that need them and adds new nodes only for the parts nothing in
the pack already does — priming and scoping the audit, the two parallel
audit lenses and turning their findings into a backlog and a plan.

## Is this worth a new workflow, or should an existing one do it?

Worth it. None of the ten `sdlc` pack workflows scans a whole codebase across
several debt dimensions and returns a sequenced multi-item backlog — every
one of them returns a single verdict or a single PR:

| Workflow | What it judges | Why it doesn't cover this |
|---|---|---|
| `archon-triage` | Whether one work item is a ready contract | One item, not a codebase; a verdict, not a backlog. |
| `archon-review` | A diff or PR, through parallel lenses | Closest shape — parallel lenses, one synthesis — but bounded to a change under review and it judges correctness, not accumulated debt. |
| `archon-validate` | Whether the project's own checks pass | Runs what's already there; doesn't judge whether coverage is adequate or prompt/context handling is fragile. |
| `archon-plan` | How to build one already-decided thing | Needs a decided outcome to plan against — this workflow produces the list of things that still need deciding. |

This workflow reuses `archon-review`'s parallel-lens-then-synthesize shape
(the one genuinely reusable pattern among them) but points it at a whole
codebase instead of a diff and its terminal output is a backlog, not a
ready/not-ready verdict.

## Where it sits in the pipeline

Upstream of everything else, feeding it. Run this once on a prototype, get
back a backlog; file (or hand-convert) each item into an issue; run
`archon-ship` or `archon-ship-figma` on each one exactly as before. With
`file_issues: true`, this workflow does the filing step for you, in the same
triage-ready contract shape those workflows already expect — see
"Composing with the rest of the pack" below.

## 1. Where these files go

Same placement logic as `archon-ship-figma`: put `prototype-audit/` inside
your existing `sdlc` pack, as a sibling of `triage/`, `deliver/`, `ship/` and
so on, so it can reuse `.shared/io.ts` by the same relative path
(`../../.shared/io.ts`) every other component uses and `include:`
`archon-implement`, `archon-validate` and `archon-pr` by name.

```
.archon/workflows/sdlc/
├── .shared/                      # existing — unchanged
├── triage/ … ship/ upkeep/       # existing — unchanged
└── prototype-audit/               <-- new, from this deliverable
    ├── archon-prototype-audit.yaml
    ├── commands/
    │   ├── prime-scope.md
    │   ├── audit-structure.md
    │   ├── audit-context-state.md
    │   ├── synthesize-backlog.md
    │   ├── plan-remediation.md
    │   └── file-issues.md
    └── scripts/
        ├── gate-scope.ts
        └── outcome.ts
```

Copy `prototype-audit/` directly into `.archon/workflows/sdlc/`. Nothing
under `.shared/` or any other existing component needs to change. Your
`prototype-stability-check` skill is included under `reference-skill/` for
your own use outside this workflow — `prime-scope.md` through
`plan-remediation.md` are self-contained adaptations of it for this
workflow, not a runtime reference to the skill file, for the same reason
noted in the `archon-ship-figma` README: I found no evidence the engine
loads external skill files into a `command:` node's prompt.

## 2. Where this deliberately departs from the skill

Three places, each because a workflow run is unattended in a way a chat
session isn't, or because the engine already supplies something the skill
had to ask for:

- **"Ask the user" becomes "declare an open question and stop."** The skill's
  governing rule is to ask rather than assume wherever a decision depends on
  information only the user has (deployment context, risk tolerance, which
  code is the core path, whether to introduce new tooling). A workflow run
  has no one to ask mid-run. `prime-scope` declares `scope_resolved: false`
  with the specific open questions instead and `gate-scope` refuses on it —
  the same shape `archon-triage`'s `BLOCKED` and `archon-ship-figma`'s
  `gate-design` already use in this pack. You answer by rerunning with more
  context (an explicit `path_glob`, or the deployment context stated
  somewhere `prime-scope` will find it), not by chatting with the run.
  `fix-blockers`' own work order carries the same translation forward for
  Step 6's "ask whether to add a test framework": it leaves that specific
  task incomplete and names the decision, rather than stopping the whole
  run or silently adding one.
- **No `output-dir` input.** The skill asks where to save its deliverables
  because a skill invoked in chat has no fixed destination. A workflow run
  always has one: `$ARTIFACTS_DIR`. `scope.md`, `structural-findings.md`,
  `context-state-findings.md`, `audit-report.md` and `remediation-plan.md`
  all go there, the same place `triage.md`/`plan.md`/`review/report.md` go
  elsewhere in this pack.
- **Step 6 ("execute Release Blockers now") is opt-out, not hardwired.** The
  skill always executes Sprint 0 in the same session. That's a materially
  bigger blast radius than every other node this workflow adds — priming and
  both lenses are `mutates_checkout: false`, matching `archon-triage`,
  `archon-investigate` and `archon-plan`'s own advisory shape; fixing
  blockers is the one step that writes code. `fix_blockers` defaults to
  `"true"` to match the skill's own default behavior exactly, but can be set
  `"false"` for an audit-only run that touches nothing — the same
  audit-first, mutate-on-request shape `archon-triage`'s `publish` flag
  already uses in this pack.

## 3. New inputs

| Input | Default | Meaning |
|---|---|---|
| `jira_issue_keys` | `""` | Forwarded to priming's own Jira handling, same as the skill. |
| `confluence_page_ids` | `""` | Forwarded to priming's own Confluence handling, same as the skill. |
| `path_glob` | `""` | Scope the audit to a subtree (e.g. `src/agents/**`). Empty audits the whole primed codebase, weighted toward the core execution path. |
| `fix_blockers` | `"true"` | Fix Release Blockers in this run and revalidate. Set `"false"` for audit-only. |
| `open_pr` | `"false"` | Open a draft PR for the Sprint 0 fixes. Beyond the skill's own scope — it only says "execute... in this session," not "open a PR" — added because it composes for free from unmodified `archon-pr`. No effect when there's nothing fixed to open a PR for. |
| `file_issues` | `"false"` | File one GitHub issue per backlog item this run didn't fix — everything when `fix_blockers` is `false`, otherwise Parallel Cleanups and Deferrable Debt. Needs a working GitHub connection; refuses cleanly per-node if none is available, since this input alone doesn't gate the whole workflow on GitHub being connected. |

## 4. Running it

```
archon-prototype-audit \
  target repo checked out locally \
  path_glob="src/agents/**" \          # optional
  fix_blockers="true" \                # default; set "false" for audit-only
  file_issues="true"                   # optional
```

(As with `archon-ship-figma`, I haven't verified the exact CLI invocation
syntax your Archon build uses — check `archon workflow run --help` or your
usual entry point. There's no `target` input the way `archon-ship` has one:
this workflow always audits the checked-out repository as a whole, or the
subtree `path_glob` names.)

## 5. Reading the result

`completed` is `true` whenever the run reaches its terminal node — the audit
and remediation plan exist by that point regardless of how many blockers
there were or whether any optional branch ran, the same "a negative finding
is still a successful run" shape `archon-ship`'s `delivered: false` uses.
Read `summary` for the actual news: backlog counts, the go/no-go
recommendation, whether Sprint 0 was fixed and stayed green, whether a PR
was opened and how many issues were filed.

| Deliverable | Path | What it's for |
|---|---|---|
| MVP Code Audit Report | `$ARTIFACTS_DIR/audit-report.md` | The diagnosis: findings, the three-tier backlog, a go/no-go call. |
| Remediation plan | `$ARTIFACTS_DIR/remediation-plan.md` | The treatment plan: sprint-sequenced, Claude Code-ready tasks. |
| Raw lens findings | `structural-findings.md`, `context-state-findings.md` | Backing evidence for the audit report, if you want the unconsolidated detail. |
| Scope note | `scope.md` | What was audited and the deployment context / risk tolerance the classification was judged against. |

If `gate-scope` refused, none of the above exist except `scope.md` — read its
Open Questions section, resolve them and rerun.

## 6. Composing with the rest of the pack

`file_issues: true` files each unfixed backlog item already shaped as a
triage-ready contract — problem, why, why now, outcome, invariants,
acceptance — citing the specific backlog id in `audit-report.md` and
`remediation-plan.md`. A subsequent `archon-ship` or `archon-ship-figma` run
on any of those issues should find `archon-triage` already resolves it to
`READY` rather than `NEEDS_CONTRACT_WORK`, since the contract was written for
that purpose. If you'd rather review and edit the backlog by hand before
anything is filed, leave `file_issues` at its default `false` and convert
`remediation-plan.md`'s Sprint 1 and Backlog sections into issues yourself.

## 7. What I did not build and why

- **No `review-design`-style lens for prompt/context specifically beyond
  what's here.** The skill's own Step 1/Step 2 split is exactly two
  categories — structural and context/state — so this workflow builds
  exactly two lenses. I considered a third lens pulling real coverage
  numbers from `archon-validate`'s discovery step rather than a lens's
  impression of coverage, but `archon-validate` has no documented
  "discover only, don't run" mode and running it in full before priming
  even finishes would duplicate work the skill doesn't ask for. If your
  Archon version does expose a discovery-only mode, wiring its output into
  `audit-structure`'s missing-mock-boundary findings would be the natural
  place to add it.
- **No fixtures.** Same caveat as `archon-ship-figma`: the `sdlc` pack's own
  README states its bar for a real guard is that the fixture suite can
  exercise it. `gate-scope` is written to pass that test — it protects both
  audit lenses' spend on a question `prime-scope` asked and could not
  answer — but I didn't have the pack's dry-run engine to write and check
  `.stubs.yaml` fixtures against it. Add them, mirroring
  `sdlc/triage/fixtures/blocked.stubs.yaml`, before relying on this in
  production.
- **No mid-run interactive Q&A**, for the same reason noted in the
  `archon-ship-figma` README: I have no verified example of this pack's
  engine reading a free-form human answer back into structured node output
  mid-run, so open questions here stop the run rather than pausing for one.
