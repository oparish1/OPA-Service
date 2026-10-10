---
name: add-authentication
description: Guides a user through adding authentication to an existing application — username/password, multi-factor (SMS, authenticator app, push), enterprise SSO (Microsoft Entra ID/Azure AD, Okta, Ping Identity, Google Workspace, AWS IAM Identity Center), or social login (Google, Apple, Facebook) — by reading the codebase first, interviewing the owner, choosing an approach, and producing an implementation-ready work order plus a security checklist. Framework-agnostic; adapts to the stack it finds. Use whenever the user asks to add authentication, add login, set up auth, add sign-in, add SSO, add SAML or OIDC, add MFA or 2FA, add social login or "Sign in with Google/Apple/Facebook", add user accounts, or wants to secure an app or API behind user identity — even if they do not say "authentication" and even if they name a specific library or provider.
metadata:
  arguments: "[output-dir] [jira-issue-keys] [confluence-page-ids]"
---

# Add Authentication

## Objective

Authentication is the feature where a plausible-looking implementation is most likely to be a vulnerable one. The failure is rarely a missing login form; it is an unchecked token claim, a session that never expires, a reset flow that leaks whether an account exists, or an SSO integration keyed on a mutable email address. This skill gets the decisions right first — what the app already has, who the users are, what the stakes are — and only then hands a precise work order to whoever builds it.

**Governing rule: every lockout threshold, session lifetime, password rule, token TTL, and factor policy is a commitment the owner will be held to. Get those from the owner, not from what sounds reasonable.** Where the owner has not decided, record the item as *unresolved* in the work order with a labelled suggestion; never write a guess in as if it were decided. A second rule follows from the first: prefer a maintained library or managed identity provider over hand-rolled code, and say so plainly when the owner proposes rolling their own crypto, session, or token handling.

## Arguments

`add-authentication [output-dir] [jira-issue-keys] [confluence-page-ids]`. Write deliverables to the output directory. If none was given, ask where to save before Step 5 — do not guess a path. Jira/Confluence arguments are forwarded to `prime-codebase` in Step 0.

## Process

### Step 0: Prime on the existing codebase

Invoke the **prime-codebase** skill (forwarding any Jira/Confluence arguments). If it is unavailable, do the equivalent by hand. Nothing in Steps 1–4 is valid until you have established, from the code and not from the user's description:

- **Stack:** language, backend framework, frontend (server-rendered, SPA, mobile, or API-only), and package manager. Everything you propose must fit this.
- **What auth already exists:** a user table or model, password hashing, sessions or tokens, middleware, an identity provider SDK, half-finished attempts, or dead auth code. Extend or replace deliberately; never build a second system beside a live one.
- **Session model:** server-side sessions, signed cookies, JWTs, or none. This decides where tokens live and how logout works.
- **Data and deployment:** database, secrets management, HTTPS/TLS termination, reverse proxy, and how many origins or domains the app serves. Cookies, redirect URIs, and CORS all depend on these.
- **Email and messaging capability:** an email sender for verification and reset, an SMS gateway if one exists.
- **Existing security controls:** rate limiting, CSRF protection, audit logging, and what is logged today.
- **Test setup:** how auth code will be tested, since the work order must be verifiable.

Summarize these findings back to the user before continuing. If the app has no backend at all (a static site), say so: authentication cannot be enforced client-side, and that changes the whole approach.

### Step 1: Interview the owner

Ask rather than assume; use a chat-native elicitation tool if available. Cover:

1. **Who logs in:** consumers, employees, partners, or a mix; expected volume; whether accounts are self-service or provisioned by an admin.
2. **What is at stake:** what a compromised account can do (read data, spend money, change others' data, reach regulated data); the worst realistic outcome.
3. **Methods wanted:** which of password, MFA, SSO, social login, and why. If the user asked for one method, still ask whether the others are needed now or later — it changes the account model.
4. **Existing identity provider:** does the organization already run Entra ID, Okta, Ping, Google Workspace, or AWS IAM Identity Center? If yes, SSO is usually the answer for employees and the owner should not build passwords at all.
5. **Compliance and policy:** regulatory regime, mandatory MFA, password policy the org already enforces, data residency, retention of auth logs. Flag as a question for compliance rather than guessing.
6. **Recovery and support:** how a locked-out or lost-device user gets back in, and who can approve it. This is the most-skipped question and the most-attacked flow.
7. **Rollout:** greenfield users or migrating existing accounts (and their existing password hashes); timeline; who can test.

If a dimension goes unanswered, mark it *unresolved* in the work order. Do not fill it in.

### Step 2: Choose the approach

Decide with the owner, explaining the trade-off in the codebase's own terms:

| Situation | Default recommendation |
|---|---|
| Employees, org already has an IdP | SSO via OIDC (SAML if the IdP or app requires it). No local passwords. Read `references/sso.md`. |
| Consumers, low-to-moderate stakes | Managed identity provider or a maintained auth library for the stack; social login plus email/password. Read `references/social.md` and `references/password.md`. |
| Any account that can move money, change others' data, or reach sensitive data | Add MFA. Read `references/mfa.md`. |
| Mobile app that offers other social logins | Check the current App Store rules for Sign in with Apple before scoping. Read `references/social.md`. |
| Owner wants to build everything from scratch | Say once, clearly, what that costs and recommend a maintained library or provider; proceed the way the owner decides. |

State which methods are **in this work order** and which are deferred. One method well beats four half-finished.

### Step 3: Load the reference for each chosen method

Read only what applies; each file states what to decide, how to build it safely, and what to verify.

- Passwords and account lifecycle (registration, verification, reset, sessions): `references/password.md`
- Second factors (authenticator app, passkeys/security keys, SMS, push) and recovery: `references/mfa.md`
- Enterprise SSO (OIDC and SAML with Entra ID, Okta, Ping, Google Workspace, AWS IAM Identity Center): `references/sso.md`
- Social login (Google, Apple, Facebook) and account linking: `references/social.md`

**Provider details drift.** Endpoints, SDK names, console click-paths, app-review rules, and NIST/OWASP parameters change. The references give principles and the questions to ask; for any specific value (an OWASP hashing parameter, a provider's token endpoint, a store guideline), look it up in the current vendor or standards documentation and cite it in the work order rather than trusting memory.

### Step 4: Apply the cross-cutting baseline

Whatever the method, the work order must cover each item below or state why it does not apply. These are checks, not decisions to delegate silently.

- **Transport and cookies:** HTTPS everywhere; session cookies `HttpOnly`, `Secure`, and an explicit `SameSite`; no tokens in URLs or `localStorage` unless the owner accepts the XSS exposure knowingly.
- **Session lifecycle:** new session id on login (prevents fixation); idle and absolute timeouts; server-side invalidation on logout, password change, and factor change.
- **CSRF:** protection on every state-changing cookie-authenticated endpoint.
- **Brute force:** rate limiting and lockout or backoff on login, reset, and code-verification endpoints, per account *and* per source; the numbers are owner commitments.
- **No enumeration:** login, registration, and reset return the same response and comparable timing whether or not an account exists.
- **Secrets:** signing keys, client secrets, and pepper values come from the secrets manager or environment, never the repository; rotation is possible without downtime.
- **Authorization is separate:** authentication answers "who"; confirm every protected route actually checks it, and note that "what may they do" is a different work item unless the owner scopes it in.
- **Audit logging:** successful and failed logins, factor enrollment and removal, password and email changes, recovery actions, and admin overrides, with actor, time, and source; never log passwords, codes, or tokens.
- **Errors and headers:** no stack traces or provider error bodies to the client; security headers appropriate to the app.
- **Tests:** at least one negative test per control above (wrong password, expired code, replayed token, tampered claim, missing CSRF token).

### Step 5: Produce the work order

Write `add-authentication-work-order.md` to the output directory. Shape it as a contract a downstream planner and implementer can act on without asking questions — the same six elements the delivery workflows check:

1. **Problem** — what is missing or unsafe today, grounded in Step 0.
2. **Why / why now** — the stakes and trigger from Step 1.
3. **Outcome** — what becomes observably true, listing the methods in scope and explicitly those deferred.
4. **Invariants** — what must not break: existing users and sessions, the migration path for existing hashes, current authorization behaviour.
5. **Acceptance** — testable statements, each mapped to a control from Step 4 or a method reference.
6. **Decisions and commitments** — a table with one row per number or policy: value, source (`owner` or `unresolved`), and the owner's words or the question that resolves it. Unresolved rows carry a labelled suggestion and no more.

Then add: the chosen libraries or providers with the reason each beat the alternative; files and seams the change touches (verified against the code, marked *new* where they do not exist); a phased order of work with each phase independently verifiable; risks and rollback (including how to disable the new login path without locking everyone out); and the out-of-scope list so the implementer does not helpfully add it.

Hand the file to the delivery workflows — triage it, plan from it, then deliver — rather than implementing in this skill. Authentication is security-sensitive: the human gate stays at pull-request review, and the work order should say so. If the user explicitly asks you to implement now, still write the work order first, then implement against it phase by phase.

## When the request is narrower than a full setup

"Add MFA to our existing login" or "add Google sign-in" does not need every step. Still do Steps 0 and 1 in short form (you need the real session model and the account model), then go straight to the relevant reference and Step 4's checks, and produce a smaller work order. Say when you are scoping down. If the request is to *debug or review* existing authentication rather than add it, use the references' verification lists as the review checklist instead.

## Do not

- Do not invent security parameters, provider steps, or policy numbers; look them up or ask.
- Do not implement custom cryptography, password hashing, JWT signing, or session storage when a maintained library exists for the stack.
- Do not put client secrets, private keys, or test credentials in the repository, the work order, or the chat.
- Do not present SMS as equivalent to an authenticator app or security key; state the weakness when it is chosen.
- Do not key an account on an email address or display name from an external provider; see `references/social.md` and `references/sso.md`.
