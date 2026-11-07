package authz.providers.google

# Google uses an ID token and has no scopes. It is read-only: a write capability
# is always `method_not_allowed`, and a gateway read is accepted only for GET.
# The browser has no request method, so a read without a request context is
# treated as a read. The hosted domain arrives as data, never as a literal here;
# a missing configured value fails closed.

config := data.authz.config.google

uses_scopes := false

domain_ok if {
	config.hosted_domain != ""
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

# Google's only role is the configured default; it can never reach an
# admin-level capability because the hierarchy has no other Google role.
granted_roles contains role if {
	domain_ok
	email_verified_ok
	role := data.authz.role_map.google.default_role
}

read_failure_codes := {"wrong_domain", "email_unverified", "method_not_allowed"}

write_claim_failure_codes := {"wrong_domain", "email_unverified"}

failure("wrong_domain", _) if {
	not domain_ok
}

failure("email_unverified", _) if {
	not email_verified_ok
}

failure("method_not_allowed", _) if {
	not read_method_ok
}

gate_failures[cap] := failures if {
	some cap in data.authz.write_capabilities
	failures := {code | some code in write_claim_failure_codes; failure(code, cap)} | {"method_not_allowed"}
}

# A read carries the claim failures and, on the gateway, the method failure
# unless the request is a GET.
gate_failures[cap] := failures if {
	some cap in data.authz.read_capabilities
	failures := {code | some code in read_failure_codes; failure(code, cap)}
}
