# Training & Onboarding Materials

This covers Step 4 — the content that goes into the User Adoption Enablement Package. The goal is that a new end user can start working with the system on day one without either blindly trusting it or reflexively distrusting it — both failure modes kill adoption.

## Structure by audience

Not everyone needs the same depth. Build at least two tracks:

- **End users** — people who interact with the system's outputs or receive its actions day to day. They need: what it does well, what it gets wrong and how often, how to spot a wrong answer and exactly how to override or escalate.
- **Approvers/reviewers** — anyone holding Review or Approval authority from the decision-authority mapping. They need everything end users get, plus: what the reasoning-path and confidence information actually means, how to read it quickly and what "when in doubt" defaults to (usually: escalate, don't guess).

If the org has a champions/admin layer, give them a third track covering the full decision-authority thresholds and how to adjust them.

## Required content

1. **Capabilities and limitations, in plain language.** Pull this from what Step 0's priming actually revealed about the system — its real action inventory, its real integrations — not a generic "AI can make mistakes" disclaimer. Specific beats generic: "This system can draft and send routine account-update emails automatically; it cannot issue refunds without your approval" is far more useful than "the AI has limitations."

2. **Known edge cases and failure modes.** Document the situations where the system is known to struggle — ambiguous inputs, out-of-scope requests, data it wasn't trained/configured to handle well. If none are known yet because this is a new system, say so and commit to updating this section as real edge cases surface (tie this to the feedback loop in Step 6).

3. **Override and rollback controls, as a walkthrough.** Not just "you can override it" — the actual click-by-click or step-by-step path: where the override button/command lives, what happens when you use it, whether it's logged and whether it teaches the system anything (or whether that's a separate, explicit feedback step).

4. **"When in doubt" guidance.** A short, memorable rule for what a user should do when they're unsure whether to trust an output — usually pointing them to escalate rather than either blindly accept or blindly reject.

## Format

Default to a Word document (or the format the user requests) with a short, skimmable structure — end users won't read a long governance document. Favor:
- A one-page capabilities/limitations summary up front
- Edge cases as a scannable list, not prose paragraphs
- Screenshots or concrete UI references where the interface is known, so the walkthrough isn't abstract

If the org has an LMS or existing onboarding format, ask whether the content should be adapted to fit it rather than delivered as a standalone document.
