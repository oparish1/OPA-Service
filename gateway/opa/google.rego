package google

# The APISIX plugin contract keeps the historical `google` package name; the
# wrapper logic lives once in authz-service.
import data.authz.v1.gateway.google as gateway

allow := gateway.allow

headers := gateway.headers

reason := gateway.reason
