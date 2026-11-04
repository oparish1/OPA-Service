# The one shared claim policy. The gateway wrappers in `gateway/opa/` import this
# package for enforcement and the browser compiles it to WASM for advisory UI
# decisions. It names no provider secret, tenant, domain or group: those arrive
# as data under `data.authz.config`. The browser decision is advisory; the
# gateway is the only security authority.

package authz

# The capability catalogue. `nav.*` drive what the shell shows; `action.*` drive
# what a request control allows.
capability_ids := [
	"nav.overview",
	"nav.account",
	"nav.api.profile",
	"nav.api.projects",
	"action.api.send.read",
	"action.api.send.write",
]

# Overview and Account are available to any signed-in session; every other
# capability depends on the provider's claims.
baseline_capabilities := {"nav.overview", "nav.account"}

# Read capabilities use the provider's read rule; the write capability uses its
# write rule.
read_capabilities := {"nav.api.profile", "nav.api.projects", "action.api.send.read"}

write_capabilities := {"action.api.send.write"}

provider_capabilities := read_capabilities | write_capabilities

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
]

signed_in if {
	input.claims.has_subject == true
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

deny_reasons(cap) := data.authz.providers[input.provider].deny_by_capability[cap] if {
	not cap in baseline_capabilities
	input.provider
}

# An unknown provider fails closed.
deny_reasons(cap) := {"not_signed_in"} if {
	not cap in baseline_capabilities
	not input.provider
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

# The gateway maps its (method, path) to a capability through this table. The
# path is suffix-matched because APISIX passes the full `/entra/v1/me` URI.
safe_methods := {"GET", "HEAD", "OPTIONS"}

capability_for(method, path) := "nav.api.projects" if {
	method in safe_methods
	endswith(path, "/v1/projects")
}

capability_for(method, path) := "nav.api.profile" if {
	method in safe_methods
	not endswith(path, "/v1/projects")
}

capability_for(method, _) := "action.api.send.write" if {
	not method in safe_methods
}
