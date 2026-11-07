package entra

import data.common

# Decode the token the openid-connect plugin already verified. The shared
# `authz` package owns the claim rules; this wrapper owns only the audience
# check, the gateway-only reasons and the audit vocabulary the access log reads.

payload := common.claims(common.bearer)

capability := data.authz.capability_for(common.claim_or(input.request, "method", ""), common.claim_or(input.request, "path", ""))

authz_request := common.authz_request(input.request)

authz_input := {
	"provider": "entra",
	"claims": {
		"roles": common.claim_or(payload, "roles", []),
		"groups": [],
		"scopes": common.claim_or(payload, "scp", ""),
		"tenant": common.claim_or(payload, "tid", ""),
		"hd": "",
		"email_verified": false,
		"has_subject": common.has_claim(payload, "sub"),
	},
	"request": authz_request,
}

# Route labels carry the public environment values; `aud` stays a gateway-only
# check because the openid-connect plugin does not verify it on the JWKS path.
# The role names come from the shared claim-to-role map, not from route labels.
authz_config := {"entra": {"tenant": input.route.labels.tenant}}

shared_reasons := reasons if {
	reasons := data.authz.capability_deny_reasons(capability) with input as authz_input with data.authz.config as authz_config
}

# The neutral codes this provider can raise, translated to the audit strings the
# access log has always carried; every other code passes through unchanged.
audit_reason(code) := "no_role" if {
	code == "missing_role"
}

audit_reason(code) := code if {
	code != "missing_role"
}

audience_ok if {
	payload.aud == input.route.labels.audience
}

reasons contains audit_reason(code) if {
	some code in shared_reasons
}

reasons contains "wrong_audience" if {
	not audience_ok
}

default allow := false

allow if {
	shared_reasons
	count(reasons) == 0
}

headers := common.user_headers("entra", payload) if allow

headers := common.deny_headers("entra", payload, reason) if not allow

reason := concat(",", sort(reasons))
