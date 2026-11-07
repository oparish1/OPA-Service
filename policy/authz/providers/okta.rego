package authz.providers.okta

# Okta derives its roles from the `groups` claim through the shared
# claim-to-role map and keeps `not_signed_in` for a missing subject. The role
# map arrives as data, never as literals here; a missing role map fails closed.

uses_scopes := true

granted_roles contains role if {
	some value in input.claims.groups
	role := data.authz.role_map.okta[value]
}

subject_ok if {
	input.claims.has_subject == true
}

failure_codes := {"missing_group", "not_signed_in"}

failure("missing_group", _) if {
	count(granted_roles) == 0
}

failure("not_signed_in", _) if {
	not subject_ok
}

gate_failures[cap] := {code | some code in failure_codes; failure(code, cap)} if {
	some cap in data.authz.provider_capabilities
}
