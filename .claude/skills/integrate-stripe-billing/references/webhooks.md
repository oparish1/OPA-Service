# Webhooks: Signature, Idempotency, and Fulfillment

The webhook is the only place tokens are credited. Read this whenever an endpoint receives Stripe events. Every point below is a property that `verification.md` tests.

## Contents
1. Decide first
2. The endpoint contract
3. Signature verification
4. Idempotency
5. Ordering and duplicates
6. Fulfillment logic
7. Failure and retry behavior
8. Operations
9. Verify

## 1. Decide first

- Which events the integration handles. Start from the minimum: the checkout completion event, the delayed-payment success and failure events (if delayed methods are enabled), the refund event, and the dispute events. Look up the current event names in Stripe's documentation and cite them in the work order; subscribe the endpoint only to the events the code handles.
- Whether processing runs inline or via a queue. Default to inline for a short, single-transaction credit; use a queue only when handlers are slow, and only after the event is durably recorded.
- Where the endpoint lives and how it is reachable in each environment (public URL for live; the Stripe CLI forwarder for local development).

## 2. The endpoint contract

- A dedicated route, public, with **no session, login, or CSRF requirement**. Its only authentication is the signature.
- Reads the **raw request body bytes**. Global JSON-parsing middleware must be bypassed or configured to expose the raw body for this route, because verification is computed over the exact bytes Stripe sent. A re-serialized body fails verification. Confirm this against the app's framework in Step 0.
- Returns quickly. Do the durable write, then respond; Stripe treats slow responses as failures and retries.
- Response codes: 2xx only after the event is safely handled or safely recorded as already handled; 4xx for a bad signature or malformed request; 5xx for a transient failure so Stripe retries.
- Never log the full payload (it may contain personal data); log the event id, type, and outcome.

## 3. Signature verification

- Use Stripe's official library function for constructing an event from the raw body, the `Stripe-Signature` header, and the endpoint's signing secret. Do not write your own HMAC comparison.
- Reject with 4xx when the header is missing, malformed, or wrong, or the timestamp is outside the tolerance window. The default tolerance is short; do not widen it to "make tests pass".
- The signing secret is per endpoint and per environment. Multiple endpoints (test and live, or old and new during rotation) have different secrets.
- Rotation: plan how the secret is rotated without dropping events (Stripe supports a rollover period; check current documentation) and who does it.
- Never add a "skip verification in dev" flag that can reach production. Use the Stripe CLI, which produces validly signed events locally.

## 4. Idempotency

Stripe delivers each event at least once and may deliver it again after a timeout, a 5xx, or an unrelated network problem. Protect at two layers:

1. **Event ledger.** A table of processed events with a **unique constraint on the event id**. The handler inserts the id first, inside the same database transaction as the effect. A unique-violation means the event was already handled: return 2xx and do nothing. Two concurrent deliveries of the same event race to insert; exactly one wins.
2. **Effect key.** The credit itself is also keyed on a business identifier — the checkout session id (or payment intent id) — with a unique constraint on the ledger entry (`token-ledger.md`). This is necessary because **different events can describe the same payment** (for example a completion event and a later delayed-payment-succeeded event for one session), and dedupe on event id alone would credit twice.

The event insert and the ledger credit commit together or not at all. If the process dies between them, neither exists and the retry does the whole job.

Outbound calls that create money-affecting objects (refunds, sessions) carry an idempotency key so a retried request cannot execute twice.

## 5. Ordering and duplicates

- Events can arrive out of order (a refund event before the completion event is uncommon but possible) and more than once.
- Do not assume the payload is the latest state. For decisions that depend on current state (payment status, amount refunded), fetch the object from the API by id, or design handlers so any order converges on the same final ledger.
- A handler that receives an event about an unknown purchase (no matching user, session never recorded) must not crash silently: record it, alert, and return a response that lets a human investigate; do not credit an unidentifiable account.
- Ignore event types the code does not handle with a 2xx.

## 6. Fulfillment logic

For the checkout completion path, in one transaction:
1. Verify the signature (before any database work).
2. Insert the event id (unique). On conflict, return 2xx.
3. Check that the session's payment status is actually **paid**. A completed session with an unpaid status (delayed method still pending) must not credit; wait for the success event, and handle the failure event by recording the failed purchase without credit.
4. Identify the account from the session's reference field; verify the account exists.
5. Determine the tokens to grant from the **server-side pack definition** for the pack id (or from the recorded pending purchase), not from a client-supplied or metadata number that could be stale; compare to any expected amount in metadata and alert on mismatch.
6. Insert the ledger credit keyed on the session id (unique) and update the cached balance atomically.
7. Commit, then respond 2xx.

Side effects that cannot be rolled back (emails, analytics) happen after commit and must themselves tolerate replay.

## 7. Failure and retry behavior

- If anything fails before commit, return 5xx; Stripe retries with backoff for an extended period. Confirm the current retry schedule in the documentation and make sure the owner knows how long recovery is automatic.
- A **poison event** (one that always fails) must alert rather than retry silently forever; provide a way to replay a specific event from the dashboard or by id after the bug is fixed.
- After a long outage, use Stripe's event list or the dashboard to find undelivered events, and provide a reconciliation job that compares recent paid sessions to ledger credits (`token-ledger.md`).

## 8. Operations

- Alert on repeated non-2xx responses, signature failures spiking, and events that hit the unknown-account path.
- Keep the processed-events table for at least as long as Stripe can redeliver, and longer if the owner wants an audit trail; do not prune it aggressively.
- Local development: use the Stripe CLI to forward events and trigger test events; note that triggered fixtures have synthetic ids and may not match your accounts, so tests should craft realistic payloads too.

## 9. Verify

- A request with no header, a wrong secret, a tampered body, or an old timestamp is rejected and changes nothing.
- The endpoint passes when the framework's JSON middleware is active elsewhere (raw body preserved for this route).
- Replaying one event 10 times, sequentially and concurrently, credits exactly once.
- Two different events for the same session credit exactly once.
- A crash injected after the event insert but before commit leaves no partial state, and the retry succeeds.
- An unpaid or async-pending session credits nothing until success arrives.
- An unknown-account event alerts and credits nothing.
