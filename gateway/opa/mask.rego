package system.log

# OPA serializes the whole decision input into the console decision log. APISIX
# puts the verified bearer token in `input.request.headers.authorization` and
# the matched route's `openid-connect` config (including its `client_secret`) in
# `input.route.plugins`, so both are erased before the line is written. This is
# the project's "tokens are never logged" rule (docs/ARCHITECTURE.md).
mask := [
	"/input/request/headers/authorization",
	"/input/route/plugins",
]
