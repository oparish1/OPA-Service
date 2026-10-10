# Username/Password and Account Lifecycle

Read this for any method that stores or verifies a local credential, and as the baseline for account recovery whatever else you add. It covers what to decide, how to build it, and what to verify.

## Contents
1. Decide first
2. Registration and verification
3. Storing passwords
4. Login
5. Sessions and tokens
6. Password reset and change
7. Migrating existing accounts
8. Verify

## 1. Decide first (owner commitments)

Ask; do not default. Each is a number or policy someone will be held to.

- Minimum password length and any maximum (a generous maximum, if any, only to bound hashing cost). Current NIST SP 800-63B guidance favours length and screening over composition rules and forced periodic rotation; look up the current revision for the exact figures and cite it.
- Whether to screen new passwords against known-breached lists and common-password lists.
- Lockout or backoff: attempts allowed, window, duration, and whether it is per account, per source, or both.
- Session idle timeout, absolute timeout, and "remember me" duration.
- Whether email verification is required before first use, and the token lifetime.
- Login identifier: email, username, or either; whether it is case-insensitive.
- Whether passkeys or a second factor are on the roadmap (affects the account model; see `mfa.md`).

## 2. Registration and verification

- Normalize the identifier (case, whitespace, Unicode) once, and enforce uniqueness on the normalized form in the database, not only in application code.
- Verify email ownership before treating the address as trusted. Verification tokens are single-use, random, high-entropy, expire, and are stored hashed.
- Respond identically whether or not the address is already registered; deliver the difference by email ("you already have an account") so registration does not enumerate users.
- Rate-limit registration and verification-resend.

## 3. Storing passwords

- Use a slow, memory-hard password hash from a maintained library: Argon2id preferred, with scrypt, bcrypt, or PBKDF2 as constrained alternatives. **Take the cost parameters from the current OWASP Password Storage Cheat Sheet and re-tune to the deployment hardware**; do not copy numbers from memory.
- Never a fast general-purpose hash (MD5, SHA-1, SHA-256 alone), never encryption, never a hand-rolled scheme.
- Per-password random salt is handled by the library. An optional secret pepper lives in the secrets manager, not the database; decide rotation before adopting one.
- Store the algorithm and parameters with the hash so they can be upgraded; rehash on successful login when parameters are outdated.
- Compare with the library's constant-time verify.

## 4. Login

- Same error and comparable timing for "no such user" and "wrong password" (verify against a dummy hash when the user is absent).
- Apply the lockout or backoff policy; make sure it cannot be used to lock out a victim indefinitely (prefer progressive delay and per-source limits over hard permanent lock).
- Rotate to a fresh session identifier on success.
- Log the attempt (identifier, source, result); never the password.
- Do not reveal in the response whether MFA is enrolled until the first factor has succeeded.

## 5. Sessions and tokens

- Prefer server-side sessions or opaque tokens with a server-side store for browser apps: revocation is trivial. If the stack uses stateless signed tokens, decide how logout, password change, and compromise revoke them (short TTL plus refresh rotation and a denylist or version claim).
- Session cookie: `HttpOnly`, `Secure`, explicit `SameSite`, scoped path/domain as narrowly as the app allows, and a `__Host-` prefix where the deployment permits.
- Session identifiers are random, from the platform CSPRNG, and never derived from user data.
- Invalidate all sessions on password change and on factor change; offer "sign out other devices".
- If signed tokens (JWT) are used: pin the accepted algorithm, verify signature, `exp`, `iss`, and `aud`; reject `alg: none`; keep the signing key in the secrets manager; never accept a token's own header to choose the key type.

## 6. Password reset and change

- Reset tokens: single-use, random, high-entropy, short-lived, stored hashed, invalidated when used or when a newer one is issued.
- The request endpoint returns the same response whether or not the account exists.
- The reset link goes only to the address on file; never let the requester supply the destination or the host used in the link (build it from configuration, not the `Host` header).
- Completing a reset invalidates existing sessions and, where policy requires, notifies the account owner by the old channel.
- Password change requires the current password (or a fresh re-authentication) and re-applies the policy.
- Account recovery is the weakest link: if the owner allows support-assisted recovery, the work order defines who may approve it and how it is logged. For accounts with a second factor, recovery must not silently bypass it.

## 7. Migrating existing accounts

- Identify the existing hash format. If it is weak (fast hash, unsalted), plan an on-login rehash into the new scheme, and optionally wrap the old hashes in the new one so they are protected immediately.
- Keep old logins working during migration; the invariant is "no user is locked out by the change".
- Do not email users their passwords or send passwords in any migration step.

## 8. Verify

- Wrong password, unknown user, locked account: same outward behaviour; timing checked.
- Hash cost parameters recorded and reviewed against current OWASP guidance.
- Reset and verification tokens: expired, reused, and tampered tokens all rejected.
- Session fixation: the identifier changes at login; old sessions die on password change.
- Cookie attributes confirmed in a real response.
- Rate limits exercised by test, per account and per source.
- No secrets, passwords, or tokens in logs, error bodies, or the repository.
