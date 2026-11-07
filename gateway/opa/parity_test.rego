package parity

import data.testutil

# TS-9: for every route-backed capability and every persona, the provider
# wrapper's decision for the mapped request equals the shared policy's decision
# with the same claims. The wrappers add only the audience/issuer checks, which
# the synthetic token below satisfies, so a mismatch means the two sides stopped
# sharing a rule.

test_gateway_parity if {
	count(parity_mismatches) == 0
}

route_capabilities := {route.capability | some route in data.authz.routes.suffixes} | {data.authz.routes.fallback.safe, data.authz.routes.fallback.unsafe}

route_request(cap, provider) := {"method": "GET", "path": sprintf("/%s%s", [provider, route.suffix])} if {
	some route in data.authz.routes.suffixes
	route.capability == cap
}

route_request(cap, provider) := {"method": "GET", "path": sprintf("/%s/v1/me", [provider])} if {
	cap == data.authz.routes.fallback.safe
}

route_request(cap, provider) := {"method": "POST", "path": sprintf("/%s/v1/me", [provider])} if {
	cap == data.authz.routes.fallback.unsafe
}

parity_mismatches contains mismatch if {
	some persona in data.fixtures.personas
	some cap in route_capabilities
	request := route_request(cap, persona.provider)
	gateway := provider_allow(persona.provider, token_input(persona, request))
	shared := data.authz.capabilities[cap].allowed with input as authz_input(persona, request) with data.authz.config as data.fixtures.config
	gateway != shared
	mismatch := {"persona": persona.id, "capability": cap, "gateway": gateway, "shared": shared}
}

provider_allow(provider, token) := result if {
	provider == "entra"
	result := data.entra.allow with input as token
}

provider_allow(provider, token) := result if {
	provider == "okta"
	result := data.okta.allow with input as token
}

provider_allow(provider, token) := result if {
	provider == "google"
	result := data.google.allow with input as token
}

token_input(persona, request) := testutil.input_for_path(request.method, request.path, token_payload(persona), provider_labels(persona.provider))

token_payload(persona) := object.union(base_payload(persona), {"sub": "subject-1", "uid": "uid-1"}) if {
	persona.claims.has_subject
}

token_payload(persona) := base_payload(persona) if {
	not persona.claims.has_subject
}

base_payload(persona) := {
	"aud": "api://test",
	"iss": "https://accounts.google.com",
	"scp": persona.claims.scopes,
	"roles": persona.claims.roles,
	"groups": persona.claims.groups,
	"tid": persona.claims.tenant,
	"hd": persona.claims.hd,
	"email_verified": persona.claims.email_verified,
}

provider_labels("entra") := {"audience": "api://test", "tenant": data.fixtures.config.entra.tenant}

provider_labels("okta") := {"audience": "api://test"}

provider_labels("google") := {"audience": "api://test", "hosted_domain": data.fixtures.config.google.hosted_domain}

authz_input(persona, request) := {"provider": persona.provider, "claims": persona.claims, "request": request}
