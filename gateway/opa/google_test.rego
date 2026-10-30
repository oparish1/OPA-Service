package google

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

test_read_is_allowed if {
	allow with input as testutil.input_for("GET", base_payload, base_labels)
}

test_post_is_denied_for_google if {
	not allow with input as testutil.input_for("POST", base_payload, base_labels)
}

test_head_is_denied_for_google if {
	not allow with input as testutil.input_for("HEAD", base_payload, base_labels)
}

test_options_is_denied_for_google if {
	not allow with input as testutil.input_for("OPTIONS", base_payload, base_labels)
}

test_wrong_hosted_domain_is_denied if {
	not allow with input as testutil.input_for("GET", object.union(base_payload, {"hd": "other.example"}), base_labels)
}

test_missing_hosted_domain_is_denied if {
	not allow with input as testutil.input_for("GET", object.remove(base_payload, ["hd"]), base_labels)
}

test_unverified_email_is_denied if {
	not allow with input as testutil.input_for("GET", object.union(base_payload, {"email_verified": false}), base_labels)
}

test_personal_gmail_is_denied if {
	not allow with input as testutil.input_for("GET", object.remove(base_payload, ["hd"]), base_labels)
}

test_wrong_audience_is_denied if {
	not allow with input as testutil.input_for("GET", object.union(base_payload, {"aud": "other-client"}), base_labels)
}

test_wrong_issuer_is_denied if {
	not allow with input as testutil.input_for("GET", object.union(base_payload, {"iss": "https://example.com"}), base_labels)
}

test_headers_come_from_the_token if {
	headers["X-User-Provider"] == "google" with input as testutil.input_for("GET", base_payload, base_labels)
	headers["X-User-Subject"] == "sub-1" with input as testutil.input_for("GET", base_payload, base_labels)
}

test_reason_reports_the_first_failure if {
	reason == "wrong_hd" with input as testutil.input_for("GET", object.remove(base_payload, ["hd"]), base_labels)
}

test_deny_headers_report_provider_subject_decision_and_reason if {
	headers["X-Auth-Provider"] == "google" with input as testutil.input_for("HEAD", base_payload, base_labels)
	headers["X-Auth-Subject"] == "sub-1" with input as testutil.input_for("HEAD", base_payload, base_labels)
	headers["X-Auth-Decision"] == "deny" with input as testutil.input_for("HEAD", base_payload, base_labels)
	headers["X-Auth-Reason"] == "method_not_allowed" with input as testutil.input_for("HEAD", base_payload, base_labels)
}
