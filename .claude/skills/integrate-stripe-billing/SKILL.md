---
name: integrate-stripe-billing
description: Plans and verifies a Stripe integration for token-based (prepaid credit) billing in an existing application — checkout UI, webhook handling, a race-safe token ledger, refunds and disputes and environment configuration — by reading the codebase first, interviewing the owner on pricing and refund policy, writing an implementation-ready work order and later producing a verification report on webhook signature checking, idempotency and concurrency safety. Framework-agnostic; adapts to the frontend, backend and database it finds. Use whenever the user asks to integrate Stripe, add token billing or credits, set up payments, add a checkout or "buy tokens" flow, meter or charge for LLM or agent usage, handle Stripe webhooks or refunds, or review or verify an existing Stripe integration before going live — even if they only say "let people pay for usage".
metadata:
  arguments: "[output-dir] [jira-issue-keys] [confluence-page-ids]"
---

# Integrate Stripe Billing

## Objective

Payment code fails quietly and expensively. A webhook Stripe retries twice credits twice. Two concurrent LLM calls both spend the same balance. A refund leaves the tokens spendable. A browser redirect grants credit that a failed payment never earned. A body-parsing middleware silently breaks signature verification and someone "fixes" it by turning verification off. This skill gets the decisions right first — what the app is, how it spends, what the owner has committed to — and then proves the three properties that matter before anyone calls the integration production-ready: **signature verification, idempotency and race-safe accounting.**

**Governing rule: every price, pack size, currency, tokens-per-unit, expiry, refund rule and negative-balance policy is a commitment the owner will be held to. Get them from the owner, not from what sounds reasonable.** Where the owner has not decided, record the item as *unresolved* with a labelled suggestion; never write a guess in as if it were decided. Second rule: **the skill never declares "production-ready" on its own say-so.** It reports what tests proved and what remains manual.

## Arguments

`integrate-stripe-billing [output-dir] [jira-issue-keys] [confluence-page-ids]`. Write deliverables to the output directory; if none was given, ask before Step 5 — do not guess a path. Jira/Confluence arguments are forwarded to `prime-codebase` in Step 0.

## Two modes

- **Plan mode (default):** Steps 0–5. Produces a work order for the delivery workflows (`archon-ship`: triage, plan, deliver). Money code is high-stakes and multi-phase, so the skill does not build it in one pass; the human gate stays at pull-request review.
- **Verify mode:** Step 6. Used when the integration already exists (built from a work order, or by hand) and the user wants it reviewed or confirmed ready. Produces a verification report. If the user asks to build directly, still write the work order first, then implement phase by phase against it, then run Step 6.

## Process

### Step 0: Prime on the existing codebase

Invoke the **prime-codebase** skill (forwarding any Jira/Confluence arguments); if unavailable, do the equivalent by hand. Establish from the code, not the user's description:

- **Stack:** frontend framework, backend framework and language, package manager. Everything proposed must fit it.
- **Database and migrations:** engine (this decides the locking strategy in `token-ledger.md`), migration tool, existing user/account/organization model and whether billing attaches to a user or a team.
- **Existing payment code:** any Stripe SDK, keys, webhook route, or half-built billing. Extend or replace deliberately; never build a second system beside a live one.
- **Where usage happens:** every call site that consumes tokens — LLM calls, agent steps, tool calls, streaming responses, background jobs. Note where actual usage becomes known (often only after a response completes) and where a request can be aborted midway.
- **Auth:** how the current user is identified on requests; checkout creation must be authenticated.
- **Request pipeline:** body-parsing middleware and CSRF protection, because the webhook needs the raw body and no CSRF check.
- **Background work:** a job queue or scheduler (needed for reservation cleanup and reconciliation).
- **Config and secrets:** how environment variables and secrets are managed per environment.
- **Tests:** framework and whether tests can run against the real database engine (required for the race tests).

Summarize findings back to the user before continuing.

### Step 1: Interview the owner

Ask rather than assume; use a chat-native elicitation tool if available. Cover:

1. **Model:** prepaid token packs, subscription with a monthly allowance, pay-as-you-go metering, or a mix. Ask why; it changes the design. Check Stripe's current documentation for its own metering and credit features before committing to a custom ledger and tell the owner what is gained or lost either way.
2. **Packs and prices:** sizes, price per pack, currency and whether prices vary by region.
3. **Tax:** whether tax must be collected and whether Stripe's tax feature is in scope.
4. **Token accounting:** what one token means; how usage maps to tokens (per input/output token, per call, per tool); what happens at zero balance mid-request; whether negative balance is ever allowed.
5. **Expiry and grants:** do purchased tokens expire; are there free or promotional tokens; which are spent first.
6. **Refund policy:** who can refund, full or partial and whether tokens already spent affect the refund; what happens to remaining tokens.
7. **Disputes and fraud:** who handles chargebacks and what happens to the balance while one is open.
8. **Who pays:** individual user or team/organization account.
9. **Accounts and environments:** who owns the Stripe account, test vs. live keys and where webhook endpoints will be reachable.
10. **Receipts and support:** invoices/receipts, purchase history in-app, support contact for billing problems.

If a dimension goes unanswered, mark it *unresolved* in the work order. Do not fill it in.

### Step 2: Choose the design

Explain trade-offs in the codebase's own terms. Unless the owner decides otherwise, the defaults are:

