package okta

import data.common

config := input.route.labels

payload := common.claims(common.bearer)

has_group if {
	"Workspace User" in common.claim_or(payload, "groups", [])
}

has_uid if {
	payload.uid
}

audience_ok if {
	payload.aud == config.audience
}

required_scope := "workspace:read" if common.safe_method

required_scope := "workspace:write" if not common.safe_method

scope_ok if {
	required_scope in common.scope_set(common.claim_or(payload, "scp", []))
}

default allow := false

allow if {
	has_group
	has_uid
	audience_ok
	scope_ok
}

headers := common.user_headers("okta", payload) if allow

headers := common.deny_headers("okta", payload, reason) if not allow

reasons contains "no_group" if not has_group
reasons contains "no_uid" if not has_uid
reasons contains "wrong_audience" if not audience_ok
reasons contains "missing_scope" if not scope_ok

reason := concat(",", sort(reasons))
