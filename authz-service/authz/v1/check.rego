package authz.v1.check

# The stable decision entry point for the backend. `capability` is resolved
# before the `with` expression replaces `input`, so the route lookup sees the
# request's action and resource and the decision then evaluates the subject's
# claims under the same input. The default is closed: an undefined capability or
# decision denies with an empty reason.

default allowed := false

default reason := ""

decision := result if {
	capability := data.authz.capability_for(input.action, input.resource)
	subject_input := {
		"provider": input.subject.provider,
		"claims": input.subject.claims,
		"request": {"method": input.action, "path": input.resource},
	}
	result := data.authz.decision(capability) with input as subject_input
}

allowed if {
	decision.allowed
}

reason := decision.reason if {
	not decision.allowed
}
