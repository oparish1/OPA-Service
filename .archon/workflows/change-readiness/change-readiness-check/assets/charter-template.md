# Human-AI Collaboration Charter — structure

This is the governance document, meant to be reviewed and signed off by the business owner. Build it as a Word document using the docx skill. Use this outline as a starting structure, adapted to what Steps 0–6 actually surfaced — don't leave placeholder-sounding text if real detail is available.

---

**Title page / header:** System name, version, business owner, date, review/renewal cadence (e.g., "review at 90 days or upon material change").

## 1. Purpose and Scope
- What this system does, in one paragraph, grounded in the priming output (not marketing language)
- What's explicitly out of scope

## 2. Decision-Authority Boundaries
- The full action inventory (from Step 0/2), each assigned to Autonomous / Human Review / Human Approval
- The concrete thresholds that govern escalation between tiers (confidence cutoffs, dollar amounts, reversibility, data sensitivity — as defined in Step 2)
- Table format works well here; one row per action or action family

## 3. Hand-off Protocols
- For each tier boundary: what the human sees, where, what happens if no one responds, how to escalate further

## 4. Auditability & Transparency Standards
- What is logged for every action (reasoning path, confidence, tool execution, actor, timestamp)
- Who can see what, in real time vs. retrospectively
- Retention policy and compliance alignment, if applicable

## 5. Accountability Framework
- The RACI mapping across business owner, AI/system owner, end users, and compliance/legal
- Explicit liability language: the business owner retains governance and accountability for outcomes within approved boundaries; the system owner is responsible for remediation when the system operates outside them

## 6. Incident Response
- What counts as an incident for this system
- Who is notified, in what order, and within what timeframe
- Where this ties back to the accountability framework above

## 7. Review & Change Management
- Cadence for reviewing thresholds against the telemetry in Section 8
- Process for amending the Charter (who approves changes, how they're versioned)

## 8. Adoption Metrics & Telemetry (summary)
- The metrics being tracked (override rate, escalation frequency, trust/satisfaction, incident rate) and where they're reviewed — full detail lives in the Enablement Package, this section is the governance-level commitment to track them

**Sign-off block:** Business owner name/title/date; AI/system owner name/title/date.
