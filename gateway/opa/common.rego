package common

# Provider-neutral helpers for the APISIX OPA policies. The APISIX
# `openid-connect` plugin has already verified the token signature, issuer,
# expiry and algorithm before these policies run, so the helpers only decode
# the verified payload and interpret its claims (including the audience, which
# the plugin does not check on the JWKS path).

# The bearer token from the Authorization header; undefined when absent or
# malformed, which makes every dependent rule undefined and the default deny.
bearer := token if {
	auth := input.request.headers.authorization
	is_string(auth)
	startswith(lower(auth), "bearer ")
	token := trim_space(substring(auth, 7, -1))
}

# The verified access/ID token payload.
claims(tok) := payload if {
	[_, payload, _] := io.jwt.decode(tok)
}

# `scp` is a space-delimited string on Entra access tokens and an array on Okta
# access tokens, so normalise both to a set.
scope_set(raw) := {s | some s in split(raw, " ")} if is_string(raw)

scope_set(raw) := {s | some s in raw} if is_array(raw)

scope_set(raw) := set() if {
	not is_string(raw)
	not is_array(raw)
}

# GET, HEAD and OPTIONS are safe; everything else needs a write scope.
safe_method if {
	input.request.method in {"GET", "HEAD", "OPTIONS"}
}

claim_or(payload, key, fallback) := payload[key] if {
	payload[key]
} else := fallback

# The headers GW-5 sets from the validated token; the gateway overwrites any
# client-supplied X-User-* value because these are the only source used below.
user_headers(provider, payload) := {
	"X-User-Issuer": claim_or(payload, "iss", ""),
	"X-User-Subject": claim_or(payload, "sub", ""),
	"X-User-Provider": provider,
	"X-User-Email": claim_or(payload, "email", ""),
	"X-User-Name": claim_or(payload, "name", ""),
}

# On deny the APISIX `opa` plugin copies these into the response headers, which
# the access-log format reads for GW-8's route/provider/subject/decision/reason.
deny_headers(provider, payload, reason) := {
	"X-Auth-Provider": provider,
	"X-Auth-Subject": claim_or(payload, "sub", ""),
	"X-Auth-Decision": "deny",
	"X-Auth-Reason": reason,
}
