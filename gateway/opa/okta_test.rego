package okta

import data.testutil

base_labels := {"audience": "api://default", "required_group": "Workspace User"}

base_payload := {
	"iss": "https://dev-1.okta.example/oauth2/default",
	"aud": "api://default",
	"uid": "uid-1",
	"sub": "sub-1",
	"groups": ["Workspace User"],
	"scp": ["workspace:read", "workspace:write"],
}

test_read_is_allowed_with_array_scopes if {
	allow with input as testutil.input_for("GET", base_payload, base_labels)
}

test_space_delimited_scopes_are_also_accepted if {
	allow with input as testutil.input_for("GET", object.union(base_payload, {"scp": "workspace:read workspace:write"}), base_labels)
}

test_write_scope_is_required_for_post if {
	not allow with input as testutil.input_for("POST", object.union(base_payload, {"scp": ["workspace:read"]}), base_labels)
}

test_write_scope_allows_post if {
	allow with input as testutil.input_for("POST", object.union(base_payload, {"scp": ["workspace:write"]}), base_labels)
}

test_missing_group_is_denied if {
	not allow with input as testutil.input_for("GET", object.remove(base_payload, ["groups"]), base_labels)
}

test_wrong_group_is_denied if {
	not allow with input as testutil.input_for("GET", object.union(base_payload, {"groups": ["Everyone"]}), base_labels)
}

test_missing_uid_is_denied if {
	not allow with input as testutil.input_for("GET", object.remove(base_payload, ["uid"]), base_labels)
}

test_wrong_audience_is_denied if {
	not allow with input as testutil.input_for("GET", object.union(base_payload, {"aud": "api://other"}), base_labels)
}

test_missing_required_group_label_fails_closed if {
	not allow with input as testutil.input_for("GET", base_payload, object.remove(base_labels, ["required_group"]))
}

test_empty_group_label_fails_closed if {
	not allow with input as testutil.input_for("GET", base_payload, object.union(base_labels, {"required_group": ""}))
}

test_headers_come_from_the_token if {
	headers["X-User-Provider"] == "okta" with input as testutil.input_for("GET", base_payload, base_labels)
	headers["X-User-Subject"] == "sub-1" with input as testutil.input_for("GET", base_payload, base_labels)
}

test_reason_reports_the_first_failure if {
	reason == "no_group" with input as testutil.input_for("GET", object.remove(base_payload, ["groups"]), base_labels)
}

test_deny_headers_report_provider_subject_decision_and_reason if {
	headers["X-Auth-Provider"] == "okta" with input as testutil.input_for("GET", object.remove(base_payload, ["groups"]), base_labels)
	headers["X-Auth-Subject"] == "sub-1" with input as testutil.input_for("GET", object.remove(base_payload, ["groups"]), base_labels)
	headers["X-Auth-Decision"] == "deny" with input as testutil.input_for("GET", object.remove(base_payload, ["groups"]), base_labels)
	headers["X-Auth-Reason"] == "no_group" with input as testutil.input_for("GET", object.remove(base_payload, ["groups"]), base_labels)
}
