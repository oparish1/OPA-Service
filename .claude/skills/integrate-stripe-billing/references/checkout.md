# Checkout, Frontend and Configuration

Read this for taking the payment: creating the Checkout Session on the server, the buy-tokens UI, the return pages and environment setup. Crediting tokens is not done here; it happens only in the webhook (`webhooks.md`).

## Contents
1. Decide first
2. Server-side session creation
3. Frontend
4. Return pages
5. Customers and identity
6. Environment configuration
7. Verify

## 1. Decide first (owner commitments)

- Packs: identifiers, token amounts, prices, currency. One source of truth on the server (config or database) maps pack id to price and tokens.
- Hosted Checkout (redirect to Stripe) or embedded Checkout; default to hosted unless the owner wants the page to stay in the app.
- Whether to create Stripe Products/Prices in Stripe and reference them by id, or define price inline per session. Prefer Stripe-side Prices when the owner will manage pricing in the dashboard; prefer inline when pricing lives in the app. Check current documentation for both and record the choice.
- Whether users may buy custom amounts (then define minimum, maximum and rounding, all owner commitments).
- Payment methods offered and whether delayed-notification methods (bank debits and similar) are allowed; they change fulfillment timing (see `webhooks.md`).
- Tax collection and billing-address requirements.
- Team or individual account as the purchaser.

## 2. Server-side session creation

- One authenticated endpoint, for example "create checkout session". It takes only a pack identifier (and quantity if allowed). It looks up price and tokens server-side and ignores any amount the client sends.
- Create the session in payment mode with the pack's price and attach the app's own identifiers so the webhook can find the account: the app user or team id via the session's client reference field and the pack id and expected token amount in metadata. Look up the current field names and limits in Stripe's documentation.
- Attach or reuse a Stripe Customer for the purchaser (see section 5).
- Success and cancel URLs come from server configuration, not from request input and point at the app's own pages.
- Send an idempotency key derived from a client-generated attempt id so a double-click or retry does not create two sessions or two charges.
- Rate-limit the endpoint per user. Return only the session URL (or client secret for embedded), never the secret key.
- Do not write tokens to the ledger here. The pending purchase may be recorded as "started" for support purposes, but it grants nothing.

## 3. Frontend

Match the app's framework and component conventions; the flow is the same everywhere:
- A pack selector showing the tokens and price the server reports. Fetch pack data from the server rather than hardcoding prices in the client, so UI and charge never disagree.
- A buy button that calls the create-session endpoint, disables itself while pending, then navigates to the returned Checkout URL (or mounts embedded Checkout with the returned secret).
- A visible token balance and recent purchase history, refreshed after return.
- Clear states: loading, error creating the session and "payment processing".
- Low-balance and zero-balance messaging in the place tokens are consumed, with a path back to the buy flow.
- The publishable key is the only Stripe key allowed in client code and only if embedded Checkout or Stripe.js is used. Hosted redirect needs none.

## 4. Return pages

- The **success page never credits tokens** and never trusts query parameters as proof of payment. It shows "payment received, updating your balance" and polls the app's own balance endpoint (with a sensible timeout and a "contact support" fallback) until the webhook has landed.
- The page may look up the session status through the server to word its message ("processing", "paid", "failed"), but the ledger changes only through the webhook path.
- The cancel page returns the user to the buy flow with nothing changed.
- Handle the user closing the tab: the webhook still fulfills; the balance is correct next visit.

## 5. Customers and identity

- Store the Stripe customer id on the account record, created on first purchase; do not create a new customer per checkout.
- Do not key accounts on email alone: emails change and can collide. Use the app's stable user or team id, carried in the session's reference field.
- Decide, with the owner, what happens if a user is deleted: purchase records may need retention for tax and dispute purposes.

## 6. Environment configuration

- Variables, names only in `.env.example`: the secret API key, the webhook signing secret, optionally the publishable key, the pinned API version, the success and cancel base URLs and a mode indicator if useful. Real values live in the secrets manager or a git-ignored env file.
- Separate test and live keys and a separate webhook endpoint and signing secret per environment. A live secret in a dev environment, or the reverse, is a common outage.
- Fail fast at startup if a required Stripe variable is missing or if the key's mode (test vs. live) does not match the environment.
- Use restricted API keys with only the permissions the integration needs where the platform supports them; check current documentation.
- Pin the Stripe API version in the client configuration so a Stripe-side upgrade cannot change behavior unannounced.

## 7. Verify

- A tampered request cannot change price or token quantity.
- Double-clicking Buy does not create two sessions or two charges.
- The success page grants nothing on its own; removing the webhook leaves the balance unchanged.
- An unauthenticated request to the create-session endpoint is rejected.
- The client bundle contains no secret key or signing secret.
- Startup fails with a clear error when configuration is missing or mismatched.
