# Web Application Firewall

## Architecture

The public application entry point is the `waf` Compose service, using the
OWASP-maintained `owasp/modsecurity-crs` Nginx image pinned to
`4.25.2-nginx-202611190211-lts` and its verified manifest-list digest. This is
the CRS 4.25.2 LTS image; it bundles Nginx 1.30.7 and ModSecurity 3.0.17.
ModSecurity runs in blocking mode. CRS uses paranoia level 1 for both detection
and blocking, with inbound and outbound anomaly thresholds of 5 and 4.
These are CRS's baseline thresholds: lower thresholds would make single
lower-severity matches more likely to block legitimate traffic; higher
thresholds could let several attack indicators pass without blocking.
Paranoia level 1 catches common attack patterns while minimizing false
positives compared with higher levels. Higher levels can detect more evasive
patterns but need application-specific testing and targeted tuning before
blocking.

The allowed-method list includes the GET, HEAD, POST, PUT, DELETE, and OPTIONS
methods used by the current API. CRS's SQL injection (942), XSS (941), LFI
(930), RCE (932), and protocol enforcement (920) rule families remain enabled;
no CRS rule group is disabled.

Nginx sends `/api/` and `/auth/` to Flask and all other paths to the existing
Vite frontend. The frontend API client takes its base URL from the browser's
current origin, so API requests use the same WAF endpoint as the page and keep
their existing `/api/...` paths and credential behavior. Credentialed backend
CORS is restricted to the exact `WAF_PUBLIC_ORIGIN`; same-origin browser
requests do not rely on CORS. Only the WAF publishes a host port (`8080` by
default). Flask, Vite, and PostgreSQL remain in Compose and are not published
to the host.

The WAF applies a 110 MiB request-body limit, matching Flask's configured
maximum. Non-file bodies are limited to 1 MiB, and the ModSecurity argument
count is capped at 255. CRS argument limits allow up to 255 arguments, 100
characters per argument name, 1,024 characters per argument (matching the
backend password limit), and 64 KiB of combined argument data. Individual
files are capped at 100 MiB and combined file data at 110 MiB, preserving the
backend's 100 MiB submission capability while retaining the overall request
cap. Response inspection is enabled up to 1 MiB with partial processing above
that limit. The pinned image's default inspected response MIME types are
`text/plain`, `text/html`, and `text/xml`; API `application/json` responses are
not inspected by response-body rules. The outbound anomaly threshold is still
configured to 4, but extending response inspection to JSON should be tested
against user-generated comments and other application data to avoid false
positives.

ModSecurity rejects requests exceeding its body limit and audits relevant
blocked/server-error responses to container stdout. Compose's Docker JSON log
driver retains and rotates up to five 10 MiB log files. Audit parts exclude
request and response headers and bodies to avoid retaining cookies, CSRF
tokens, uploaded files, passwords, and other body data; matched rule details
are retained. Nginx access and ModSecurity error logs provide request
method/path/status for correlation.

## Configuration files

- `waf/nginx/default.conf.template` defines reverse-proxy routes, body limits,
  request timeouts, and the image's health endpoint include. Compose checks
  that endpoint over HTTP on the configured listener.
- `waf/nginx/00-connection-map.conf.template` maps WebSocket upgrade requests
  to the correct upstream `Connection` header.
- `waf/nginx/proxy-headers.conf.template` forwards the original host and
  protocol, sets the client address from the WAF connection, and enables Vite's
  WebSocket upgrade requests.
- `waf/nginx/security-headers.conf.template` sets content-type, framing,
  referrer, and browser-permissions headers. HSTS is intentionally not set on
  the local HTTP endpoint.
- `waf/modsecurity.env` sets the pinned image's supported ModSecurity and CRS
  runtime variables: blocking mode, paranoia/scoring, application-compatible
  request limits, response inspection, and safe audit output.
- `waf/modsecurity-override.conf.template` sets ModSecurity directives for
  request/response inspection and parser limits. Audit directives are
  generated from `waf/modsecurity.env`.
  This file contains ModSecurity engine directives, not changes to official
  CRS rule files. No custom rules or false-positive exclusions are currently
  needed. Any future custom rules should be stored in a separate custom rules
  file and use narrow, rule-specific exclusions rather than disabling a CRS
  group.

