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

The highest-priority finding is the fixed Flask signing-key fallback used
outside the Vault-configured Compose path. Since Flask's signed session is
used to identify authenticated users, a reachable instance using that fallback
can accept forged sessions. There is also no network segmentation between
several default-network services, so a compromised Compose peer can contact
the backend or database without traversing the WAF.

## Requirement assessment

| Area | Assessment | Evidence |
|---|---|---|
| WAF reverse proxy and frontend API routing | Implemented in configuration; not verified live | Nginx routes `/api/` and `/auth/` to Flask and other paths to Vite in `waf/nginx/default.conf.template`. The frontend API client uses the current browser origin in `fe/src/services/apiClient.js`. |
| ModSecurity blocking and CRS | Configured; not verified live | `waf/modsecurity.env` sets `MODSEC_RULE_ENGINE=On`, request-body inspection, CRS paranoia and anomaly thresholds. Compose pins the OWASP CRS image. No active container was available to confirm runtime configuration or rule loading. |
| SQL injection and XSS detection | Configured by the pinned CRS image/default rule families; probes not rerun | `docs/waf.md` identifies CRS SQLi (942) and XSS (941) families and records previous local probe outcomes. This review could not independently reproduce them. |
| Request inspection and audit logging | Configured; not verified live | Request-body inspection is enabled. Relevant ModSecurity audit events are directed to stdout with matched-rule parts. The configured audit parts intentionally omit request/response bodies and headers. |
| No externally published backend bypass | Implemented in Compose; static port check passed | Rendered Compose publishes only WAF port 8080. Flask, frontend, PostgreSQL, Vault, and Vault Agent have no published host ports. Internal Compose peers can still bypass the WAF; see findings. |
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
| 1 | 🟠 HIGH | [be/app/config.py](be/app/config.py#L88) | 88–91 | When Vault is not configured and no explicit `SECRET_KEY` is supplied, Flask falls back to a fixed development signing key. Flask uses signed session data for `user_id` ([auth_service.py](be/app/services/auth_service.py#L14)); the standalone runner binds to `0.0.0.0` ([run.py](be/run.py#L11)). A reachable non-Compose instance using the fallback may accept forged sessions. | 9/10 |
| 2 | 🟡 MEDIUM | [docker-compose.yml](docker-compose.yml#L22) | 22–81, 181–183 | Backend, frontend, WAF, and PostgreSQL share Compose's default network. A compromised peer container on that network can contact Flask/PostgreSQL directly and bypass the WAF. This is an internal lateral-access path, not a published host/Internet bypass. | 9/10 |
| 3 | ⚪ LOW | [be/Dockerfile](be/Dockerfile#L16) | 16 | `COPY . .` copies the backend build context and no backend `.dockerignore` is present. If a developer puts local credentials or private data inside `be/`, those files can be baked into an image. No such tracked credential was found; this is a build-context exposure risk. | 8/10 |

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
- `SESSION_COOKIE_SECURE` defaults to `false`; production HTTPS deployment
  must set it to `true`.
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
- Only the WAF is published to the host, but the default Compose network is
  not divided into narrower frontend/WAF/backend/database segments.

## Tests performed

| Command/check | Result |
|---|---|
| `docker compose config --quiet` | Pass |
| Rendered Compose assertions for ports, internal networks, AppRole wiring, and backend secret environment | Pass |
| `git check-ignore` and `git ls-files` checks for the three bootstrap credential paths | Pass |
| Tracked-file scan for non-placeholder secret assignments | No committed secret assignments detected |
| `docker compose ps -a --format json` | No containers for the target project |
| `docker volume ls --filter label=com.docker.compose.project=ds` | No Vault data volume for the target project |
| `cd fe && npm test` | Could not run: `vitest` is not installed |
| `cd be && pytest -q tests` (isolated temporary environment) | 39 passed, 1 failed |
| `cd be && pytest -q tests/test_grading.py` | 3 passed, 1 failed; reproduces the suite failure in isolation |
| `git diff --check` | Pass |

The backend failure is
`test_grading.py::GradingTests::test_grade_lifecycle_audit_and_publishing`,
which expects an unpublished grade not to appear in the student's grade list.
It is a grading behavior test, not a WAF/Vault test. A SQLAlchemy legacy API
warning was also emitted. The temporary test environment was removed after
the test run.

No containers were started, no Vault data was initialized, and no credentials
or secret values were printed during this review.
