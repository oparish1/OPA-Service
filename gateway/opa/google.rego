package google

import data.common

# Google uses an ID token and has no scopes. SD-10 makes it read-only, so any
# unsafe method is denied regardless of the remaining claims.
config := input.route.labels

payload := common.claims(common.bearer)

read_only if input.request.method == "GET"

hosted_domain_ok if {
	common.claim_or(payload, "hd", "") == config.hosted_domain
}

email_verified_ok if {
	common.claim_or(payload, "email_verified", false) == true
}

audience_ok if {
	payload.aud == config.audience
}

issuer_ok if {
	common.claim_or(payload, "iss", "") == "https://accounts.google.com"
}

default allow := false

allow if {
	read_only
	hosted_domain_ok
	email_verified_ok
	audience_ok
	issuer_ok
}

headers := common.user_headers("google", payload) if allow

headers := common.deny_headers("google", payload, reason) if not allow

reasons contains "method_not_allowed" if not read_only
reasons contains "wrong_hd" if not hosted_domain_ok
reasons contains "email_unverified" if not email_verified_ok
reasons contains "wrong_audience" if not audience_ok
reasons contains "wrong_issuer" if not issuer_ok

reason := concat(",", sort(reasons))
