package authz.providers.entra

# Entra requires an application role, the configured tenant in the `tid` claim
# and a grant of the capability's scope (read for reads, write for writes).
# The role, tenant and scope names arrive as data, never as literals here.
# A missing configured value fails closed.

config := data.authz.config.entra

role_ok if {
	config.required_role != ""
	config.required_role in input.claims.roles
}

tenant_ok if {
	config.tenant != ""
	input.claims.tenant == config.tenant
}

failure_codes := {"missing_role", "wrong_tenant", "missing_scope"}

failure("missing_role", _) if {
	not role_ok
}

failure("wrong_tenant", _) if {
	not tenant_ok
}

failure("missing_scope", cap) if {
	not data.authz.scope_ok(cap)
}

deny_by_capability[cap] := failures if {
	some cap in data.authz.provider_capabilities
	failures := {code | some code in failure_codes; failure(code, cap)}
}
