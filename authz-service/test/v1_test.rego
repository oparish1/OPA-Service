package authz.v1.test

# The v1 entry points: the capability map, the check allow/deny paths, and the
# fail-closed default when the capability or decision is undefined.

persona(id) := p if {
	some p in data.fixtures.personas
	p.id == id
}

test_v1_capabilities_returns_the_decision_map if {
	p := persona("entra-user")
	decisions := data.authz.v1.capabilities with input as {"provider": p.provider, "claims": p.claims} with data.authz.config as data.fixtures.config
	decisions["nav.overview"].allowed
	not decisions["nav.api.projects"].allowed
	decisions["nav.api.projects"].reason == "insufficient_role"
}

test_v1_check_allows_a_read if {
	allowed := data.authz.v1.check.allowed with input as {
		"subject": {
			"provider": "entra",
			"claims": {
				"has_subject": true,
				"roles": ["Workspace.Admin"],
				"groups": [],
				"scopes": ["workspace:read", "workspace:write"],
				"tenant": "tenant-1",
				"hd": "",
				"email_verified": false,
			},
		},
		"action": "GET",
		"resource": "/entra/v1/projects",
	}
		with data.authz.config as data.fixtures.config
	allowed
}

test_v1_check_denies_a_write_missing_its_scope if {
	request_input := {
		"subject": {
			"provider": "entra",
			"claims": {
				"has_subject": true,
				"roles": ["Workspace.User"],
				"groups": [],
				"scopes": ["workspace:read"],
				"tenant": "tenant-1",
				"hd": "",
				"email_verified": false,
			},
		},
		"action": "POST",
		"resource": "/entra/v1/projects",
	}
	allowed := data.authz.v1.check.allowed with input as request_input with data.authz.config as data.fixtures.config
	not allowed
	reason := data.authz.v1.check.reason with input as request_input with data.authz.config as data.fixtures.config
	reason == "missing_scope"
}

test_v1_check_fails_closed_when_the_decision_is_undefined if {
	allowed := data.authz.v1.check.allowed with input as {"subject": {"provider": "entra", "claims": {}}}
	allowed == false
	reason := data.authz.v1.check.reason with input as {"subject": {"provider": "entra", "claims": {}}}
	reason == ""
}
