package authz.providers.google

# Fixture for the build-validation test: the same contract as the real provider,
# but the rule calls `http.send`, a built-in the WASM target cannot execute.
# `opa build` accepts it, so the build must reject it when it loads the artifact.

uses_scopes := false

granted_roles contains role if {
	role := data.authz.role_map.google.default_role
}

gate_failures[cap] := failures if {
	some cap in data.authz.provider_capabilities
	failures := {code |
		code := "wrong_domain"
		http.send({"method": "get", "url": "https://example.com"})
	}
}
