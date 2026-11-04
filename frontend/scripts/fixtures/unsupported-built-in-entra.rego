package authz.providers.entra

# Fixture for the build-validation test: the same shape as the real provider,
# but the rule calls `http.send`, a built-in the WASM target cannot execute.
# `opa build` accepts it, so the build must reject it when it loads the artifact.

config := data.authz.config.entra

role_ok if {
	config.required_role in input.claims.roles
}

failure_codes := {"missing_role"}

deny_by_capability[cap] := failures if {
	some cap in data.authz.provider_capabilities
	failures := {code |
		some code in failure_codes
		http.send({"method": "get", "url": "https://example.com"})
		not role_ok
	}
}
