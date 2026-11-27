# ft_transcendence Cybersecurity Review

**Review date:** 2026-11-26
**Scope:** WAF/ModSecurity/CRS, HashiCorp Vault and Flask integration, and
Docker Compose networking, ports, and persistence.
**Review type:** Static configuration/source review plus available tests.
No live WAF or Vault environment was available during this review.

## Executive summary

The repository configures an Nginx/ModSecurity CRS gateway as the only
published host ingress, adds a persistent Vault file-storage volume, and wires
Flask to a dedicated AppRole-authenticated Vault Agent. The backend policy
limits secret reads to one KV v2 path and permits token self-renewal. Static
Compose validation and credential-exclusion checks passed.

This is not evidence that the services work end-to-end. The target Compose
project had no containers or Vault data volume, and its local AppRole
credential directory was absent. Consequently, Vault initialization,
unsealing, policy enforcement, WAF blocking, audit output, backend/PostgreSQL
connectivity, and restart persistence could not be exercised.

The initial review found a fixed Flask signing-key fallback and missing
network segmentation. The remediation follow-up below records the current
working-tree state; runtime Compose isolation and the complete Vault/WAF
integration still require live validation.

The final review additionally identified that the HTTP-only WAF port was
published on all host interfaces by default while secure session cookies
defaulted off. The host binding now defaults to loopback; remote access still
requires a trusted TLS-terminating ingress.

### Remediation follow-up

After the review, the three findings below were addressed in the working tree:

- Flask now fails closed if a strong `SECRET_KEY` is not present outside Vault;
  the test suite uses a test-only key.
- Compose now separates frontend ingress, WAF-to-backend ingress, backend to
  PostgreSQL, backend to Vault Agent, Vault server, and backend outbound
  networking. Only the backend is attached to the outbound network.
- `be/.dockerignore` excludes environment files, credential/secret directories,
  private keys/certificates, local databases, uploads, tests, and local Python
  environments from the backend image build context.
- The WAF host port now binds to `127.0.0.1` by default, preventing direct
  unencrypted access from remote interfaces. Non-loopback binding is documented
  as requiring a trusted TLS-terminating ingress.

The new key-validation test, rendered Compose checks, and frontend tests pass.
Runtime isolation and build-context behavior remain dependent on Docker
execution.

## Requirement assessment

| Area | Assessment | Evidence |
|---|---|---|
| WAF reverse proxy and frontend API routing | Implemented in configuration; not verified live | Nginx routes `/api/` and `/auth/` to Flask and other paths to Vite in `waf/nginx/default.conf.template`. The frontend API client uses the current browser origin in `fe/src/services/apiClient.js`. |
| ModSecurity blocking and CRS | Configured; not verified live | `waf/modsecurity.env` sets `MODSEC_RULE_ENGINE=On`, request-body inspection, CRS paranoia and anomaly thresholds. Compose pins the OWASP CRS image. No active container was available to confirm runtime configuration or rule loading. |
| SQL injection and XSS detection | Configured by the pinned CRS image/default rule families; probes not rerun | `docs/waf.md` identifies CRS SQLi (942) and XSS (941) families and records previous local probe outcomes. This review could not independently reproduce them. |
| Request inspection and audit logging | Configured; not verified live | Request-body inspection is enabled. Relevant ModSecurity audit events are directed to stdout with matched-rule parts. The configured audit parts intentionally omit request/response bodies and headers. |
| No externally published backend bypass | Implemented in Compose; static port and network checks passed | Rendered Compose publishes only WAF port 8080, bound to loopback by default. Flask, frontend, PostgreSQL, Vault, and Vault Agent have no published host ports. Flask shares its backend-ingress network with the WAF; runtime isolation has not been exercised. |
| Persistent Vault storage | Configured; persistence not tested | Compose declares `vault_data` mounted at `/vault/file`; there was no target Vault volume/container to restart. |
| KV v2 and AppRole | Setup documented and client wiring present; live Vault state not verified | README documents CLI commands to enable KV v2/AppRole and create the role and policy. These operations are not automatically provisioned by Compose. The Vault data store was absent. |
| Restrictive backend policy | Implemented as a policy file; enforcement not tested | `vault/policies/backend.hcl` grants `read` on `secret/data/ft-transcendence/backend` and `update` on `auth/token/renew-self`. |
| Vault Agent and Flask secret retrieval | Configured; integration not tested | `vault/agent.hcl` uses AppRole and forces the auto-auth token through the Agent proxy. `be/app/config.py` requests the KV v2 secret during configuration loading and rejects missing/unexpected required data. No Agent or backend container was available. |
| Root token absent from backend configuration | Static check passed; live container check unavailable | Rendered Compose does not pass a backend `env_file`, root token, Vault token, or Secret ID. There was no running backend container to inspect. |
| No committed secrets | Tracked-file scan found no non-placeholder secret assignments; credential ignore checks passed | `vault/credentials/` is Git-ignored. Credential paths tested were untracked. The local ignored `.env` exists but its contents were not inspected. |
| Docker services and persistent data | Configuration exists; end-to-end operation unverified | Compose defines PostgreSQL, Flask, frontend, WAF, Vault, and Vault Agent. PostgreSQL and Vault use named volumes. No containers were running for this project. |

