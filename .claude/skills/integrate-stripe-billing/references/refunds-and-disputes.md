# Refunds and Disputes

Read this for returning money and for chargebacks. The ledger must stay correct in both, including when the refund was started in the Stripe dashboard rather than in the app.

## Contents
1. Decide first
2. Design principle: Stripe events drive the ledger
3. Issuing a refund from the app
4. Handling the refund event
5. Partial refunds and spent tokens
6. Disputes and chargebacks
7. Edge cases
8. Verify

## 1. Decide first (owner commitments)

- Who may refund: support staff only, the user via self-service within a window, or both; and the approval needed.
- Full and partial refunds; whether a refund is allowed after tokens are spent.
- If tokens are spent: refuse, refund only the unspent portion, refund fully and allow a negative balance (debt), or refund fully and suspend the account until repaid.
- Refund window and reasons required.
- What a user sees when refunded (email, in-app message).
- How disputes are handled: who responds with evidence and what happens to the balance while a dispute is open (freeze the disputed tokens, suspend spending, or nothing).
- Whether a lost dispute triggers account action.

## 2. Design principle: Stripe events drive the ledger

Money moved by Stripe is the fact; the ledger follows. Reverse tokens when the **refund event** arrives, not when the app calls the refund API. This means:
- Refunds started in the dashboard, by another integration, or by Stripe (for example after fraud) are reflected.
- A refund API call that times out but actually succeeded is still handled when the event arrives.
- There is one place that reverses tokens, so it cannot happen twice.

## 3. Issuing a refund from the app

- An authenticated, authorized endpoint (staff role, or user self-service under the owner's rules), which records the request, actor and reason.
- Identify the payment to refund by the stored payment intent or charge id from the purchase, never from a client-supplied id.
- Compute the refund amount server-side under the owner's policy (full, or proportional to unspent tokens); enforce that it cannot exceed what remains refundable.
- Call Stripe's refund API with an **idempotency key** derived from the refund request, so a double-click or retry cannot refund twice. Look up the current call in Stripe's documentation.
- Do not change the ledger here. Show the user "refund requested" until the event lands.
- Record a refund-requested state for support visibility.

## 4. Handling the refund event

In the webhook path (`webhooks.md` rules apply: signature, event ledger, atomic transaction):
1. Fetch or read the cumulative refunded amount for the charge, not just the delta in the event.
2. Compute the tokens to reverse for the **newly refunded** portion: cumulative refunded value converted to tokens under the pack's rate, minus tokens already reversed for this payment. This makes duplicate, partial and out-of-order refund events converge.
3. Insert the refund entry keyed on the refund id (or payment id and cumulative step) under the ledger's unique constraint and update the cached balance atomically.
4. Apply the owner's spent-token policy (section 5).
5. Notify the user after commit.

## 5. Partial refunds and spent tokens

Compute what the user still holds from the ledger at event time, not from the original pack size.
- **Enough balance:** reverse the tokens; balance decreases.
- **Insufficient balance (tokens already spent):** apply the policy chosen with the owner:
  - clamp: reverse only what remains and record the shortfall as an unrecovered amount for support;
  - allow negative: post the full reversal and let the balance go negative, blocking further spend until repaid;
  - refuse upstream: prevent the refund from being issued in the first place (only possible for refunds the app itself creates, not dashboard refunds).
- Record which policy applied and the amounts in the ledger metadata so finance can reconcile.
- Refunds of an amount that does not map cleanly to whole tokens need a rounding rule (an owner commitment), applied consistently and never through floating point.

## 6. Disputes and chargebacks

- Subscribe to the current dispute-created and dispute-closed events (confirm names in Stripe's documentation).
- **On creation:** apply the owner's policy, typically place a hold — a ledger entry removing the disputed tokens (or freezing spending) — keyed on the dispute id, with the same idempotency guarantees. Note Stripe withdraws the disputed funds and may charge a fee; that is a finance matter surfaced to the owner.
- **On closure:** if the dispute is won, release the hold with a compensating entry; if lost, convert the hold into a permanent reversal and apply the owner's account policy.
- Provide staff with the information needed to submit evidence (purchase record, usage history from the ledger, timestamps, account identity) within Stripe's deadline; the app should surface the deadline.
- Repeated disputes from one account are a fraud signal; expose a flag for staff.

## 7. Edge cases

- A refund arrives for a payment the app never credited (webhook missed): reverse nothing you never granted; alert and reconcile.
- A refund and a dispute on the same payment: do not reverse the same tokens twice; compute reversal against total funds returned.
- Refund after tokens expired: apply the policy; expired tokens cannot be reversed again.
- Currency and tax: refunded amounts may include tax; token reversal uses the pack price ratio, not the gross amount, unless the owner says otherwise.
- Account deleted before a refund: still process the ledger for audit; skip the notification.
- Concurrent refund event and a spend on the same account: the reversal and spend use the same race-safe update path (`token-ledger.md`).

## 8. Verify

- A full refund reverses exactly the tokens granted, once, even if the event is replayed or concurrent.
- Two partial refunds sum correctly; a replay of either changes nothing.
- A refund after tokens were spent follows the chosen policy and the balance matches the policy's expectation.
- A dashboard-initiated refund (simulated event with no app request) updates the ledger.
- Double-clicking the app's refund button issues one refund.
- A dispute creation event holds tokens once; a won-closure restores them once; a lost-closure finalizes once.
- Unauthorized users cannot trigger refunds or adjustments.
