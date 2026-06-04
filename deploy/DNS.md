# Namecheap DNS records for strykdapp.com

Server Elastic IP: **`98.84.244.237`**
(EC2 `i-0f3b9391f1dfb4a5a`, eipalloc `eipalloc-034858689fea292a9`, us-east-1)

## 1. Host records — wildcard subdomain routing

In the Namecheap dashboard: **Domain List → strykdapp.com → Manage → Advanced DNS → Host Records**.

Delete any default "parking" / CNAME records Namecheap pre-populates, then add:

| Type        | Host  | Value            | TTL       | Purpose                                   |
|-------------|-------|------------------|-----------|-------------------------------------------|
| `A` Record  | `@`   | `98.84.244.237`  | Automatic | Apex `strykdapp.com` → server                 |
| `A` Record  | `*`   | `98.84.244.237`  | Automatic | Wildcard `*.strykdapp.com` → server (every user subdomain, e.g. `edger.strykdapp.com`) |
| `A` Record  | `www` | `98.84.244.237`  | Automatic | `www.strykdapp.com` → server (optional)       |

The single `*` wildcard A record is what makes every `{slug}.strykdapp.com` resolve to
the box. Nginx receives the Host header and proxies to FastAPI, which does the
slug lookup — no per-user DNS or per-user server config required.

## 2. TXT record — Let's Encrypt wildcard (DNS-01 challenge)

A wildcard certificate (`*.strykdapp.com`) **cannot** be issued via HTTP validation —
Let's Encrypt requires DNS-01. When `setup.sh` runs `certbot certonly --manual
--preferred-challenges dns`, Certbot prints a value like:

```
Please deploy a DNS TXT record under the name:
_acme-challenge.strykdapp.com
with the following value:
gfj8N...big-random-string...A2k
```

Add it at Namecheap **before pressing Enter** in the certbot prompt:

| Type         | Host               | Value                                  | TTL       |
|--------------|--------------------|----------------------------------------|-----------|
| `TXT` Record | `_acme-challenge`  | `<the exact value certbot prints>`     | `1 min`   |

Notes:
- Host is `_acme-challenge` (Namecheap appends `.strykdapp.com` automatically — do
  **not** type the full domain).
- Certbot covering both `strykdapp.com` and `*.strykdapp.com` may ask for **two** TXT
  values under the same `_acme-challenge` host — add both as separate TXT records.
- Wait ~1–2 minutes for propagation, verify with
  `dig +short TXT _acme-challenge.strykdapp.com`, then continue certbot.
- On renewal (`certbot renew`) the TXT value changes — the manual DNS hook must
  be re-run, or switch to the Namecheap DNS plugin / Route 53 for automation.

## 3. Verify

```sh
dig +short strykdapp.com            # → 98.84.244.237
dig +short anything.strykdapp.com   # → 98.84.244.237  (wildcard works)
dig +short TXT _acme-challenge.strykdapp.com   # during cert issuance only
```
