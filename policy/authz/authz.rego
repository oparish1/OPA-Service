# The one shared claim policy. The gateway wrappers in `gateway/opa/` import this
# package for enforcement and the browser compiles it to WASM for advisory UI
# decisions. It names no capability, role, provider secret, tenant, domain or
# group: the catalogue, the role hierarchy, the claim-to-role map and the route
# table live in the data files beside this policy, and the environment values
# arrive as `data.authz.config`. The browser decision is advisory; the gateway
# is the only security authority.

package authz

# The capability catalogue, role hierarchy and route table are data; the engine
# derives every set below from them.
capability_ids := {cap | some cap, _ in data.authz.catalogue}

baseline_capabilities := {cap | some cap, entry in data.authz.catalogue; entry.kind == "baseline"}

read_capabilities := {cap | some cap, entry in data.authz.catalogue; entry.kind == "read"}

write_capabilities := {cap | some cap, entry in data.authz.catalogue; entry.kind == "write"}

provider_capabilities := capability_ids - baseline_capabilities

# Grant matching accepts the set, array and space-delimited string forms, so a
# caller that has not normalised its scopes still gets the same decision.
scope_granted(scopes, required) if {
	is_set(scopes)
	required in scopes
}

scope_granted(scopes, required) if {
	is_array(scopes)
	required in scopes
}

scope_granted(scopes, required) if {
	is_string(scopes)
	required in split(scopes, " ")
}

# The neutral reason codes, in the order the browser's single `reason` picks one.
# A gateway wrapper translates them to the audit strings the access log carries.
reason_precedence := [
	"method_not_allowed",
	"not_signed_in",
	"missing_role",
	"missing_group",
	"wrong_tenant",
	"wrong_domain",
	"email_unverified",
	"missing_scope",
	"insufficient_role",
]

signed_in if {
	input.claims.has_subject == true
}

# An unknown or missing provider fails closed.
known_provider if {
	data.authz.providers[input.provider]
}

uses_scopes if {
	data.authz.providers[input.provider].uses_scopes == true
}

# A principal's effective roles are its granted roles plus everything those
# roles include. The hierarchy is stored flattened, so one step is enough.
effective_roles := granted_roles | {included |
	some role in granted_roles
	some included in data.authz.roles[role].includes
}

granted_roles := data.authz.providers[input.provider].granted_roles

capability_role(cap) := role if {
	role := data.authz.catalogue[cap].role
	role != null
}

# Provider gate failures cover the base gate (subject, tenant/domain, email) and
# the provider's method rules, never scope or role. The unknown-provider rule
# below denies without consulting them.
gate_failures(cap) := failures if {
	known_provider
	failures := data.authz.providers[input.provider].gate_failures[cap]
}

# `insufficient_role` is reported only after the base gate passes (ignoring the
# provider's method rule), so a principal that fails the base gate keeps exactly
# the gate codes it had before.
base_gate_passed(cap) if {
	count(gate_failures(cap) - {"method_not_allowed"}) == 0
}

scope_failures(cap) := {code |
	code := "missing_scope"
	uses_scopes
	scope := data.authz.catalogue[cap].scope
	scope != null
	not scope_granted(input.claims.scopes, scope)
}

role_failures(cap) := {code |
	code := "insufficient_role"
	required := capability_role(cap)
	base_gate_passed(cap)
	not required in effective_roles
}

# A denied capability carries the set of neutral codes that failed; an allowed
# capability carries the empty set.
deny_reasons(cap) := {"not_signed_in"} if {
	cap in baseline_capabilities
	not signed_in
}

deny_reasons(cap) := set() if {
	cap in baseline_capabilities
	signed_in
}

deny_reasons(cap) := reasons if {
	not cap in baseline_capabilities
	known_provider
	reasons := (gate_failures(cap) | scope_failures(cap)) | role_failures(cap)
}

# An unknown or missing provider fails closed.
deny_reasons(cap) := {"not_signed_in"} if {
	not cap in baseline_capabilities
	not known_provider
}

capability_deny_reasons(cap) := deny_reasons(cap)

capability_allowed(cap) if {
	count(capability_deny_reasons(cap)) == 0
}

primary_reason(reasons) := ordered[0] if {
	ordered := [code | some code in reason_precedence; code in reasons]
	count(ordered) > 0
}

# One browser evaluation returns the decision for every capability.
capabilities := {cap: decision(cap) | some cap in capability_ids}

decision(cap) := {"allowed": true, "reason": ""} if {
	count(capability_deny_reasons(cap)) == 0
}

decision(cap) := {"allowed": false, "reason": primary_reason(capability_deny_reasons(cap))} if {
	count(capability_deny_reasons(cap)) > 0
}

# The gateway maps its (method, path) to a capability through the route table.
# Suffix patterns may contain `*` (one path segment). The leading `**` lets the
# pattern match after whatever prefix APISIX adds to the URI. The longest
# matching suffix wins, and the fallbacks cover every request no route matches.
safe_methods := {"GET", "HEAD", "OPTIONS"}

# A safe method may only match a read route and an unsafe method only a write
# route, so a mutating request can never be authorised as a read capability.
route_kind(method) := "read" if method in safe_methods

route_kind(method) := "write" if not method in safe_methods

route_matches(method, path) := [route |
	some route in data.authz.routes.suffixes
	data.authz.catalogue[route.capability].kind == route_kind(method)
	glob.match(concat("", ["**", route.suffix]), ["/"], path)
]

capability_for(method, path) := capability if {
	matches := route_matches(method, path)
	count(matches) > 0
	longest := max([count(route.suffix) | some route in matches])
	some route in matches
	count(route.suffix) == longest
	capability := route.capability
}

capability_for(method, path) := data.authz.routes.fallback.safe if {
	method in safe_methods
	count(route_matches(method, path)) == 0
}

capability_for(method, path) := data.authz.routes.fallback.unsafe if {
	not method in safe_methods
	count(route_matches(method, path)) == 0
}
