# Verification and the Production-Ready Rule

Read this in Step 6, or whenever reviewing an existing integration. The purpose is to replace "it looks right" with evidence for the three properties that decide whether money code is safe: **signature verification, idempotency and race-safe accounting.**

## Contents
1. Ground rules
2. Checks
3. What cannot be proven here
4. Live cutover checklist
5. Report template
6. The rule for saying "ready"

## 1. Ground rules

- Run tests against the **real database engine and version the app uses in production**. Race and constraint behavior differs between engines; an in-memory fake or a mocked repository proves nothing about concurrency.
- Exercise the real webhook route through the real HTTP stack and middleware, so raw-body handling is tested, not bypassed.
- Generate validly signed test payloads with the Stripe library and the test signing secret, or use the Stripe CLI where available; craft realistic payloads too, since CLI fixtures carry synthetic ids.
- Use enough parallelism and repetition that a race would show; a single-threaded "concurrent" test passes for the wrong reason.
- If a check cannot be run in the current environment, mark it **manual** and give exact steps. Never write "passed" for something that did not run.
- Prefer turning each check into an automated test that stays in the repository, so regressions are caught later.

## 2. Checks

Critical checks (C) must be proven before cutover; the rest (R) are strongly recommended.

**Signature verification**
- C1. No `Stripe-Signature` header: rejected with 4xx, no database change.
- C2. Wrong signing secret: rejected, no change.
- C3. Valid signature but body modified after signing: rejected.
- C4. Timestamp outside the tolerance window: rejected.
- C5. Body parsed or re-serialized by middleware (simulate the app's JSON middleware active): the genuine event still verifies.
- R1. Verification cannot be disabled by any environment flag in production configuration.

**Idempotency**
- C6. The same event delivered 10 times sequentially credits exactly once and returns 2xx each time.
- C7. The same event delivered concurrently (many parallel requests) credits exactly once.
- C8. Two distinct events describing the same checkout session (completion and delayed-payment success) credit exactly once.
- C9. Crash or exception injected after the event record is written but before commit: no partial state; the retry completes the credit.
- C10. An unpaid or still-pending session credits nothing; the later success event credits once.
- R2. Outbound refund and session creation calls carry idempotency keys; repeating the request does not duplicate.
- R3. An event for an unknown account credits nothing and raises an alert.

**Race-safe accounting**
- C11. N parallel spends against balance B: total spent never exceeds B and the balance never goes below zero (or the owner's limit).
- C12. Parallel spends interleaved with credits and refunds preserve: ledger sum equals cached balance.
- C13. A replayed spend or settle keyed on the same request id applies once.
- C14. A reservation abandoned by a crash is released by the sweeper without double charge.
- C15. No code path updates the balance except through the ledger module (search the code; record the result).

**Refunds and disputes**
- C16. Full refund reverses exactly the granted tokens once, including on replay and concurrent delivery.
- C17. Partial refunds accumulate correctly; replay of any event is a no-op.
- C18. Refund after spending follows the owner-approved policy and the resulting balance matches.
- R4. Dashboard-originated refund (event with no matching app request) updates the ledger.
- R5. Dispute open, won and lost paths hold and release tokens once.
- C19. Only authorized roles can trigger refunds and adjustments.

**Checkout and configuration**
- C20. The success page and any client-side signal cannot credit tokens.
- C21. The client cannot alter price, currency, or token quantity.
- C22. No secret key or signing secret appears in the client bundle, repository history in scope, or logs.
- R6. Startup fails clearly on missing or mismatched (test vs. live) configuration.

**Operations**
- R7. Reconciliation job detects a deliberately introduced drift and a deliberately missed webhook.
- R8. Alerts exist for repeated webhook failures and reconciliation drift.

## 3. What cannot be proven here

State plainly, in the report, which items need the owner's environment:
- Real delivery from Stripe to the deployed endpoint (public URL, TLS, firewall, correct endpoint secret).
- Behavior with delayed payment methods, real declines and 3-D Secure flows, unless the owner exercises them in test mode.
- Dispute evidence workflow and deadlines.
- Production monitoring and paging paths.
- Anything depending on the live account's settings (tax, payment methods, branding).

Give each a concrete manual procedure: the Stripe CLI or dashboard steps to trigger it and what result to expect. Look up the current CLI commands in Stripe's documentation rather than writing them from memory.

## 4. Live cutover checklist

Owner-run, in order; each item is a yes/no in the report:
1. Live keys installed in the production secret store; test keys removed from production.
2. Live webhook endpoint registered with only the handled events; its signing secret installed.
3. Pinned API version matches what was tested.
4. Prices, packs and tax settings in the live account match the work order's decisions table.
5. A small real purchase completes, credits once and appears in the ledger and reconciliation.
6. A real refund of that purchase reverses the tokens once.
7. Webhook delivery dashboard shows 2xx; alerts fire on a forced failure in a safe way.
8. Rollback path tested: purchasing and spending can be disabled without corrupting balances.
9. Support knows where to see the ledger and how to process a dispute.

## 5. Report template

Write `stripe-verification-report.md`:

```
# Stripe billing verification report
Integration: <app, commit or PR>    Date: <date>    Stripe API version: <pinned>
Database engine/version tested: <...>    Test environment: <...>

## Verdict
<Ready for live cutover | Not yet>  — one-sentence reason.
Blocking items: <list, or none>

## Results
| ID | Claim | Test (name/path) | Result | Evidence | Status |
| C1 | Missing signature rejected | <test> | pass/fail | <output ref> | proven / partial / manual |
... one row per check ...

## Not verified here
<each item, why and the manual procedure to verify it>

## Findings
<severity, location, what is wrong, fix>

## Decisions still unresolved
<from the work order's decisions table>

## Cutover checklist status
<the nine items with yes/no/not started>
```

## 6. The rule for saying "ready"

The verdict may be **Ready for live cutover** only if every critical check (C1–C22 that apply) is **proven** by a test that actually ran against the real database engine, no finding above low severity is open, the work order's decisions are all resolved and the manual items are listed with owners. If any critical check is partial, failed, or manual, the verdict is **Not yet**, with the blocking items named. Do not soften this to please a deadline; state the exposure in plain terms (for example, "concurrent spends can overspend by up to N tokens") so the owner can make the call knowingly.
