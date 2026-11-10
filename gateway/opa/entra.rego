package entra

# The APISIX plugin contract keeps the historical `entra` package name; the
# wrapper logic lives once in authz-service.
import data.authz.v1.gateway.entra as gateway

allow := gateway.allow

headers := gateway.headers

reason := gateway.reason