The Nginx files are mounted into the pinned image's verified
`/etc/nginx/templates/` paths. The ModSecurity override uses the image's
`/etc/nginx/templates/modsecurity.d/` hook, which is copied into the active
`/etc/modsecurity.d/` configuration before CRS loads. The image loads CRS setup
before its official rule files; local settings do not edit or replace those
files.

## Local commands

From the repository root, copy `.env.example` to `.env` if needed and set
database credentials and application secrets. `WAF_PUBLIC_ORIGIN` defaults to
`http://localhost:8080`; Compose uses it for the Flask frontend origin and
Microsoft callback even if older local `.env` values point directly at Flask.
If Microsoft sign-in is enabled, use
`http://localhost:8080/auth/microsoft/callback` as the redirect URI in the
Microsoft application registration. Compose derives the callback from
`WAF_PUBLIC_ORIGIN`.

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Open `http://localhost:8080`. Inspect Nginx and ModSecurity audit logs with:

```bash
docker compose logs -f waf
docker compose logs --since=10m waf | grep -E 'ModSecurity|949110|949111'
```

Check a representative blocked request and that the browser app is served
through the gateway:

```bash
curl -i http://localhost:8080/api/auth/csrf
curl -i 'http://localhost:8080/?id=%27%20OR%201=1--'
curl -i 'http://localhost:8080/?q=%3Cscript%3Ealert(1)%3C/script%3E'
curl -i 'http://localhost:8080/?file=../../../../etc/passwd'
curl -i 'http://localhost:8080/?cmd=%3Bcat%20/etc/passwd'
curl -i 'http://localhost:8080/?x=%00'
curl -i -X TRACE http://localhost:8080/
curl -I http://localhost:8080/
```

Expected outcomes: the health endpoint, homepage, and CSRF endpoint return
`200`; the SQLi, XSS, LFI, RCE, and null-byte protocol probes should be blocked
with `403` and logged by CRS. In local testing they matched rule families
942100 (SQLi), 941100 (XSS), 930100/930110 (LFI), 932 (RCE), and 920270
(protocol). `TRACE` is not in the allowed-method list and currently returns
`405` from the upstream app; do not treat that status as a ModSecurity block.
An intentionally unknown login should reach Flask and return `401`, not be
rejected by CRS. A valid registration in a test database should return `201`.

To check login-shaped JSON and normal CSRF handling without a valid account:

```bash
csrf_json=$(curl -sS -c /tmp/waf-cookies http://localhost:8080/api/auth/csrf)
csrf_token=$(printf '%s' "$csrf_json" | sed -n 's/.*"csrf_token":"\([^"]*\)".*/\1/p')
curl -i -b /tmp/waf-cookies -H "X-CSRF-Token: $csrf_token" \
  -H 'Content-Type: application/json' \
  --data '{"email":"unknown@example.invalid","password":"test-password"}' \
  http://localhost:8080/api/auth/login
```

For a benign upload-parser test, obtain a CSRF token the same way, then send a
small test file without authenticating. A `401` from Flask authentication is
expected; a ModSecurity body/parser rejection is not:

```bash
curl -i -b /tmp/waf-cookies -H "X-CSRF-Token: $csrf_token" \
  -F 'file=@/etc/hostname;type=text/plain' \
  http://localhost:8080/api/student/teams/1/submission
```

The unauthenticated multipart test returned `401` locally, confirming the
request passed the WAF and reached Flask auth handling. With a test account,
also verify valid avatar, PDF requirements, task attachment, and submission
uploads under their application category limits.

The backend and database intentionally have no host port mappings. Confirm
that with:

```bash
docker compose ps
docker inspect --format '{{json .NetworkSettings.Ports}}' team-platform-backend team-platform-frontend team-platform-postgres
```

## Deployment notes

This Compose setup is for local HTTP development and must not be exposed
directly to the Internet. Before public deployment, configure a trusted TLS
listener at the WAF, set `SESSION_COOKIE_SECURE=true`, and register the HTTPS
Microsoft callback.
Do not publish Flask, Vite, or PostgreSQL ports as an alternate ingress path.
Review audit records for false positives while retaining blocking mode; add
only narrow, evidence-based CRS exclusions if application traffic is blocked.
The response MIME limitation above means a malicious value already stored in
the database and returned through a JSON API is not detected by response-body
rules; request-side CRS inspection still applies when that value is submitted.
