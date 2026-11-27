#!/bin/sh
set -eu

export VAULT_ADDR="http://vault:8200"
CRED_DIR="/vault/credentials"
INIT_FILE="${CRED_DIR}/vault-init.json"
PG_PASS_FILE="${CRED_DIR}/postgres-password"
ROLE_ID_FILE="${CRED_DIR}/backend-role-id"
SECRET_ID_FILE="${CRED_DIR}/backend-secret-id"

i=0
status_json=""
rc=1
while [ "$i" -lt 30 ]; do
  set +e
  status_json=$(vault status -format=json 2>/dev/null)
  rc=$?
  set -e
  if [ "$rc" -eq 0 ] || [ "$rc" -eq 2 ]; then
    break
  fi
  i=$((i + 1))
  sleep 1
done

if [ "$rc" -ne 0 ] && [ "$rc" -ne 2 ]; then
  echo "Vault did not become reachable in time" >&2
  exit 1
fi

extract_unseal_keys() {
  tr ',' '\n' < "$INIT_FILE" | awk '
    /"unseal_keys_b64"[[:space:]]*:/ { in_arr=1 }
    in_arr {
      line = $0
      sub(/.*"unseal_keys_b64"[[:space:]]*:[[:space:]]*\[?/, "", line)
      if (match(line, /"[^"]+"/)) {
        print substr(line, RSTART + 1, RLENGTH - 2)
      }
      if ($0 ~ /\]/) exit
    }
  ' | head -n 3
}

extract_root_token() {
  sed -n 's/.*"root_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$INIT_FILE" | head -n 1
}

supports_posix_perms() {
  ! grep -qE " ${CRED_DIR} (9p|drvfs|fuse\.grpcfuse) " /proc/mounts 2>/dev/null
}

fresh_init=0
mkdir -p "$CRED_DIR"
if supports_posix_perms; then
  chmod 755 "$CRED_DIR" 2>/dev/null || true
fi

if [ ! -s "$PG_PASS_FILE" ]; then
  echo "Generating PostgreSQL password..."
  head -c 24 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=\r\n' > "$PG_PASS_FILE"
  if supports_posix_perms; then
    chmod 600 "$PG_PASS_FILE" 2>/dev/null || true
  fi
fi

if printf '%s' "$status_json" | grep -q '"initialized"[[:space:]]*:[[:space:]]*false'; then
  echo "Initializing Vault..."
  vault operator init -key-shares=5 -key-threshold=3 -format=json > "$INIT_FILE"
  if supports_posix_perms; then
    chmod 600 "$INIT_FILE" 2>/dev/null || true
  fi
  fresh_init=1
  rc=2
fi

if [ "$rc" -eq 2 ]; then
  if [ ! -f "$INIT_FILE" ]; then
    echo "Vault is sealed and $INIT_FILE is missing" >&2
    exit 1
  fi
  echo "Unsealing Vault..."
  for key in $(extract_unseal_keys); do
    vault operator unseal "$key" >/dev/null
  done
fi

if [ "$fresh_init" -eq 1 ] || [ ! -s "$ROLE_ID_FILE" ] || [ ! -s "$SECRET_ID_FILE" ]; then
  VAULT_TOKEN=$(extract_root_token)
  export VAULT_TOKEN
  if ! vault secrets list -format=json | grep -q '"secret/"'; then
    vault secrets enable -path=secret kv-v2 >/dev/null
  fi
  vault policy write ft-transcendence-backend /vault/policies/backend.hcl >/dev/null
  if ! vault auth list -format=json | grep -q '"approle/"'; then
    vault auth enable approle >/dev/null
  fi
  vault write auth/approle/role/ft-transcendence-backend \
    token_policies=ft-transcendence-backend \
    token_no_default_policy=true \
    token_type=service \
    token_ttl=15m \
    token_max_ttl=1h \
    token_num_uses=0 \
    secret_id_ttl=720h \
    secret_id_num_uses=0 >/dev/null

  if ! vault kv get -mount=secret ft-transcendence/backend >/dev/null 2>&1; then
    pg_pass=$(tr -d '\r\n' < "$PG_PASS_FILE")
    secret_key=$(head -c 36 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=\r\n')
    vault kv put -mount=secret ft-transcendence/backend \
      "SECRET_KEY=${secret_key}" \
      "POSTGRES_DB=${POSTGRES_DB:-team_platform}" \
      "POSTGRES_USER=${POSTGRES_USER:-postgres}" \
      "POSTGRES_PASSWORD=${pg_pass}" >/dev/null
  fi

  vault read -field=role_id auth/approle/role/ft-transcendence-backend/role-id > "$ROLE_ID_FILE"
  vault write -f -field=secret_id auth/approle/role/ft-transcendence-backend/secret-id > "$SECRET_ID_FILE"
  unset VAULT_TOKEN
fi

if supports_posix_perms && [ -f "$ROLE_ID_FILE" ] && [ -f "$SECRET_ID_FILE" ]; then
  chown "${VAULT_AGENT_UID:-1000}:${VAULT_AGENT_GID:-1000}" "$ROLE_ID_FILE" "$SECRET_ID_FILE" 2>/dev/null || true
  chmod 600 "$ROLE_ID_FILE" "$SECRET_ID_FILE" 2>/dev/null || true
fi

echo "Vault is unsealed and ready."
