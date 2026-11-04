package authz

import data.fixtures

# The golden decision table: the same JSON the browser test loads into the real
# WASM. A mismatch is collected rather than first-failed so a failing case can
# be read with `opa eval 'data.authz.mismatches'`.

test_golden_decisions if {
	count(mismatches) == 0
}

mismatches contains mismatch if {
	some case in fixtures.cases
	decision := data.authz.decision(case.capability) with input as case_input(case) with data.authz.config as fixtures.config
	decision != {"allowed": case.allowed, "reason": case.reason}
	mismatch := {
		"id": case.id,
		"expected": {"allowed": case.allowed, "reason": case.reason},
		"actual": decision,
	}
}

case_input(case) := {
	"provider": case.provider,
	"claims": case.claims,
	"request": object.get(case, "request", {}),
}

# A9: the (method, path) route table maps each request to the capability the
# gateway wrapper evaluates; a suffix or method regression fails here.
test_route_table if {
	capability_for("GET", "/entra/v1/projects") == "nav.api.projects"
	capability_for("HEAD", "/entra/v1/projects") == "nav.api.projects"
	capability_for("GET", "/entra/v1/me") == "nav.api.profile"
	capability_for("OPTIONS", "/okta/v1/me") == "nav.api.profile"
	capability_for("POST", "/entra/v1/me") == "action.api.send.write"
	capability_for("DELETE", "/google/v1/projects") == "action.api.send.write"
}

# The browser carries no request context: a Google read with good claims is a
# read, so the missing method must not deny it.
test_google_read_without_request_context if {
	decision := data.authz.decision("nav.api.profile") with input as {
		"provider": "google",
		"claims": {
			"has_subject": true,
			"roles": [],
			"groups": [],
			"scopes": [],
			"tenant": "",
			"hd": fixtures.config.google.hosted_domain,
			"email_verified": true,
		},
	}
		with data.authz.config as fixtures.config
	decision == {"allowed": true, "reason": ""}
}
