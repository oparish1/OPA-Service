package testutil

# Unit tests exercise claim interpretation only; signature verification is the
# openid-connect plugin's job, so an unsigned token is enough to decode.
unsigned_token(payload) := concat(".", [
	base64url.encode(json.marshal({"alg": "none", "typ": "JWT"})),
	base64url.encode(json.marshal(payload)),
	"",
])

# A request that carries the APISIX path, so the route table is exercised.
input_for_path(method, path, payload, labels) := {
	"request": {
		"method": method,
		"path": path,
		"headers": {"authorization": concat(" ", ["Bearer", unsigned_token(payload)])},
	},
	"route": {"labels": labels},
}
