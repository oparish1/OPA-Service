# Lens: state transitions, idempotency and state isolation

You are one lens of `archon-pre-multiagent-readiness-audit`. Advisory: never modify
the checkout. Write only to `$ARTIFACTS_DIR/audit/state.md`.

Read `$ARTIFACTS_DIR/audit/prime.md` first: it holds the resolved shape and the
state inventory. Every finding needs a `file:line` you have opened.

## Part 1 — fragile state transitions

- **Unvalidated state machines**, explicit or implicit (a conversation phase, a task
  status field). Can the system go from `pending` to `done` without passing through
  `in_progress`? Can two transitions race?
- **Missing idempotency** on state-changing operations. If a step runs twice — a
  retry, a re-delegated task, an orchestrator re-invoking a sub-agent — does state
  end up correct, or duplicated and corrupted? Trace it; do not assume.
- **State held only in process memory** that a multi-agent design would have to hand
  between agents or processes.

## Part 2 — state isolation classification

For **every piece of state in the prime.md inventory** (add any you find that it
missed), classify it as exactly one of:

- `isolated` — per-execution; safe to parallelize as-is;
- `synchronized` — shared, with a lock, transaction, or equivalent (name it);
- `unsafe` — shared and unsynchronized; unsafe to parallelize without change.

Classify from what the code does, not from what it intends. Cite the writer and
reader locations for each.

## Output format

Findings as blocks:

```
### S-<n>: <one-line title>
- Location: file:line
- Why it is tolerable today (single agent): ...
- Why it is dangerous under the planned shape (<shape>): ...
- Preliminary severity: critical | high | medium | low
```

Then a table, one row per piece of state:

| State | Location | Classification | Evidence (file:line) |
|---|---|---|---|

Finish with exact counts on their own line, which the synthesis relies on:

`State isolation totals: isolated=<n> synchronized=<n> unsafe=<n>`

Rows and totals must agree. Include an explicit **Not found** list.
