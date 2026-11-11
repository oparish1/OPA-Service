package authz.v1.gateway.okta

import data.testutil

base_labels := {"audience": "api://default"}

base_payload := {
	"iss": "https://dev-1.okta.example/oauth2/default",
	"aud": "api://default",
	"uid": "uid-1",
	"sub": "sub-1",
	"groups": ["Workspace User"],
	"scp": ["workspace:read", "workspace:write"],
}

# Claim tests run against a mapped route; a pathless request resolves to the
# admin-only unmapped fallback and would not exercise the intended capability.
read_input(method, payload) := testutil.input_for_path(method, "/okta/v1/me", payload, base_labels)

write_input(payload) := testutil.input_for_path("POST", "/okta/v1/send", payload, base_labels)

test_read_is_allowed_with_array_scopes if {
	allow with input as read_input("GET", base_payload)
}

test_space_delimited_scopes_are_also_accepted if {
	allow with input as read_input("GET", object.union(base_payload, {"scp": "workspace:read workspace:write"}))
}

test_write_scope_is_required_for_post if {
	not allow with input as write_input(object.union(base_payload, {"scp": ["workspace:read"]}))
}

test_write_scope_allows_post if {
	allow with input as write_input(object.union(base_payload, {"scp": ["workspace:write"]}))
}

test_missing_group_is_denied if {
	not allow with input as read_input("GET", object.remove(base_payload, ["groups"]))
}

test_wrong_group_is_denied if {
	not allow with input as read_input("GET", object.union(base_payload, {"groups": ["Everyone"]}))
}

test_missing_uid_is_denied if {
	not allow with input as read_input("GET", object.remove(base_payload, ["uid"]))
}

test_wrong_audience_is_denied if {
	not allow with input as read_input("GET", object.union(base_payload, {"aud": "api://other"}))
}

test_projects_denied_for_non_admin if {
	not allow with input as testutil.input_for_path("GET", "/okta/v1/projects", base_payload, base_labels)
}

test_projects_insufficient_role_audit_reason if {
	reason == "insufficient_role" with input as testutil.input_for_path("GET", "/okta/v1/projects", base_payload, base_labels)
}

test_missing_role_map_fails_closed if {
	not allow with input as read_input("GET", base_payload) with data.authz.role_map as {}
}

test_empty_okta_role_map_fails_closed if {
	not allow with input as read_input("GET", base_payload) with data.authz.role_map as {"okta": {}}
}

test_headers_come_from_the_token if {
	headers["X-User-Provider"] == "okta" with input as read_input("GET", base_payload)
	headers["X-User-Subject"] == "sub-1" with input as read_input("GET", base_payload)
}

test_reason_reports_the_first_failure if {
	reason == "no_group" with input as read_input("GET", object.remove(base_payload, ["groups"]))
}

test_deny_headers_report_provider_subject_decision_and_reason if {
	headers["X-Auth-Provider"] == "okta" with input as read_input("GET", object.remove(base_payload, ["groups"]))
	headers["X-Auth-Subject"] == "sub-1" with input as read_input("GET", object.remove(base_payload, ["groups"]))
	headers["X-Auth-Decision"] == "deny" with input as read_input("GET", object.remove(base_payload, ["groups"]))
	headers["X-Auth-Reason"] == "no_group" with input as read_input("GET", object.remove(base_payload, ["groups"]))
}
