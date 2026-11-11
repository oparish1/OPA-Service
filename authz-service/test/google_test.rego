package authz.v1.gateway.google

import data.testutil

base_labels := {"audience": "google-client-id", "hosted_domain": "agentic-advantage.com"}

base_payload := {
	"iss": "https://accounts.google.com",
	"aud": "google-client-id",
	"sub": "sub-1",
	"email": "user@agentic-advantage.com",
	"email_verified": true,
	"hd": "agentic-advantage.com",
}

# Claim tests run against a mapped route; a pathless request resolves to the
# admin-only unmapped fallback and would not exercise the intended capability.
read_input(method, payload) := testutil.input_for_path(method, "/google/v1/me", payload, base_labels)

write_input(payload) := testutil.input_for_path("POST", "/google/v1/send", payload, base_labels)

test_read_is_allowed if {
	allow with input as read_input("GET", base_payload)
}

test_post_is_denied_for_google if {
	not allow with input as write_input(base_payload)
}

test_head_is_denied_for_google if {
	not allow with input as read_input("HEAD", base_payload)
}

test_options_is_denied_for_google if {
	not allow with input as read_input("OPTIONS", base_payload)
}

test_wrong_hosted_domain_is_denied if {
	not allow with input as read_input("GET", object.union(base_payload, {"hd": "other.example"}))
}

test_missing_hosted_domain_is_denied if {
	not allow with input as read_input("GET", object.remove(base_payload, ["hd"]))
}

test_unverified_email_is_denied if {
	not allow with input as read_input("GET", object.union(base_payload, {"email_verified": false}))
}

test_personal_gmail_is_denied if {
	not allow with input as read_input("GET", object.remove(base_payload, ["hd"]))
}

test_wrong_audience_is_denied if {
	not allow with input as read_input("GET", object.union(base_payload, {"aud": "other-client"}))
}

test_projects_are_denied_with_insufficient_role if {
	not allow with input as testutil.input_for_path("GET", "/google/v1/projects", base_payload, base_labels)
}

test_projects_insufficient_role_audit_reason if {
	reason == "insufficient_role" with input as testutil.input_for_path("GET", "/google/v1/projects", base_payload, base_labels)
}

test_wrong_issuer_is_denied if {
	not allow with input as read_input("GET", object.union(base_payload, {"iss": "https://example.com"}))
}

test_missing_hosted_domain_label_fails_closed if {
	not allow with input as testutil.input_for_path("GET", "/google/v1/me", base_payload, object.remove(base_labels, ["hosted_domain"]))
}

test_empty_hosted_domain_label_fails_closed if {
	not allow with input as testutil.input_for_path("GET", "/google/v1/me", object.union(base_payload, {"hd": ""}), object.union(base_labels, {"hosted_domain": ""}))
}

test_headers_come_from_the_token if {
	headers["X-User-Provider"] == "google" with input as read_input("GET", base_payload)
	headers["X-User-Subject"] == "sub-1" with input as read_input("GET", base_payload)
}

test_reason_reports_the_first_failure if {
	reason == "wrong_hd" with input as read_input("GET", object.remove(base_payload, ["hd"]))
}

test_write_deny_reason_keeps_the_claim_failures if {
	reason == "email_unverified,method_not_allowed,wrong_hd" with input as write_input(object.union(base_payload, {"hd": "other.example", "email_verified": false}))
}

test_deny_headers_report_provider_subject_decision_and_reason if {
	headers["X-Auth-Provider"] == "google" with input as read_input("HEAD", base_payload)
	headers["X-Auth-Subject"] == "sub-1" with input as read_input("HEAD", base_payload)
	headers["X-Auth-Decision"] == "deny" with input as read_input("HEAD", base_payload)
	headers["X-Auth-Reason"] == "method_not_allowed" with input as read_input("HEAD", base_payload)
}
