package authz

import data.fixtures

# The golden decision table: the same JSON the browser test loads into the real
# WASM. A mismatch is collected rather than first-failed so a failing case can
# be read with `opa eval 'data.authz.mismatches'`.

test_golden_decisions if {
	count(mismatches) == 0
}

mismatches contains mismatch if {
	some case in fixtures.cases
	decision := data.authz.decision(case.capability) with input as case_input(case) with data.authz.config as fixtures.config
	decision != {"allowed": case.allowed, "reason": case.reason}
	mismatch := {
		"id": case.id,
		"expected": {"allowed": case.allowed, "reason": case.reason},
		"actual": decision,
	}
}

case_input(case) := {
	"provider": case.provider,
	"claims": case.claims,
	"request": object.get(case, "request", {}),
}
