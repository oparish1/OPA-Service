package authz.providers.okta

# Okta requires the configured group, a subject (`uid`) and a grant of the
# capability's scope. The group name arrives as data, never as a literal here.
# A missing configured value fails closed.

config := data.authz.config.okta

group_ok if {
	config.required_group != ""
	config.required_group in input.claims.groups
}

subject_ok if {
	input.claims.has_subject == true
}

failure_codes := {"missing_group", "not_signed_in", "missing_scope"}

failure("missing_group", _) if {
	not group_ok
}

failure("not_signed_in", _) if {
	not subject_ok
}

failure("missing_scope", cap) if {
	not data.authz.scope_ok(cap)
}

deny_by_capability[cap] := failures if {
	some cap in data.authz.provider_capabilities
	failures := {code | some code in failure_codes; failure(code, cap)}
}
