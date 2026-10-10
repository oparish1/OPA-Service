# Social Login (Google, Apple, Facebook)

Read this when consumers should sign in with an existing account from a public identity provider. Social login is OAuth 2.0/OpenID Connect delegated to a third party: it removes password handling, but adds account-linking, provider-availability, and privacy decisions.

## Contents
1. Decide first
2. Common rules for every provider
3. Google
4. Apple
5. Facebook (Meta)
6. Account model and linking
7. Deletion, revocation, and privacy
8. Verify

## 1. Decide first (owner commitments)

- Which providers, and the reason for each. More providers means more linking edge cases and more review processes.
- Social-only, or social plus email/password (then linking rules matter; see section 6).
- What happens when a user loses access to their provider account or the provider is unavailable.
- Whether the app needs anything beyond identity (profile fields, contacts). Request the minimum scopes.
- Whether the app ships on iOS: Apple's App Store rules may require offering Sign in with Apple when other third-party social logins are offered. **Check the current App Review Guidelines**; the rule and its exemptions have changed over time.
- Who owns the developer accounts and consoles for each provider (use organizational, not personal, accounts) and who handles their verification and review.

## 2. Common rules for every provider

- Use authorization code flow with PKCE, via a maintained OAuth/OIDC library or a managed auth provider. No implicit flow.
- Random single-use `state` bound to the pre-login session; `nonce` for ID tokens; exact-match registered redirect URIs.
- Validate ID tokens: signature against the provider's published keys, `iss`, `aud` equal to your client ID, `exp`, `nonce`.
- Exchange the code on the server. Keep client secrets in the secrets manager.
- **Identity is the provider's immutable subject ID (`sub` or the provider's user ID), never the email.**
- Treat email as trustworthy only when the provider states it is verified, and never as the sole basis for linking accounts.
- Request minimum scopes; add more later with explicit user consent when a feature needs them.
- Provider consoles, review processes, and SDKs change often. Read the current documentation and cite it in the work order.

## 3. Google

- Use "Sign in with Google" via OpenID Connect. The stable identifier is `sub`.
- Check `email_verified` before trusting `email`.
- To restrict to a Workspace organization, verify the `hd` claim server-side in the validated ID token; the client-side `hd` parameter is only a UI hint.
- The OAuth consent screen may need branding verification and, for sensitive scopes, Google's app review. Plan for lead time; identity-only scopes are lighter than data scopes.
- Decide whether to use the redirect flow or Google's client-side sign-in library; whichever is chosen, verify the credential on the server.

## 4. Apple

- Sign in with Apple uses OIDC with distinctive behaviours to plan for:
  - The **client secret is a short-lived JWT you generate and sign** with a key from your Apple developer account. Automate its regeneration; a hardcoded expired secret is a common outage.
  - The user's **name and email are returned only on the first authorization.** Store them then; you cannot fetch them again without the user revoking and re-consenting.
  - The user may choose to **hide their email** behind Apple's private relay address. Treat it as the contact address; to send email to it you must register your sending domain with Apple per their current instructions.
  - Native iOS apps and web use different identifiers and flows (a bundle ID versus a Services ID); confirm which you need and how the audience differs.
- Identity is `sub`. Validate `iss` (Apple's issuer), `aud`, `exp`, and `nonce`.
- Apple requires apps that support account creation to allow account deletion in-app and requires token revocation on deletion; see section 7.

## 5. Facebook (Meta)

- Use Facebook Login through the current OAuth flow and SDK. The stable identifier is the **app-scoped user ID** (it differs per app).
- **Email may be missing**: users can decline the permission or have no email on the account. Design registration so a missing email is handled (ask for one and verify it).
- Do not trust the client-reported user ID or access token; on the server, verify the token with Meta's token-debug/introspection mechanism and confirm it was issued to your app and matches the user.
- Apps typically run in development mode until switched live; permissions beyond basic profile may require Meta App Review and business verification. Plan for lead time.
- Meta requires a **data deletion callback or instructions URL** and privacy policy for live apps; check the current requirements.
- The Graph API version is pinned and deprecated on a schedule; record the version and a maintenance owner.

## 6. Account model and linking

- Table: `users` (your account) and `identities` (provider, provider subject ID, timestamps, optional email as attribute), unique on (provider, subject). A user can hold several identities.
- New social login with no existing identity: create a user, or, if the owner wants to attach it to an existing account, require proof of that account first.
- **Never auto-link by email.** An attacker who controls a provider account with a victim's email, or a provider that does not verify email, becomes the victim. Linking flow: user is authenticated to the existing account, then explicitly adds the provider; or the user proves control of the account's email through a verification you send.
- If the user has a local password and adds a social identity, or the reverse, keep at least one working way to sign in. Do not let the last identity be unlinked.
- Decide the profile source of truth (provider data can change; avoid overwriting user-edited fields).

## 7. Deletion, revocation, and privacy

- Provide account deletion; on deletion revoke the provider tokens you hold (mandatory for Apple, good practice everywhere) and delete or anonymize stored data per policy.
- Store as little provider data as needed; do not persist provider access or refresh tokens unless a feature calls the provider's API, and then store them encrypted.
- Update the privacy policy to name the providers and data received. Where regulations apply, capture consent as required.
- Handle a user revoking your app inside the provider's settings: subsequent token refresh fails, and the user should be able to re-consent or use another sign-in method.

## 8. Verify

- Tampered, expired, wrong-audience, and replayed tokens are rejected; `state` and redirect-URI checks fail closed.
- Two accounts with the same email from different providers do not merge.
- A provider returning no email, an unverified email, or a hidden (relay) email is handled.
- Apple first-login data is captured on that first response and persisted.
- Facebook tokens are verified with Meta on the server, not trusted from the client.
- Last remaining sign-in method cannot be removed; deletion revokes provider tokens.
- Secrets and signing keys are absent from the repository and logs; client-secret expiry is tracked.
