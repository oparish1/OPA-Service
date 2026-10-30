package entra

import data.common

# Per-route configuration comes from the APISIX route labels via `with_route`.
# The v2 issuer pins the tenant, so `iss` validation in openid-connect already
# enforces the tenant; `tid` is cross-checked against the configured tenant.
config := input.route.labels

payload := common.claims(common.bearer)

has_role if {
	"Workspace.User" in common.claim_or(payload, "roles", [])
}

audience_ok if {
	payload.aud == config.audience
}

tenant_ok if {
	common.claim_or(payload, "tid", "") == config.tenant
}

required_scope := "workspace:read" if common.safe_method

required_scope := "workspace:write" if not common.safe_method

scope_ok if {
	required_scope in common.scope_set(common.claim_or(payload, "scp", ""))
}

default allow := false

allow if {
	has_role
	audience_ok
	tenant_ok
	scope_ok
}

headers := common.user_headers("entra", payload) if allow

headers := common.deny_headers("entra", payload, reason) if not allow

reasons contains "no_role" if not has_role
reasons contains "wrong_audience" if not audience_ok
reasons contains "wrong_tenant" if not tenant_ok
reasons contains "missing_scope" if not scope_ok

reason := concat(",", sort(reasons))