- **Stripe-hosted Checkout** for taking payment, so card data never touches the app (`references/checkout.md`).
- **Fulfillment only from verified webhooks**, never from the browser redirect (`references/webhooks.md`).
- **An append-only token ledger** with a cached balance updated atomically in the same transaction and **reserve-then-settle** accounting around each LLM call (`references/token-ledger.md`).
- **Refunds and disputes driven by Stripe events**, so refunds issued from the dashboard are handled too (`references/refunds-and-disputes.md`).

State what is in this work order and what is deferred (for example, subscriptions or invoicing). One correct flow beats four half-built ones.

### Step 3: Load the reference for each piece

Read only what applies.

- Checkout, server-side session creation, frontend UI, environment configuration: `references/checkout.md`
- Webhook endpoint, signature verification, idempotency, ordering, failure handling: `references/webhooks.md`
- Ledger schema, balance updates, concurrency, reservations, expiry, reconciliation: `references/token-ledger.md`
- Refund flow, partial refunds, spent tokens, disputes: `references/refunds-and-disputes.md`
- Verification recipes, the report template and the production-ready rule: `references/verification.md`

**Stripe details drift.** API versions, event names, SDK method signatures, dashboard paths and feature availability change. The references carry principles and the questions to ask; look up every specific call, event and parameter in the current Stripe documentation and cite it in the work order rather than trusting memory. Pin the API version the integration is built against.

### Step 4: Apply the cross-cutting baseline

The work order covers each item, or states why it does not apply:

- **Amounts and tokens:** integers only (currency minor units for money, whole tokens for balances); never floating point. The server decides price and token quantity from a pack identifier; it never trusts a client-supplied amount.
- **Secrets:** secret key and webhook signing secret in the secrets manager or environment, never in the repository, client bundle, or logs. Test and live keys are separate per environment and each webhook endpoint has its own signing secret.
- **Authentication and authorization:** only an authenticated user can start checkout for their own account; only authorized staff can issue refunds or adjustments.
- **Webhook endpoint:** raw-body signature verification, no session/CSRF requirement, fast 2xx after a durable write, non-2xx on failure so Stripe retries.
- **Idempotency:** at every layer — event processing, credit application, refund creation and outbound API calls.
- **Race safety:** balance changes are atomic conditional operations; the invariant *ledger sum equals balance and balance never goes negative unless the owner allows it* is testable.
- **Audit and observability:** log purchase, spend, refund, dispute and adjustment with ids (never card data, secrets, or full payloads); alert on webhook failures and reconciliation drift.
- **Failure UX:** payment succeeds but webhook is late; webhook fails; user closes the tab; zero balance mid-request. Each has defined behavior.
- **Compliance:** hosted Checkout keeps card data off the servers; the owner still owns tax, terms, refund disclosure and privacy obligations. Flag these as owner questions, not answers.
- **Tests:** the Step 6 checks exist as automated tests, run against the real database engine.

### Step 5: Produce the work order

Write `stripe-billing-work-order.md` to the output directory, shaped as a contract the delivery workflows can act on without asking questions:

1. **Problem** — what billing does not exist or is unsafe today, grounded in Step 0.
2. **Why / why now** — the owner's reasons from Step 1.
3. **Outcome** — what becomes observably true, listing what is in scope and what is deferred.
4. **Invariants** — no double credit, no negative balance (unless permitted), existing users and data unaffected, raw-body verification intact.
5. **Acceptance** — testable statements, each mapped to a check in `references/verification.md`.
6. **Decisions and commitments** — a table with one row per number or policy: value, source (`owner` or `unresolved`) and the owner's words or the question that resolves it.

Then add: the chosen libraries and the pinned Stripe API version; files and seams the change touches (verified against the code, marked *new* where they do not exist); a phased order of work with each phase independently verifiable (suggested: schema and ledger, then checkout, then webhooks, then spend hooks, then refunds and disputes, then reconciliation and alerts); risks and rollback, including how to disable purchasing and spending without corrupting balances; the live-mode cutover checklist; and the out-of-scope list.

Hand the file to the delivery workflows — triage, plan, deliver.

### Step 6: Verify (verify mode, or after delivery)

Read `references/verification.md`. For each claim — signature verification, idempotency, race-safe accounting, refund correctness, reconciliation — run the named test against the real database engine, record the result and evidence and mark each claim **proven**, **partially proven**, or **manual** (needs a real Stripe test-mode event or a live check that cannot run here). Write `stripe-verification-report.md` using the template. The report may say **ready for live cutover** only when every critical claim is proven and the manual checks are listed with clear steps for the owner. Otherwise it says **not yet** and names exactly what blocks it. If tests cannot be run, say so and list what remains unverified; never imply a pass that did not run.

## When the request is narrower

"Add a webhook handler", "make our token deduction race-safe", or "review our refund logic" does not need every step. Still do Steps 0 and 1 in short form (you need the real database and usage path), then go to the relevant reference and Step 4's checks and produce a smaller work order or a focused review. Say when you are scoping down.

## Do not

- Do not grant tokens from the success redirect or any client-side signal.
- Do not trust a client-supplied price, amount, or token quantity.
- Do not parse the webhook body before verifying its signature over the raw bytes and never disable verification to make something work.
- Do not keep balance only as a mutable number with no ledger, or update it with read-then-write logic.
- Do not use floating point for money or tokens.
- Do not put keys or signing secrets in the repository, client code, logs, or the chat.
- Do not copy Stripe call signatures, event names, or feature claims from memory; look them up.
- Do not declare the integration production-ready without the evidence in Step 6.
