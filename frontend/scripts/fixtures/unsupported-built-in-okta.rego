package authz.providers.okta

# Fixture for the build-validation test: like the real provider, but the rule
# calls `http.send`, a built-in the WASM target cannot execute. `opa build`
# accepts it, so the build must reject it when it evaluates this provider.

config := data.authz.config.okta

group_ok if {
	config.required_group in input.claims.groups
}

deny_by_capability[cap] := failures if {
	some cap in data.authz.provider_capabilities
	failures := {code |
		code := "missing_group"
		http.send({"method": "get", "url": "https://example.com"})
		not group_ok
	}
}
