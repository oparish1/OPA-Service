# Lens: unhandled tool failure modes

You are one lens of `archon-pre-multiagent-readiness-audit`. Advisory: never modify
the checkout. Write only to `$ARTIFACTS_DIR/audit/tools.md`.

Read `$ARTIFACTS_DIR/audit/prime.md` first: it lists every tool and the resolved
shape. Every finding needs a `file:line` you have opened.

## Method

For **every tool** listed in prime.md, trace what actually happens — by reading the
code path, not by inferring from its structure — on each of:

1. timeout;
2. error response (non-2xx, exception, permission denied);
3. malformed output;
4. partial success.

Then look across tools for:

- **Silent success.** A failure that is caught and only logged while execution
  continues as if the tool succeeded. This is the most common source of cascading
  failure once a second agent relies on the first agent's tool result. Say exactly
  what the caller believes afterward.
- **No retryable/non-retryable distinction.** Blind retries that would hammer a
  failing dependency harder once several agents share it.
- **Retry policy tuned for one caller.** Note the current limits and what they
  become at N callers.

## Output format

One block per finding:

```
### T-<n>: <tool> — <failure mode>
- Location: file:line
- What happens today: ... (traced, with the return/exception contract)
- Why it is tolerable today (single agent): ...
- Why it is dangerous under the planned shape (<shape>): ...
- Preliminary severity: critical | high | medium | low
```

Then a **Failure-mode inventory** table — this is what the coverage lens
cross-references, so give every row a stable id:

| Id | Tool | Failure mode | Handled? (surfaced / swallowed / unhandled) | Location |
|---|---|---|---|---|

Include an explicit **Not found** list.
