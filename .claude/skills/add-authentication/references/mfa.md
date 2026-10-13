# Multi-Factor Authentication

Read this when any account can act with real consequence, when policy requires a second factor, or when the owner asks for 2FA/MFA. MFA is a layer on a working first factor; do the first factor (`password.md`, `sso.md`, or `social.md`) before this.

## Contents
1. Decide first
2. Rank the factors
3. Authenticator app (TOTP)
4. Passkeys and security keys (WebAuthn)
5. Push notification
6. SMS
7. Enrollment, step-up and recovery
8. Where MFA lives when SSO is used
9. Verify

## 1. Decide first (owner commitments)

- Who must use MFA: everyone, admins only, or users who opt in; and any grace period for enrollment.
- Which factors are offered and whether SMS is offered at all.
- Recovery method when a device is lost and who may approve it.
- Whether MFA is required at every login or "remembered" on a trusted device and for how long.
- Which actions require step-up re-authentication (changing email, password, or factors; payments; admin actions).
- Lockout and rate limits on code entry.

## 2. Rank the factors

Present them to the owner in this order of resistance to phishing and takeover and say why:

1. **Passkeys / security keys (WebAuthn/FIDO2):** phishing-resistant, bound to the site's origin. Best where the stack and users support them.
2. **Authenticator app (TOTP):** good, but the code can be phished and replayed within its window.
3. **Push with number matching:** convenient; vulnerable to approval fatigue unless number matching or context display is required.
4. **SMS/voice code:** weakest. Exposed to SIM swapping, number reassignment, SS7 interception and phishing. Current NIST guidance treats out-of-band SMS as a restricted authenticator; check the current text. Offer it only as a fallback the owner accepts knowingly and record that acceptance.

If the owner asks for SMS only, say plainly what it does and does not protect against, then build what they decide.

## 3. Authenticator app (TOTP)

- Use a maintained library implementing RFC 6238 (TOTP, built on RFC 4226). Do not hand-roll HMAC counters.
- Generate a random secret per user from the CSPRNG; **store it encrypted at rest** (it must be recoverable to verify, unlike a password) with the key in the secrets manager.
- Enrollment: show the secret as a QR code (`otpauth://` URI) and text; require the user to enter a valid code before the factor becomes active. Do not activate on scan alone.
- Verification: allow a small clock-drift window (decide it); reject a code already used in the current window (store the last accepted time step per user) to block replay.
- Rate-limit attempts per account; the code space is small.
- Give the issuer and account label a stable, recognisable form so users can tell entries apart.

## 4. Passkeys and security keys (WebAuthn)

- Use a maintained WebAuthn server library; do not parse attestation or assertions by hand.
- Bind to the correct relying-party ID and origin; verify the challenge, origin, RP ID hash, signature and signature counter where supplied.
- Challenges are random, single-use, short-lived and stored server-side.
- Decide whether passkeys are a second factor or can replace the password entirely and whether to require user verification. Plan for multiple credentials per user and a way to name and remove them.
- Check browser and platform support for the user base and keep a fallback factor for unsupported clients.

## 5. Push notification

- Prefer an established provider or the organization's IdP push (Okta Verify, Microsoft Authenticator, Duo and similar) over building a push channel; the trust and device-binding work is hard.
- Require number matching or contextual detail (app, location) so users cannot approve blind; apply rate limits and alerts on repeated denied or unsolicited prompts to counter push-bombing.
- Define what happens when the push is not answered (expire, fall back to another factor) and the timeout; these are owner commitments.
- The vendor's current API and enrollment flow change; read the current documentation and cite it in the work order.

## 6. SMS

- Use a reputable messaging provider; never expose the code in logs or in the API response.
- Codes: random, short-lived, single-use, tied to the session and number, with attempt and resend limits and a cool-down. Set the numbers with the owner.
- Guard the phone-number change flow with re-authentication: a number swap is the takeover path.
- Consider carrier lookup or SIM-change signals if the provider offers them and cost/abuse controls (SMS pumping fraud) with per-account and per-source send limits.
- Record in the work order that SMS is a weaker factor and who accepted that.

## 7. Enrollment, step-up and recovery

- Require the first factor to be freshly verified before enrolling, changing, or removing any second factor. Notify the user by email when a factor is added or removed.
- Recovery codes: generate a set of single-use random codes at enrollment, show them once, store them hashed and let the user regenerate (which invalidates the old set). Using one triggers a notification.
- Define the lost-device path end to end. A recovery route that bypasses MFA on a phone call or a support email defeats it; if support-assisted recovery is allowed, specify identity checks, a waiting period or second approver and audit logging.
- Step-up: for sensitive actions, require a recent MFA proof (a timestamp on the session), not merely the original login.
- New session after MFA success (rotate the identifier again). Do not grant a partially authenticated session access to anything except the MFA challenge.

## 8. Where MFA lives when SSO is used

When users sign in through an enterprise IdP or a social provider, the IdP normally owns MFA. Do not add a second, local MFA prompt on top by default. Instead:
- Require the IdP to enforce MFA (conditional access or sign-on policy) and record that dependency in the work order.
- Read the authentication-context or method claims the IdP returns (for example `acr`/`amr` in OIDC, or the SAML authentication context) if the app needs to *verify* that MFA occurred and check them per the provider's current documentation.
- For sensitive actions inside the app, request re-authentication from the IdP (for example a `max_age` or prompt parameter) rather than inventing a local factor.

## 9. Verify

- A correct password alone never yields an authenticated session when MFA is required.
- Wrong, expired and replayed codes are rejected; attempt limits trip.
- Enrollment is not active until a valid code is confirmed.
- Removing or changing a factor requires fresh re-authentication and sends a notification.
- Recovery codes work once and are invalidated on regeneration.
- The partially authenticated state cannot reach protected routes.
- Secrets (TOTP seeds) are encrypted at rest and absent from logs.
- SMS/push send and resend limits verified under repeated requests.
