package okta

# The APISIX plugin contract keeps the historical `okta` package name; the
# wrapper logic lives once in authz-service.
import data.authz.v1.gateway.okta as gateway

allow := gateway.allow

headers := gateway.headers

reason := gateway.reason
