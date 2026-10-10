# Auditability & Transparency Standards

This covers Step 3. The goal is a system where a human operator can always answer three questions after the fact: what did the AI do, why did it do that, and could it have been stopped sooner.

## What must be captured

For every action the AI takes (not just Approval-tier ones — Autonomous actions need this too, since that's exactly the tier nobody's watching in real time):

- **Inputs** — what triggered the action and what data it had access to
- **Reasoning path** — a human-readable account of why the AI chose this action over alternatives. This doesn't need to be a raw chain-of-thought dump; it needs to be enough for a reviewer to sanity-check the decision without re-deriving it themselves
- **Confidence score**, if the underlying system produces one — and if it doesn't, say so plainly in the Charter rather than implying a false precision
- **Tool/action execution log** — exactly what was called, with what parameters, and what came back, including failures and retries
- **Outcome** — what actually happened downstream, where that's knowable (did the email send, did the payment clear)
- **Actor and timestamp** — which instance/version of the system acted, and when

## Visibility, not just retention

A log that exists but that no one is looking at doesn't create accountability — it creates a paper trail for after the fact. Distinguish two audiences and design for both:

- **Real-time visibility** for whoever holds Review or Approval authority on a given action (Part 1 of the decision framework). This needs to show up where they already work — see the hand-off protocol section — with enough context to act in seconds, not require them to dig through raw logs.
- **Retrospective visibility** for the business owner and compliance, at a cadence that matches the stakes (weekly spot-checks for lower-stakes systems, near-real-time dashboards for higher-stakes ones). This is where override rates, escalation patterns, and incident trends get reviewed in aggregate.

## Practical logging guidance

- Reuse existing observability infrastructure from Step 0's priming rather than standing up a parallel system — if the codebase already has structured logging, application monitoring, or an audit table, extend it.
- Log retention should match the org's compliance requirements where they exist (finance, health, legal contexts often mandate specific retention windows) — flag this as a question for compliance/legal rather than guessing a number.
- Reasoning-path logs should be tied to the specific decision they explain, not aggregated into a general activity feed — a reviewer investigating one incident shouldn't have to search.
- If the system is a multi-step agent, log at each meaningful step, not just the final action — the "why" of an eventual action is often set several steps earlier.

## What goes in the Charter vs. what goes in implementation

The Charter states the *standard* (what must be logged, who can see it, at what cadence, retained for how long). It should not need to specify the exact database schema or dashboard tool — that's an implementation detail for the AI/system owner to satisfy the standard. Keep the Charter durable even if the underlying tooling changes.
