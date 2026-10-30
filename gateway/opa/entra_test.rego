package entra

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

test_read_is_allowed if {
	allow with input as testutil.input_for("GET", base_payload, base_labels)
}

test_write_scope_is_required_for_post if {
	not allow with input as testutil.input_for("POST", object.remove(base_payload, ["scp"]), base_labels)
}

test_write_scope_allows_post if {
	allow with input as testutil.input_for("POST", object.union(base_payload, {"scp": "workspace:write"}), base_labels)
}

test_read_scope_denies_post if {
	not allow with input as testutil.input_for("POST", object.union(base_payload, {"scp": "workspace:read"}), base_labels)
}

test_missing_role_is_denied if {
	not allow with input as testutil.input_for("GET", object.remove(base_payload, ["roles"]), base_labels)
}

test_wrong_role_is_denied if {
	not allow with input as testutil.input_for("GET", object.union(base_payload, {"roles": ["Other"]}), base_labels)
}

test_wrong_audience_is_denied if {
	not allow with input as testutil.input_for("GET", object.union(base_payload, {"aud": "api://other"}), base_labels)
}

test_wrong_tenant_claim_is_denied if {
	not allow with input as testutil.input_for("GET", object.union(base_payload, {"tid": "tenant-2"}), base_labels)
}

test_missing_scope_is_denied if {
	not allow with input as testutil.input_for("GET", object.union(base_payload, {"scp": ""}), base_labels)
}

test_no_bearer_token_is_denied if {
	not allow with input as {"request": {"method": "GET", "headers": {}}, "route": {"base_labels": base_labels}}
}

test_headers_come_from_the_token if {
	headers["X-User-Provider"] == "entra" with input as testutil.input_for("GET", base_payload, base_labels)
	headers["X-User-Subject"] == "sub-1" with input as testutil.input_for("GET", base_payload, base_labels)
	headers["X-User-Issuer"] == "https://login.microsoftonline.com/tenant-1/v2.0" with input as testutil.input_for("GET", base_payload, base_labels)
}

test_reason_reports_the_first_failure if {
	reason == "no_role" with input as testutil.input_for("GET", object.remove(base_payload, ["roles"]), base_labels)
}
