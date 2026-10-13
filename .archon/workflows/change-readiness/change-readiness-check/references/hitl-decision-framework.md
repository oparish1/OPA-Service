# HITL Decision Framework: Authority Boundaries, Hand-offs and Accountability

This is the core framework for Steps 2 and 5 of the readiness check. It has two parts: classifying actions into authority tiers with real thresholds and mapping who's accountable when things go right or wrong.

## Part 1: The three authority tiers

Every distinct action the AI system can take belongs in exactly one tier. Resist the temptation to put a whole feature or module in one tier — classify at the level of the individual action, because a single feature (e.g., "customer support assistant") often spans all three.

| Tier | Definition | Human's role | Typical examples |
|---|---|---|---|
| **Autonomous** | AI acts without human involvement in the loop | None in real time; humans may audit in aggregate later | Drafting internal summaries, read-only lookups, low-stakes categorization, generating a first-pass answer the human will see before acting on it anyway |
| **Human Review** | AI acts, but a human can see the action and override or roll it back within a defined window | Reviewer, after or in parallel; has override authority, not veto-before-the-fact | Sending a routine customer email that's logged and reversible, updating a low-risk internal record, scheduling |
| **Human Approval** | AI proposes; a human must explicitly approve before the action executes | Approver, before the fact; nothing happens without a yes | Payments/refunds above a threshold, anything that modifies a legal or contractual document, irreversible deletions, customer-facing commitments, production deployments |

### Choosing thresholds, not vibes

For each action, work through these dimensions and let them set the tier — don't assign tiers first and rationalize thresholds after:

- **Reversibility.** Can a human undo this within a reasonable window at low cost? If not, it should not be Autonomous, full stop.
- **Blast radius.** Does this affect one record, one customer, or many? Wider blast radius pushes toward Approval.
- **Financial/legal exposure.** Set an actual number (e.g., "refunds under $50 are Human Review; $50+ requires Approval") rather than "small" vs. "large."
- **Data sensitivity.** Actions touching regulated or sensitive personal data typically warrant at least Review, often Approval, regardless of reversibility.
- **Model confidence, where available.** If the system produces a confidence or reliability score, define the cutoff explicitly (e.g., "below 0.8 confidence, escalate from Autonomous to Review") and say what happens to the action while it waits — does it queue, does it fall back to a safe default, does it block?

Write the thresholds as concrete, testable rules. "Escalate to Approval when confidence < 0.75 OR the action would modify a record touched in the last 30 days by someone other than the requester OR the dollar amount exceeds $500" is usable. "Escalate when the AI isn't sure" is not.

### Hand-off protocol

For every tier boundary, define the mechanics of the hand-off, not just the trigger:

- **What does the human actually see** when an action reaches them? (The proposed action, the AI's reasoning, the confidence score and what happens if they do nothing.)
- **What happens if nobody responds** within the expected window — does the action expire, escalate further, or proceed with a safe default?
- **Can the human delegate or re-escalate** the decision and to whom?
- **Where does this show up** — an inbox, a dashboard, a Slack channel, an in-app queue? Match this to tools the org already uses (see Step 0's priming output) rather than inventing a new surface.

## Part 2: Accountability framework (RACI)

The single most important sentence in the Charter is the one that names who is accountable for AI-driven outcomes. "The system decided" is never an acceptable answer to "who is responsible for this outcome" — build the RACI so that question always has a named answer.

| | Business owner | AI/system owner (eng) | End users | Compliance/legal (if applicable) |
|---|---|---|---|---|
| Setting decision-authority thresholds | Accountable | Consulted | Informed | Consulted (if regulated) |
| Day-to-day operation within Autonomous tier | Accountable | Responsible (for system behavior) | Informed | — |
| Reviewing/overriding Human Review actions | — | Consulted | Responsible | — |
| Approving Human Approval actions | Accountable | — | Responsible (executes approval) | Consulted (if regulated) |
| Incident response when the AI causes harm | Accountable | Responsible (root cause, fix) | Informed | Consulted/Responsible (if regulated) |
| Ongoing monitoring of override rates & trust metrics | Accountable | Responsible (instrumentation) | Consulted (feedback source) | — |

Adjust the columns to the org's actual structure (a small team might collapse "business owner" and "AI/system owner" into one person — say so explicitly rather than leaving the row blank). The point is not the table format, it's that every meaningful decision and every incident scenario has exactly one Accountable party, named by role or title, before launch — not figured out after something goes wrong.

### Liability language for the Charter

State plainly, in the Charter itself:
- The business owner retains governance and liability for outcomes produced within the approved decision-authority boundaries.
- Actions taken outside those boundaries (a bug, a bypassed approval gate, a security incident) shift responsibility to the AI/system owner for remediation, without changing who is accountable to customers/regulators.
- The Charter itself is the record of what was agreed — if thresholds change, the Charter should be versioned and re-approved, not silently edited.
