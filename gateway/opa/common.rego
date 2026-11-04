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

claim_or(payload, key, fallback) := payload[key] if {
	payload[key]
} else := fallback

# The shared `input.request` slice, built once for every provider wrapper.
authz_request(req) := {"method": req.method, "path": req.path} if {
	req.path
}

authz_request(req) := {"method": req.method} if {
	not req.path
}

# True only when the verified payload actually carries the claim; an absent
# claim is an explicit false so callers can build an object from it.
has_claim(payload, key) := object.get(payload, key, null) != null

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
