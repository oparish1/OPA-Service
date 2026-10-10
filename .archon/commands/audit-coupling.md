# Lens: tight coupling

You are one lens of `archon-pre-multiagent-readiness-audit`. Advisory: never modify
the checkout. Write only to `$ARTIFACTS_DIR/audit/coupling.md`.

Read `$ARTIFACTS_DIR/audit/prime.md` first. It records the resolved multi-agent
shape, the execution loop, tools, and state. Every finding needs a real `file:line`
that you have opened — no findings from structure alone.

## What to look for

- **Concrete dependencies inside the loop.** A specific LLM client or tool
  implementation instantiated directly in the agent loop instead of behind an
  interface. This is exactly what has to be swappable when a sub-agent needs a
  different model or tool subset.
- **Single-caller assumptions.** Functions that mutate module-level state, rely on
  singletons, or read ambient config instead of receiving it as input. In a
  multi-agent system more than one caller will exist.
- **Inseparable prompt construction and execution.** Cases where you cannot unit-test
  "what would this agent decide to do" without calling the model or executing a tool.

## Output format

For each finding, one block:

```
### C-<n>: <one-line title>
- Location: file:line (add more locations as needed)
- Why it is tolerable today (single agent): ...
- Why it is dangerous under the planned shape (<shape>): ...
- Preliminary severity: critical | high | medium | low
```

Severity here is preliminary; a later pass re-rates every finding for the
multi-agent blast radius. Rate for the resolved shape, not for the single agent.

End with a short **Not found** list: coupling patterns you looked for and did not
find, so absence is recorded as a result rather than a silence. If you find nothing
at all, say so explicitly in the file.
