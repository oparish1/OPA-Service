package authz.providers.google

# Google uses an ID token and has no scopes. It is read-only: the write
# capability is always `method_not_allowed`, and a gateway read request is
# accepted only for GET. The browser has no request method, so a read
# capability without a request context is treated as a read. The hosted domain
# arrives as data, never as a literal here.

config := data.authz.config.google

domain_ok if {
	input.claims.hd == config.hosted_domain
}

email_verified_ok if {
	input.claims.email_verified == true
}

read_method_ok if {
	input.request.method == "GET"
}

read_method_ok if {
	not input.request.method
}

read_failure_codes := {"wrong_domain", "email_unverified", "method_not_allowed"}

failure("wrong_domain", _) if {
	not domain_ok
}

failure("email_unverified", _) if {
	not email_verified_ok
}

failure("method_not_allowed", _) if {
	not read_method_ok
}

deny_by_capability[cap] := failures if {
	some cap in data.authz.read_capabilities
	failures := {code | some code in read_failure_codes; failure(code, cap)}
}

deny_by_capability[cap] := {"method_not_allowed"} if {
	some cap in data.authz.write_capabilities
}
