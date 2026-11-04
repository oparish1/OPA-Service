package parity

import data.fixtures
import data.testutil

# A9: for every route-backed capability and every golden case, the provider
# wrapper's decision for the mapped request equals the shared policy's decision.
# The wrapper adds only the audience/issuer checks, which the synthetic token
# below satisfies, so a mismatch means the two sides stopped sharing a rule.

test_gateway_parity if {
	count(parity_mismatches) == 0
}

parity_mismatches contains mismatch if {
	some case in fixtures.cases
	case.capability in data.authz.provider_capabilities
	gateway := case_allow(case)
	shared := data.authz.capabilities[case.capability].allowed with input as case_input(case) with data.authz.config as fixtures.config
	gateway != shared
	mismatch := {"id": case.id, "gateway": gateway, "shared": shared}
}

case_allow(case) := result if {
	case.provider == "entra"
	result := data.entra.allow with input as token_input(case)
}

case_allow(case) := result if {
	case.provider == "okta"
	result := data.okta.allow with input as token_input(case)
}

case_allow(case) := result if {
	case.provider == "google"
	result := data.google.allow with input as token_input(case)
}

token_input(case) := testutil.input_for_path(case.request.method, case.request.path, token_claims(case), provider_labels(case.provider))

provider_labels("entra") := {
	"audience": "api://test",
	"tenant": fixtures.config.entra.tenant,
	"required_role": fixtures.config.entra.required_role,
}

provider_labels("okta") := {
	"audience": "api://test",
	"required_group": fixtures.config.okta.required_group,
}

provider_labels("google") := {
	"audience": "api://test",
	"hosted_domain": fixtures.config.google.hosted_domain,
}

token_claims(case) := object.union(base_claims(case), subject_claims(case))

base_claims(case) := {
	"aud": "api://test",
	"iss": "https://accounts.google.com",
	"scp": case.claims.scopes,
	"roles": case.claims.roles,
	"groups": case.claims.groups,
	"tid": case.claims.tenant,
	"hd": case.claims.hd,
	"email_verified": case.claims.email_verified,
}

subject_claims(case) := {"sub": "subject-1", "uid": "uid-1"} if {
	case.claims.has_subject
}

subject_claims(case) := {} if {
	not case.claims.has_subject
}

case_input(case) := {
	"provider": case.provider,
	"claims": case.claims,
	"request": case.request,
}
