package authz.providers.entra

# Entra derives its roles from the `roles` claim through the shared
# claim-to-role map and checks the configured tenant. The tenant and the role
# map arrive as data, never as literals here; a missing configured value or role
# map fails closed.

config := data.authz.config.entra

uses_scopes := true

granted_roles contains role if {
	some value in input.claims.roles
	role := data.authz.role_map.entra[value]
}

tenant_ok if {
	config.tenant != ""
	input.claims.tenant == config.tenant
}

failure_codes := {"missing_role", "wrong_tenant"}

failure("missing_role", _) if {
	count(granted_roles) == 0
}

failure("wrong_tenant", _) if {
	not tenant_ok
}

gate_failures[cap] := {code | some code in failure_codes; failure(code, cap)} if {
	some cap in data.authz.provider_capabilities
}