### Requirements fully implemented and tested

- The three bootstrap credential paths (`backend-secret-id`,
  `backend-secrets.json`, and `postgres-password`) are excluded by Git ignore
  rules and are not tracked.
- Compose renders successfully and its rendered port mappings show WAF as the
  only service published to the host.
- Static assertions verified the backend's lack of root/Agent credentials in
  environment configuration, the internal Vault networks, and the declared
  policy path/capabilities.

These are static/configuration tests, not live security tests.

### Implemented but not tested live

- WAF routing, ModSecurity blocking, CRS SQLi/XSS rules, and audit output.
- Vault storage restart persistence, initialization and unsealing.
- KV v2/AppRole provisioning, valid and invalid authentication, token renewal,
  and denied secret/admin operations.
- Flask secret retrieval, secret-free logs, and PostgreSQL connectivity.
- Host-level non-reachability of non-WAF services.

The current checkout has documentation for these workflows, but no runtime
evidence was produced in this review.

### Not implemented or not established

- KV v2, AppRole, policies, and role parameters are configured through
  documented manual CLI commands; there is no committed bootstrap automation
  that establishes their state reproducibly.
- Runtime initialization and policy state are unknown because the Vault
  volume/service are absent.
- Persistent storage for Flask uploads is not declared in Compose; uploads
  written in the backend container filesystem may be lost when its container
  is replaced.
- No production TLS, Vault auto-unseal/HA, or encrypted-at-rest volume
  configuration is established by this local Compose setup.

