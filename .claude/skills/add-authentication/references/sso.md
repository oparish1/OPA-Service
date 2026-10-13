# Enterprise SSO

Read this when the users are employees or partners of an organization that already runs an identity provider (IdP): Microsoft Entra ID (Azure AD), Okta, Ping Identity, Google Workspace, or AWS IAM Identity Center. The default is to **delegate authentication to the IdP and store no local passwords for these users.**

## Contents
1. Decide first
2. Choose the protocol
3. OIDC (authorization code with PKCE)
4. SAML 2.0
5. Identity, accounts and provisioning
6. Provider notes
7. Multi-tenant apps
8. Verify

## 1. Decide first (owner commitments)

- Which IdP(s) and who administers the tenant and can register the application. Registration is done by the customer's or organization's IdP admin; the work order should name who and what they must provide (client ID, issuer, metadata URL, signing certificates).
- Single organization, or many customer organizations each with their own IdP (multi-tenant).
- OIDC or SAML. Choose OIDC unless the IdP integration or a customer requires SAML.
- Just-in-time (JIT) account creation on first login, or pre-provisioned accounts (SCIM or admin import). Deprovisioning: how fast must a departed employee lose access?
- Role and group mapping: which IdP groups or claims map to which app roles and who owns that mapping.
- Session length in the app relative to the IdP session and whether the app should support single logout.
- Break-glass access if the IdP is down; who holds it and how it is audited.

## 2. Choose the protocol

- **OIDC** (OAuth 2.0 authorization code flow with PKCE) is the modern default for web, SPA and mobile clients. Use a maintained OIDC client library for the stack.
- **SAML 2.0** is common for legacy enterprise apps and some IdP configurations. Use a maintained SAML library. Never write XML signature validation yourself; signature-wrapping attacks are a long-standing source of critical vulnerabilities.
- Never use the implicit flow or the resource-owner password flow.

## 3. OIDC (authorization code with PKCE)

- Discover configuration from the issuer's `/.well-known/openid-configuration`; do not hardcode endpoints.
- Authorization request: random `state` (bind to the user's pre-login session, single-use), `nonce` for the ID token and a PKCE `code_challenge` (S256). Redirect URIs are exact-match registered values, never wildcards or built from request input.
- Public clients (SPA, mobile) hold no client secret; use the platform-appropriate flow. Confidential clients keep the secret in the secrets manager and rotate it before expiry (many IdPs make secrets expire; track it).
- Validate the ID token every time: signature against the IdP's published keys (cached with key-rotation handling), `iss` equals the expected issuer, `aud` contains your client ID, `exp` and `iat` sane, `nonce` matches. If it is used, validate `azp`.
- Do the code exchange server-side over TLS. Do not use the access token as proof of identity; identity comes from the validated ID token or the UserInfo endpoint.
- Keep tokens out of URLs, logs and `localStorage` by default. Establish your own application session after validation and decide separately whether you need the IdP's access or refresh tokens at all.
- Logout: clear your session; decide whether to call the IdP's end-session endpoint.

## 4. SAML 2.0

- Exchange SP metadata (entity ID, ACS URL) with the IdP and load the IdP's metadata (entity ID, SSO URL, signing certificate). Plan for certificate rotation: the IdP's signing certificate expires and login breaks silently if nobody watches it.
- Validate on every response: XML signature over the assertion (and response where required) with the expected certificate; `Issuer`; `Audience` equals your entity ID; `Recipient` and `Destination` equal your ACS URL; `NotBefore`/`NotOnOrAfter` with small clock skew; `InResponseTo` matches an outstanding request for SP-initiated flow; the assertion ID has not been seen before (replay cache).
- Prefer SP-initiated login; if IdP-initiated is required, understand it weakens request binding and document the risk.
- Disable DTD/external entity processing in the XML parser.
- Treat `RelayState` as untrusted; validate it before redirecting.

## 5. Identity, accounts and provisioning

- **Key the account on the provider's immutable subject identifier, not on email or name.** OIDC: the pair (`iss`, `sub`). Some providers document a different stable ID; use theirs. Email addresses are mutable and, in some tenants, can be set to values the user does not own, which has led to real account-takeover vulnerabilities in "log in with Microsoft" implementations that trusted email. Store email as an attribute.
- Trust an email claim only when the provider asserts it as verified and you understand the tenant's guarantees; for tenant-scoped IdPs, also restrict by tenant/issuer.
- Linking an SSO identity to a pre-existing local account is a takeover path: require the user to prove control of the local account first and never link on matching email alone.
- JIT provisioning: create the account with a minimal default role; never grant admin from an unvalidated claim. Map roles from a signed group or role claim you have verified and re-evaluate on each login.
- Deprovisioning: if immediate revocation matters, add SCIM provisioning or a periodic check and shorten the app session; otherwise a departed user keeps access until the app session ends.
- Disable local password login for SSO-managed users, or the SSO control can be bypassed.

## 6. Provider notes

Console paths, claim names and app-registration steps change. Read the provider's current documentation and cite it in the work order. Stable points to check for each:

- **Microsoft Entra ID (Azure AD):** app registration; the issuer includes the tenant ID, so validate `iss` and `tid` for single-tenant apps; use `oid`/`sub` and `tid` rather than email or `upn`; group claims can be truncated for users in many groups (check the documented overage behaviour); conditional access and MFA are enforced by the tenant.
- **Okta:** authorization server (org vs custom) determines the issuer and available claims; assign the app to users/groups; MFA and sign-on policy live in Okta.
- **Ping Identity (PingOne / PingFederate):** environment/issuer differs by product; confirm the token and claim mapping in the specific deployment.
- **Google Workspace:** restrict to the organization by verifying the hosted-domain claim (`hd`) on the server against the ID token, not only via a client-side hint parameter; use `sub` as the identity; SAML is also available for Workspace SSO.
- **AWS IAM Identity Center:** exposes SAML 2.0 (and, for some integrations, OIDC/OAuth); applications are assigned to users and groups; note it is often used for AWS access, so confirm whether the app is a custom SAML application or an AWS-integrated one.

## 7. Multi-tenant apps

- Each customer organization maps to a tenant record holding its issuer/entity ID, client or metadata configuration, allowed email domains and role mappings.
- Resolve the tenant *before* trusting an assertion: from the login URL or a home-realm hint, then validate that the token's issuer matches that tenant. A valid token from another tenant's IdP must never authenticate into this one.
- Store per-tenant secrets and certificates encrypted; give tenant admins a self-service way to update metadata, with audit logging.
- Domain-verify a tenant's claim to an email domain before allowing auto-join.

## 8. Verify

- Tampered, expired, wrong-audience, wrong-issuer and replayed tokens/assertions are all rejected (one negative test each).
- A missing or reused `state`/`nonce` and an unregistered redirect URI, fail.
- An account is never created or linked on email alone; two IdP users sharing an email do not collide.
- A user removed from the IdP loses access within the agreed bound.
- Certificate/secret expiry is tracked and alerting exists.
- Break-glass path works and is logged.
- No local password path exists for SSO-managed users.
