package authz.providers.google

# Fixture for the build-validation test: like the real provider, but the rule
# calls `http.send`, a built-in the WASM target cannot execute. `opa build`
# accepts it, so the build must reject it when it evaluates this provider.

config := data.authz.config.google

domain_ok if {
	config.hosted_domain == input.claims.hd
}

deny_by_capability[cap] := failures if {
	some cap in data.authz.read_capabilities
	failures := {code |
		code := "wrong_domain"
		http.send({"method": "get", "url": "https://example.com"})
		not domain_ok
	}
}
