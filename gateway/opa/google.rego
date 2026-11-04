package google

import data.common

# Decode the token the openid-connect plugin already verified. The shared
# `authz` package owns the claim and method rules; this wrapper owns only the
# audience and issuer checks, the gateway-only reasons and the audit vocabulary
# the access log reads.

payload := common.claims(common.bearer)

capability := data.authz.capability_for(common.claim_or(input.request, "method", ""), common.claim_or(input.request, "path", ""))

authz_request := common.authz_request(input.request)

authz_input := {
	"provider": "google",
	"claims": {
		"roles": [],
		"groups": [],
		"scopes": [],
		"tenant": "",
		"hd": common.claim_or(payload, "hd", ""),
		"email_verified": common.claim_or(payload, "email_verified", false),
		"has_subject": common.has_claim(payload, "sub"),
	},
	"request": authz_request,
}

authz_config := {"google": {"hosted_domain": input.route.labels.hosted_domain}}

shared_reasons := reasons if {
	reasons := data.authz.capability_deny_reasons(capability) with input as authz_input with data.authz.config as authz_config
}

audit_reason(code) := "wrong_hd" if {
	code == "wrong_domain"
}

audit_reason(code) := code if {
	code != "wrong_domain"
}

audience_ok if {
	payload.aud == input.route.labels.audience
}

issuer_ok if {
	common.claim_or(payload, "iss", "") == "https://accounts.google.com"
}

reasons contains audit_reason(code) if {
	some code in shared_reasons
}

reasons contains "wrong_audience" if {
	not audience_ok
}

reasons contains "wrong_issuer" if {
	not issuer_ok
}

default allow := false

allow if {
	shared_reasons
	count(reasons) == 0
}

headers := common.user_headers("google", payload) if allow

headers := common.deny_headers("google", payload, reason) if not allow

reason := concat(",", sort(reasons))
