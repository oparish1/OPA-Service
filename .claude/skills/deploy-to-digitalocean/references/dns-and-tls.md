# DNS and HTTPS

Stage 5. Point the domain at the droplet and get a valid certificate. The proxy in the stack (for example Caddy) obtains and renews certificates automatically once DNS and ports are right.

## Contents
1. Decide first
2. Before changing DNS
3. Records
4. Getting the certificate
5. Common failures
6. Email and other records
7. Checkpoint

## 1. Decide first (owner commitments)

- The exact hostnames: apex domain, `www`, subdomains for the app, an API, or staging.
- Where DNS is hosted: DigitalOcean DNS (the domain's nameservers must be delegated to DigitalOcean at the registrar) or an existing provider where records are edited.
- Redirect policy between apex and `www`.
- Whether to use a Reserved IP so the address is stable across droplet rebuilds.
- Whether IPv6 is enabled on the droplet, in which case AAAA records must also be correct or omitted.

## 2. Before changing DNS

- Confirm the app works via the droplet's IP or a hosts-file entry, with the proxy configured for the final domain.
- Confirm the Cloud Firewall and host firewall allow inbound 80 and 443 (the ACME HTTP challenge needs 80; HTTP/3 needs 443/udp).
- If replacing an existing site, lower the record TTL well in advance (at least as long as the old TTL) so the cutover propagates quickly and can be reversed. Record the current values before editing.
- Ensure no other service on the droplet already listens on 80 or 443.

## 3. Records

- **A** record for each hostname pointing at the droplet's (or Reserved) IPv4 address. **AAAA** for IPv6 only if the stack listens on it.
- **CNAME** for `www` to the apex (or its own A record); CNAMEs are not allowed at the zone apex.
- Optional **CAA** records restricting which authorities may issue certificates; if used, they must permit the authority the proxy uses, or issuance fails. Look up the proxy's default authority.
- Keep unrelated existing records (mail, verification) untouched.
- Verify with DNS queries from more than one resolver, including one that bypasses local caches, before expecting certificate issuance.

## 4. Getting the certificate

- With Caddy, issuance happens automatically on the first request for a name that resolves to the server and answers on 80/443. Give it a clean start: correct DNS, open ports and a **persistent data volume** for its certificate storage; losing that volume on every redeploy risks hitting certificate authority rate limits.
- During testing, consider the certificate authority's staging environment to avoid rate limits; switch to production once it works and clear the staging state.
- Watch the proxy logs for the challenge succeeding.
- Confirm the certificate chain and expiry from outside with a browser or a TLS client and that HTTP redirects to HTTPS.
- Renewal is automatic while the proxy runs, the ports stay open and storage persists; add an expiry alert anyway (monitoring or an external checker), since silent renewal failure is a classic outage.
- If a different proxy or a load balancer is used, follow its documented certificate process.

## 5. Common failures

- DNS not yet propagated, or pointing at the old server: issuance fails or reaches the wrong host.
- Port 80 blocked at the Cloud Firewall or host firewall.
- Another process on port 80/443.
- A CAA record excluding the issuer.
- Proxy configured with a different hostname than the one requested.
- Rate limiting after repeated failed attempts: wait and fix the cause before retrying.
- AAAA record pointing at an address the droplet does not serve.
- Redirect loops when a CDN or upstream proxy also terminates TLS: agree who terminates TLS.

## 6. Email and other records

If the app sends email, sending requires its own records (SPF, DKIM, DMARC) at the mail provider and outbound mail from droplets may be restricted by the platform; check current policy and use a transactional email service if needed. Record any such requirement as an owner task; do not configure mail transfer software on the droplet unless asked.

## 7. Checkpoint

Stage complete when each hostname resolves to the intended address from multiple resolvers, HTTPS loads with a valid certificate and correct hostname, HTTP redirects to HTTPS, the certificate storage persists across a proxy restart and the owner has an expiry alert. In guide mode, ask for the DNS query results and the TLS check output.