## Security findings

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🟠 HIGH — mitigated by default loopback binding; runtime not tested | [docker-compose.yml](docker-compose.yml#L89) | 42, 88–89 in final review | HTTP-only WAF was published on all host interfaces and secure session cookies defaulted off. WAF now binds to `127.0.0.1` by default; remote access requires trusted TLS termination. | 8/10 |
| 2 | 🟠 HIGH — remediated and tested | [be/app/config.py](be/app/config.py#L88) | 88–91 in review baseline | Fixed fallback signing key could permit forged sessions when running outside Vault. Config now requires an explicit key of at least 32 characters in that mode. | 9/10 |
| 3 | 🟡 MEDIUM — remediated; static checks passed | [docker-compose.yml](docker-compose.yml#L22) | 22–81, 181–183 in review baseline | Shared default network permitted service-to-service WAF bypass. Services now use segmented networks; Docker runtime isolation is not yet verified. | 9/10 |
| 4 | ⚪ LOW — remediated in build context | [be/.dockerignore](be/.dockerignore) | N/A | Backend image build context now excludes environment files, credentials, secrets, keys/certificates, local databases, and uploads. Image contents were not built or inspected. | 8/10 |

## False-positive and compatibility risks

- CRS runs at paranoia level 1 with an inbound anomaly threshold of 5. This
  baseline may still reject legitimate free-text content that resembles
  attack input. No current false-positive tuning or live benign-traffic test
  was performed.
- Request limits are intentionally strict: the WAF has a 110 MiB total body
  limit, a 1 MiB no-files body limit, and CRS argument/file limits. Valid large
  uploads or unusually large form/JSON payloads may be rejected before Flask.
- Audit settings retain matched-rule details but omit bodies and headers.
  This reduces accidental retention of credentials, cookies, CSRF tokens, and
  uploads, but also limits forensic context.
- The pinned image's default response inspection MIME types do not include
  `application/json`, as documented in `docs/waf.md`. A malicious value
  returned from the database in JSON is therefore not inspected by response
  body rules. Request-side inspection still applies to submitted data.

## Production limitations and residual risks

- The WAF and Vault listeners use HTTP; Vault's server and Agent listener both
  disable TLS. This is limited to the isolated local Compose networks and is
  not suitable for Internet exposure.
- `SESSION_COOKIE_SECURE` defaults to `false` for local HTTP development.
  Production HTTPS deployment must set it to `true`; the loopback binding is
  not a substitute for TLS when remote access is configured.
- Compose networks reduce host exposure but do not encrypt traffic or prevent
  host-root/Docker-daemon administrators from entering containers and reading
  mounted files.
- The AppRole Secret ID is a reusable host file mounted read-only into Agent.
  Git ignore and file permissions are not encryption. A host or Docker
  administrator can access it.
- Vault's file storage is single-node and manually unsealed after restart.
  Named Docker volumes provide persistence, not encryption at rest or
  protected backups. No Vault audit device is configured in the tracked
  server configuration.
- Flask retrieves the secret set at application startup. Secret rotation
  therefore requires restarting Flask; PostgreSQL password rotation must also
  be coordinated with PostgreSQL's actual role password and the protected
  password file.
- Only the WAF is published to the host. Compose now has segmented
  frontend/WAF/backend/database networks; their runtime isolation is not yet
  verified.

## Tests performed

| Command/check | Result |
|---|---|
| `docker compose config --quiet` | Pass |
| Rendered WAF host bind check | Pass: port 8080 binds to 127.0.0.1 by default |
| Rendered network membership check | Pass: services use separate ingress/database/Vault networks; only backend has non-internal outbound network |
| Missing/short non-Vault `SECRET_KEY` config test | Pass |
| `cd fe && npm test` | Pass: 21 tests across 6 files |
| Rendered Compose assertions for ports, internal networks, AppRole wiring, and backend secret environment | Pass |
| `git check-ignore` and `git ls-files` checks for the three bootstrap credential paths | Pass |
| Tracked-file scan for non-placeholder secret assignments | No committed secret assignments detected |
| `docker compose ps -a --format json` | No containers for the target project |
| `docker volume ls --filter label=com.docker.compose.project=ds` | No Vault data volume for the target project |
| `cd be && pytest -q tests` (isolated temporary environment, after remediation) | 40 passed, 1 failed; missing/short-key test passed both subcases |
| Focused key security and related backend tests | 8 passed; 2 key-validation subcases passed |
| `cd be && pytest -q tests/test_grading.py` (before remediation) | 3 passed, 1 failed; reproduces the existing suite failure in isolation |
| `git diff --check` | Pass |

The backend failure is
`test_grading.py::GradingTests::test_grade_lifecycle_audit_and_publishing`,
which expects an unpublished grade not to appear in the student's grade list.
It is a grading behavior test, not a WAF/Vault test. A SQLAlchemy legacy API
warning was also emitted. The temporary isolated test environment was removed after validation.

No containers were started, no Vault data was initialized, and no credentials
or secret values were printed during this review.
