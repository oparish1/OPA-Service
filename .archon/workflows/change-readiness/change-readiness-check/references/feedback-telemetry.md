# Feedback Loops & Telemetry

This covers Step 6. The Charter and training materials establish the starting state; this section is how the org finds out whether adoption is actually working over time and adjusts.

## Core metrics

Pick metrics that are both meaningful and actually instrumentable given what Step 0 revealed about the org's tooling — don't propose a metric nobody can measure.

- **Manual override rate** — how often humans reverse or reject an AI action, broken down by action type and by tier (Autonomous actions caught after the fact vs. Review actions overridden vs. Approval requests rejected). A high or rising override rate on a specific action type is the clearest signal that its tier or thresholds need revisiting.
- **Escalation frequency** — how often actions cross from Autonomous into Review/Approval due to confidence or threshold triggers and whether that rate is stable, rising, or falling as the system and users mature.
- **Time-to-first-trust** — a rough measure of how long it takes a new end user to stop double-checking every output (can be self-reported via a short survey at 1 week / 1 month, or inferred from override-rate decay per user over their first weeks).
- **Operational trust / satisfaction** — a short, recurring pulse survey (2–4 questions) rather than a one-time launch survey, so trust can be tracked as a trend, not a snapshot.
- **Incident rate and severity** — tie back to the accountability framework's incident-response row; track not just count but whether root causes are recurring.

## Feedback channels

Define at least one lightweight, low-friction channel for end users to flag friction or bad outputs in the moment (not a quarterly survey as the only channel) — e.g., a reaction/flag on the specific output, routed to whoever owns the system. Specify:
- Who reviews incoming feedback and how often
- What happens to it (does it feed threshold adjustments, training data, the edge-cases doc, or all three)
- How users find out their feedback led to a change — this closes the loop and is often what actually drives adoption, more than the initial training

## Review cadence

State an explicit cadence for the business owner and system owner to review these metrics together (e.g., weekly during pilot, monthly after general rollout) and revisit the decision-authority thresholds if override or escalation rates suggest they're miscalibrated. Treat the Charter's thresholds as a living agreement that gets re-approved when metrics justify a change, not a one-time document.
