# Token Ledger: Accounting and Concurrency

Read this for how tokens are stored, credited, reserved, spent and reconciled. The properties to guarantee: **no lost or double updates, no overspend under concurrency and a balance that always equals the sum of the ledger.**

## Contents
1. Decide first
2. Schema
3. Crediting
4. Spending: reserve, then settle
5. Making updates race-safe
6. Expiry and spend order
7. Adjustments and support actions
8. Reconciliation
9. Verify

## 1. Decide first (owner commitments)

- Unit: what one token is and how usage maps to it (input/output tokens, per call, per tool). Rounding rule.
- Overspend policy: block at zero, or allow negative balance up to a limit; what happens to in-flight streaming responses when the balance runs out.
- Reservation size: how much is held before a call (a maximum, a per-model estimate, or the user's cap) and how long an unsettled reservation lives.
- Expiry: do purchased or granted tokens expire and after how long.
- Spend order when there are several buckets (free vs. purchased, expiring first).
- Whether balances belong to a user or a shared team account.

## 2. Schema

Adapt to the app's database and migration tool. Concepts, not names:

- **Ledger table (append-only):** id, account id, entry type (purchase, spend, refund, dispute hold, dispute release, adjustment, expiry, reservation, release), signed integer amount, a **source type and source id** (for example checkout session id, refund id, request id), timestamp and optional metadata (pack id, model, request id). Never update or delete rows; corrections are new entries.
- **Unique constraint on (source type, source id, entry type)** so any business event can affect the ledger once. This is the last line of defense for idempotency.
- **Balance:** a cached integer per account, updated in the same transaction as each ledger insert, so reads are cheap. The ledger is the source of truth; the cached balance is verified against it (section 8).
- **Processed events table** from `webhooks.md` (unique event id).
- **Reservations** (if used): id, account id, reserved amount, status (open, settled, released, expired), request id, created and expiry times.
- Integer columns only, sized for the largest realistic balance.

## 3. Crediting

In the webhook transaction (`webhooks.md`): insert the purchase entry keyed on the session id, then increase the cached balance by the same amount, both in one transaction. If the unique constraint rejects the entry, treat it as already credited and do not touch the balance. The balance update and ledger insert must not be separable: either both commit or neither.

## 4. Spending: reserve, then settle

LLM usage is usually known only after the call and calls run concurrently. To avoid overspend without holding a lock for a whole request:

1. **Reserve** the maximum the call can consume: atomically decrease available balance and record a reservation. If the balance is insufficient, refuse before calling the model (or apply the owner's overspend policy).
2. **Call** the model.
3. **Settle** with actual usage: in one transaction, record the spend entry, release the unused portion of the reservation back to the balance and mark the reservation settled. Keyed on the request id so a retried settle is a no-op.
4. **On failure or abort**, settle what was actually consumed (partial streams cost real money) and release the rest.
5. **Sweep stale reservations:** a scheduled job releases reservations that outlived their expiry (process crash, lost connection), after checking whether usage was recorded. Choose the expiry with the owner; too short releases tokens for calls still running, too long locks funds.

Simpler alternatives (charge after the fact with a debt allowed) are legitimate if the owner accepts the exposure; record that choice.

## 5. Making updates race-safe

Never read the balance, compute in application code and write it back. Two requests interleave and both succeed against the same funds. Choose by database:

- **Relational with row locks (Postgres, MySQL/InnoDB):** a single conditional statement that decrements only if enough remains and reports rows affected (zero means insufficient funds), or a transaction that locks the account row (`SELECT ... FOR UPDATE`) before reading and writing. Use one approach consistently. Set an appropriate isolation level and check it against the engine's documented behavior rather than assuming.
- **SQLite:** writers are serialized; use an immediate-write transaction so the read-check-write cannot interleave and keep transactions short. Note the limits for multi-process deployments.
- **Document/key-value stores (DynamoDB, MongoDB, Redis):** use the store's conditional or atomic operations (conditional writes, atomic increments with a guard, transactions) rather than get-then-put; for Redis, atomic scripts. Check that the ledger and balance change share one atomic unit, or design for recovery when they do not.
- **Multiple services touching balances:** funnel all changes through one module or service; direct SQL from elsewhere bypasses the guarantees.

Deduct and record in the same transaction. Retry a transaction on serialization or deadlock failure with a bound and make the retried operation idempotent by its source id.

## 6. Expiry and spend order

If tokens expire or come in buckets: model each grant as its own row with an amount remaining and an expiry, spend from the earliest-expiring bucket first (or the order the owner chooses) and let a scheduled job write expiry entries. The single cached balance then equals the sum of unexpired remaining amounts. This is materially more complex; do not build it unless the owner requires it.

## 7. Adjustments and support actions

- Manual credits or debits are ledger entries with a reason, actor and a required note; never a direct edit of the balance.
- Restrict them to authorized staff and log every one.
- Support can see the ledger and purchase history for an account to answer "where did my tokens go".

## 8. Reconciliation

- A scheduled job checks, per account, that the cached balance equals the ledger sum and flags drift. Drift means a bug or an out-of-band write; alert and do not auto-correct silently.
- Compare recent paid Stripe sessions against purchase entries and refunds against refund entries to catch missed webhooks; report differences for a human or replay the missing events.
- Report open reservations older than their expiry.
- Run at a cadence the owner sets; after launch, daily is typical.

## 9. Verify

- N concurrent spends against a balance of B never spend more than B in total and the balance never goes negative unless permitted. Use enough parallelism to expose races, against the real database engine.
- Concurrent spend plus concurrent credit on one account preserves the ledger-sum invariant.
- A retried settle or a replayed credit changes nothing the second time.
- A crash between reserve and settle leaves a reservation the sweeper releases, without double-charging.
- Ledger sum equals cached balance after every test scenario.
- A direct edit of the balance is impossible through the application's interfaces.
