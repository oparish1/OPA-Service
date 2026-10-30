package testutil

# Unit tests exercise claim interpretation only; signature verification is the
# openid-connect plugin's job, so an unsigned token is enough to decode.
unsigned_token(payload) := concat(".", [
	base64url.encode(json.marshal({"alg": "none", "typ": "JWT"})),
	base64url.encode(json.marshal(payload)),
	"",
])

input_for(method, payload, labels) := {
	"request": {
		"method": method,
		"headers": {"authorization": concat(" ", ["Bearer", unsigned_token(payload)])},
	},
	"route": {"labels": labels},
}
