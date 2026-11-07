package authz

# The decision suite. Every table-driven check collects the mismatches and
# asserts the set is empty, so one wrong case cannot hide behind a passing one.

fixture_config := data.fixtures.config

persona(id) := p if {
	some p in data.fixtures.personas
	p.id == id
}

persona_input(id) := result if {
	p := persona(id)
	result := {"provider": p.provider, "claims": p.claims, "request": {}}
}

# --- gate cases ------------------------------------------------------------

test_gate_cases if {
	count(gate_case_mismatches) == 0
}

gate_case_mismatches contains mismatch if {
	some case in data.fixtures.gate_cases
	inp := case_input(case)
	actual := data.authz.decision(case.capability) with input as inp with data.authz.config as fixture_config
	expected := {"allowed": case.allowed, "reason": case.reason}
	actual != expected
	mismatch := {"id": case.id, "expected": expected, "actual": actual}
}

test_gate_case_deny_sets if {
	count(gate_deny_mismatches) == 0
}

gate_deny_mismatches contains mismatch if {
	some case in data.fixtures.gate_cases
	inp := case_input(case)
	actual := data.authz.capability_deny_reasons(case.capability) with input as inp with data.authz.config as fixture_config
	expected := {code | some code in case.reasons}
	actual != expected
	mismatch := {"id": case.id, "expected": expected, "actual": actual}
}

case_input(case) := result if {
	claims := object.get(case, "claims", null)
	claims != null
	result := {"provider": case.provider, "claims": claims, "request": object.get(case, "request", {})}
}

case_input(case) := result if {
	object.get(case, "claims", null) == null
	p := persona(case.persona)
	result := {"provider": p.provider, "claims": p.claims, "request": object.get(case, "request", {})}
}

# --- invariants ------------------------------------------------------------

# 1. A signed-out principal is denied every capability, baseline included.
test_invariant_signed_out_denied if {
	count({[persona.id, cap] |
		some persona in data.fixtures.personas
		persona.claims.has_subject == false
		some cap in data.authz.capability_ids
		decision := data.authz.decision(cap) with input as persona_input(persona.id) with data.authz.config as fixture_config
		decision.allowed
	}) == 0
}

# 2. A principal with only the read scope is denied every write capability.
test_invariant_read_scope_denies_write if {
	count({[persona.id, cap] |
		some persona in data.fixtures.personas
		some cap in data.authz.write_capabilities
		base := persona_input(persona.id)
		scoped := object.union(base, {"claims": object.union(base.claims, {"scopes": ["workspace:read"]})})
		decision := data.authz.decision(cap) with input as scoped with data.authz.config as fixture_config
		decision.allowed
	}) == 0
}

# 3. A claim value that is not in the role map grants no non-baseline capability.
test_invariant_unmapped_grants_nothing if {
	count({[persona.id, cap] |
		some persona in data.fixtures.personas
		endswith(persona.id, "-unmapped")
		some cap in data.authz.provider_capabilities
		decision := data.authz.decision(cap) with input as persona_input(persona.id) with data.authz.config as fixture_config
		decision.allowed
	}) == 0
}

# 4. Google is denied every write capability and every capability above its
# default role.
test_invariant_google_ceiling if {
	count({[cap] |
		some cap in data.authz.write_capabilities
		decision := data.authz.decision(cap) with input as persona_input("google-user") with data.authz.config as fixture_config
		decision.allowed
	}) == 0
	count({[cap] |
		some cap in data.authz.provider_capabilities
		role := data.authz.catalogue[cap].role
		not role in {"viewer", "user"}
		decision := data.authz.decision(cap) with input as persona_input("google-user") with data.authz.config as fixture_config
		decision.allowed
	}) == 0
}

# 5. Monotonicity: for the claim-mapped providers, a role that includes a lower
# role is at least as permissive.
test_invariant_monotonicity if {
	count({[provider, cap, higher] |
		some provider in {"entra", "okta"}
		some cap in data.authz.provider_capabilities
		some lower, _ in data.authz.roles
		some higher, _ in data.authz.roles
		lower in data.authz.roles[higher].includes
		allowed_for(provider, cap, lower)
		not allowed_for(provider, cap, higher)
	}) == 0
}

allowed_for(provider, cap, role) if {
	claim := reverse_role_map(provider, role)
	decision := data.authz.decision(cap) with input as {"provider": provider, "claims": role_claims(provider, claim), "request": {}} with data.authz.config as fixture_config
	decision.allowed
}

reverse_role_map(provider, role) := value if {
	some value, mapped in data.authz.role_map[provider]
	mapped == role
}

role_claims("entra", claim) := {"has_subject": true, "roles": [claim], "groups": [], "scopes": ["workspace:read", "workspace:write"], "tenant": fixture_config.entra.tenant, "hd": "", "email_verified": false}

role_claims("okta", claim) := {"has_subject": true, "roles": [], "groups": [claim], "scopes": ["workspace:read", "workspace:write"], "tenant": "", "hd": "", "email_verified": false}

# --- catalogue integrity ---------------------------------------------------

valid_scope(entry) if {
	entry.kind == "baseline"
	entry.role == null
	entry.scope == null
}

valid_scope(entry) if {
	entry.kind == "read"
	entry.role != null
	entry.scope == "workspace:read"
}

valid_scope(entry) if {
	entry.kind == "write"
	entry.role != null
	entry.scope == "workspace:write"
}

role_graph := {role: entry.includes | some role, entry in data.authz.roles}

includes_closure(role) := graph.reachable(role_graph, {role}) - {role}

