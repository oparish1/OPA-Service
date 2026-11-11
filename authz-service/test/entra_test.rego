package authz.v1.gateway.entra

import data.testutil

base_labels := {"audience": "api://client", "tenant": "tenant-1"}

base_payload := {
	"iss": "https://login.microsoftonline.com/tenant-1/v2.0",
	"aud": "api://client",
	"tid": "tenant-1",
	"sub": "sub-1",
	"email": "user@agentic-advantage.example",
	"name": "Test User",
	"roles": ["Workspace.User"],
	"scp": "workspace:read workspace:write",
}

# Claim tests run against a mapped route; a pathless request resolves to the
# admin-only unmapped fallback and would not exercise the intended capability.
read_input(method, payload) := testutil.input_for_path(method, "/entra/v1/me", payload, base_labels)

write_input(payload) := testutil.input_for_path("POST", "/entra/v1/send", payload, base_labels)

test_read_is_allowed if {
	allow with input as read_input("GET", base_payload)
}

test_write_scope_is_required_for_post if {
	not allow with input as write_input(object.remove(base_payload, ["scp"]))
}

test_write_scope_allows_post if {
	allow with input as write_input(object.union(base_payload, {"scp": "workspace:write"}))
}

test_read_scope_denies_post if {
	not allow with input as write_input(object.union(base_payload, {"scp": "workspace:read"}))
}

test_missing_role_is_denied if {
	not allow with input as read_input("GET", object.remove(base_payload, ["roles"]))
}

test_wrong_role_is_denied if {
	not allow with input as read_input("GET", object.union(base_payload, {"roles": ["Other"]}))
}

test_wrong_audience_is_denied if {
	not allow with input as read_input("GET", object.union(base_payload, {"aud": "api://other"}))
}

test_wrong_tenant_claim_is_denied if {
	not allow with input as read_input("GET", object.union(base_payload, {"tid": "tenant-2"}))
}

test_projects_denied_for_non_admin if {
	not allow with input as testutil.input_for_path("GET", "/entra/v1/projects", base_payload, base_labels)
}

test_projects_insufficient_role_audit_reason if {
	reason == "insufficient_role" with input as testutil.input_for_path("GET", "/entra/v1/projects", base_payload, base_labels)
}

test_missing_role_map_fails_closed if {
	not allow with input as read_input("GET", base_payload) with data.authz.role_map as {}
}

test_empty_entra_role_map_fails_closed if {
	not allow with input as read_input("GET", base_payload) with data.authz.role_map as {"entra": {}}
}

test_empty_tenant_label_fails_closed if {
	not allow with input as testutil.input_for_path("GET", "/entra/v1/me", object.union(base_payload, {"tid": ""}), object.union(base_labels, {"tenant": ""}))
}

test_missing_scope_is_denied if {
	not allow with input as read_input("GET", object.union(base_payload, {"scp": ""}))
}

test_no_bearer_token_is_denied if {
	not allow with input as {"request": {"method": "GET", "headers": {}}, "route": {"base_labels": base_labels}}
}

test_headers_come_from_the_token if {
	headers["X-User-Provider"] == "entra" with input as read_input("GET", base_payload)
	headers["X-User-Subject"] == "sub-1" with input as read_input("GET", base_payload)
	headers["X-User-Issuer"] == "https://login.microsoftonline.com/tenant-1/v2.0" with input as read_input("GET", base_payload)
}

test_reason_reports_the_first_failure if {
	reason == "no_role" with input as read_input("GET", object.remove(base_payload, ["roles"]))
}

test_deny_headers_report_provider_subject_decision_and_reason if {
	headers["X-Auth-Provider"] == "entra" with input as read_input("GET", object.remove(base_payload, ["roles"]))
	headers["X-Auth-Subject"] == "sub-1" with input as read_input("GET", object.remove(base_payload, ["roles"]))
	headers["X-Auth-Decision"] == "deny" with input as read_input("GET", object.remove(base_payload, ["roles"]))
	headers["X-Auth-Reason"] == "no_role" with input as read_input("GET", object.remove(base_payload, ["roles"]))
}
