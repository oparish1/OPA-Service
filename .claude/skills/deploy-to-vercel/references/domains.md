# Custom domains

1. Add: `vercel domains add example.com <project>` or dashboard > Project > Settings > Domains.
2. Vercel reports the DNS records required for that project. Use those values, not remembered IPs.
   - Apex/root: typically an `A` record.
   - `www` or subdomain: typically a `CNAME`.
   - Alternative: point the registrar's nameservers at Vercel to let it manage DNS.
3. Decide the canonical host (apex vs `www`) and configure the other to redirect to it.
4. Verify: `vercel domains inspect example.com`, then `curl -sI https://example.com`.
5. TLS certificates are issued automatically once DNS resolves. Propagation can take minutes to hours.

Pitfalls: an existing `AAAA` or conflicting `CNAME` blocks verification; a domain already attached to another Vercel project/account needs a TXT verification; CAA records must allow Let's Encrypt.
Never change DNS at the registrar yourself unless the user gives you that access and asks.
