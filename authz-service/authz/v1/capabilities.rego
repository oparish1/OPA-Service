package authz.v1

# The stable capability map. The shared `authz` package owns every decision;
# this package fixes the v1 entry point the frontend and backend consume.
capabilities := data.authz.capabilities
