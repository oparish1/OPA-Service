package okta

import data.common

# Decode the token the openid-connect plugin already verified. The shared
# `authz` package owns the claim rules; this wrapper owns only the audience
# check, the gateway-only reasons and the audit vocabulary the access log reads.

payload := common.claims(common.bearer)

capability := data.authz.capability_for(common.claim_or(input.request, "method", ""), common.claim_or(input.request, "path", ""))

authz_request := common.authz_request(input.request)

authz_input := {
	"provider": "okta",
	"claims": {
		"roles": [],
		"groups": common.claim_or(payload, "groups", []),
		"scopes": common.claim_or(payload, "scp", []),
		"tenant": "",
		"hd": "",
		"email_verified": false,
		"has_subject": common.has_claim(payload, "uid"),
	},
	"request": authz_request,
}

authz_config := {"okta": {"required_group": input.route.labels.required_group}}

shared_reasons := reasons if {
	reasons := data.authz.capability_deny_reasons(capability) with input as authz_input with data.authz.config as authz_config
}

# `uid` is Okta's subject; the shared package reports it as `not_signed_in`, and
# the audit log has always called that `no_uid`.
audit_reason(code) := "no_group" if {
	code == "missing_group"
}

audit_reason(code) := "no_uid" if {
	code == "not_signed_in"
}

audit_reason(code) := code if {
	code != "missing_group"
	code != "not_signed_in"
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

headers := common.user_headers("okta", payload) if allow

headers := common.deny_headers("okta", payload, reason) if not allow

reason := concat(",", sort(reasons))
