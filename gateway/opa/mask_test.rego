package system.log

# The paths the decision log must erase; a mask that drops one of them leaks
# either the bearer token or the matched route's provider secret.
test_mask_erases_the_request_credentials if {
	mask[_] == "/input/request/headers/authorization"
}

test_mask_erases_the_matched_route_config if {
	mask[_] == "/input/route/plugins"
}