test_integrity_catalogue if {
	count({[cap] |
		some cap, entry in data.authz.catalogue
		not valid_scope(entry)
	}) == 0
	count({[cap, role] |
		some cap, entry in data.authz.catalogue
		role := entry.role
		role != null
		not data.authz.roles[role]
	}) == 0
}

test_integrity_roles if {
	count({role |
		some role, entry in data.authz.roles
		{included | some included in entry.includes} != includes_closure(role)
	}) == 0
}

test_integrity_role_map if {
	count({[provider, value] |
		some provider, mapping in data.authz.role_map
		provider != "google"
		some _, value in mapping
		not data.authz.roles[value]
	}) == 0
	count({[value] |
		value := data.authz.role_map.google.default_role
		not data.authz.roles[value]
	}) == 0
}

test_integrity_routes if {
	count({[suffix] |
		some route in data.authz.routes.suffixes
		suffix := route.suffix
		not data.authz.catalogue[route.capability]
	}) == 0
	count({[suffix] |
		some route in data.authz.routes.suffixes
		suffix := route.suffix
		count({other | some other in data.authz.routes.suffixes; other.suffix == suffix}) > 1
	}) == 0
	count({[fallback] |
		some fallback, cap in data.authz.routes.fallback
		not data.authz.catalogue[cap]
	}) == 0
}

provider_failure_codes(provider) := {code |
	some cap in data.authz.provider_capabilities
	some code in data.authz.providers[provider].gate_failures[cap]
}

all_failure_codes := (({"not_signed_in", "missing_scope", "insufficient_role"} | provider_failure_codes("entra")) | provider_failure_codes("okta")) | provider_failure_codes("google")

test_integrity_reason_codes if {
	count(all_failure_codes - {code | some code in data.authz.reason_precedence}) == 0
}

# --- sensitive deny list ---------------------------------------------------

test_sensitive_deny if {
	count({[entry.capability, persona_id] |
		some entry in data.fixtures.must_deny
		some persona_id in entry.personas
		decision := data.authz.decision(entry.capability) with input as persona_input(persona_id) with data.authz.config as fixture_config
		decision.allowed
	}) == 0
}

# --- persona snapshot ------------------------------------------------------

test_persona_snapshot if {
	count(snapshot_mismatches) == 0
}

snapshot_mismatches contains mismatch if {
	some persona in data.fixtures.personas
	expected := data.fixtures.snapshot[persona.id]
	decisions := data.authz.capabilities with input as persona_input(persona.id) with data.authz.config as fixture_config
	allowed := {cap | some cap, decision in decisions; decision.allowed}
	expected_allowed := {cap | some cap in expected.allowed}
	allowed != expected_allowed
	mismatch := {"persona": persona.id, "allowed": allowed, "expected": expected_allowed}
}

snapshot_mismatches contains mismatch if {
	some persona in data.fixtures.personas
	expected := data.fixtures.snapshot[persona.id]
	decisions := data.authz.capabilities with input as persona_input(persona.id) with data.authz.config as fixture_config
	denied := {cap: decision.reason | some cap, decision in decisions; not decision.allowed}
	expected_denied := {cap: reason | some cap, reason in expected.denied}
	denied != expected_denied
	mismatch := {"persona": persona.id, "denied": denied, "expected": expected_denied}
}

# --- routes ----------------------------------------------------------------

test_route_table if {
	data.authz.capability_for("GET", "/entra/v1/projects") == "nav.api.projects"
	data.authz.capability_for("HEAD", "/entra/v1/projects") == "nav.api.projects"
	data.authz.capability_for("GET", "/entra/v1/me") == "nav.api.profile"
	data.authz.capability_for("OPTIONS", "/okta/v1/me") == "nav.api.profile"
	data.authz.capability_for("POST", "/entra/v1/me") == "action.api.send.write"
	data.authz.capability_for("DELETE", "/google/v1/projects") == "action.api.send.write"
}

# --- scale -----------------------------------------------------------------

scale_catalogue := object.union(
	{"scale.baseline": {"kind": "baseline", "role": null, "scope": null}},
	{sprintf("scale.read.%03d", [i]): {"kind": "read", "role": "level5", "scope": "workspace:read"} | some i in numbers.range(1, 150)},
)

scale_roles := {
	"level1": {"includes": []},
	"level2": {"includes": ["level1"]},
	"level3": {"includes": ["level1", "level2"]},
	"level4": {"includes": ["level1", "level2", "level3"]},
	"level5": {"includes": ["level1", "level2", "level3", "level4"]},
}

scale_input(claim) := {"provider": "entra", "claims": {"has_subject": true, "roles": [claim], "scopes": ["workspace:read"], "tenant": "tenant-1"}, "request": {}}

test_scale if {
	granted := data.authz.capabilities with input as scale_input("Workspace.Level5") with data.authz.catalogue as scale_catalogue with data.authz.roles as scale_roles with data.authz.role_map as {"entra": {"Workspace.Level5": "level5"}} with data.authz.config as fixture_config
	allowed := {cap | some cap, decision in granted; decision.allowed}
	expected := {cap | some cap, _ in scale_catalogue}
	count(expected - allowed) == 0

	limited := data.authz.capabilities with input as scale_input("Workspace.Level1") with data.authz.catalogue as scale_catalogue with data.authz.roles as scale_roles with data.authz.role_map as {"entra": {"Workspace.Level1": "level1"}} with data.authz.config as fixture_config
	count({cap | some cap, decision in limited; decision.allowed; cap != "scale.baseline"}) == 0
}
