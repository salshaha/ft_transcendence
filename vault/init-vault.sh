#!/usr/bin/env bash
# Initialize and configure Vault for ft_transcendence local development.
# Run this once after `docker compose up -d vault`.
# Requires: vault CLI on the host (or run inside the vault container).

set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
export VAULT_ADDR

echo "Waiting for Vault to be reachable..."
until vault status >/dev/null 2>&1 || [ $? -eq 2 ]; do
  sleep 2
done

# Initialize Vault if it is not already initialized.
if ! vault status 2>/dev/null | grep -q "Initialized.*true"; then
  echo "Initializing Vault..."
  vault operator init -key-shares=1 -key-threshold=1 -format=json > /tmp/vault-init.json
  UNSEAL_KEY=$(python3 -c "import json;print(json.load(open('/tmp/vault-init.json'))['unseal_keys_b64'][0])")
  ROOT_TOKEN=$(python3 -c "import json;print(json.load(open('/tmp/vault-init.json'))['root_token'])")
  echo "Unsealing..."
  vault operator unseal "$UNSEAL_KEY" >/dev/null
  export VAULT_TOKEN="$ROOT_TOKEN"
  echo "Root token: $ROOT_TOKEN (save this somewhere safe)"
else
  echo "Vault already initialized. Ensure it is unsealed and VAULT_TOKEN is set."
  : "${VAULT_TOKEN:?Set VAULT_TOKEN to a root token}"
fi

echo "Enabling KV v2 secrets engine at 'secret/' (if needed)..."
vault secrets enable -path=secret kv-v2 2>/dev/null || true

echo "Writing backend secrets..."
vault kv put secret/ft-transcendence/backend \
  SECRET_KEY="${SECRET_KEY:-$(openssl rand -base64 48)}" \
  POSTGRES_DB="${POSTGRES_DB:-team_platform}" \
  POSTGRES_USER="${POSTGRES_USER:-postgres}" \
  POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-change_this_to_a_strong_password}"

echo "Enabling AppRole auth (if needed)..."
vault auth enable approle 2>/dev/null || true

echo "Writing backend policy..."
vault policy write backend-policy ./vault/policies/backend.hcl

echo "Creating approle role 'backend'..."
vault write auth/approle/role/backend \
  token_policies="backend-policy" \
  secret_id_ttl="0" \
  token_ttl="1h" \
  token_max_ttl="4h"

ROLE_ID=$(vault read -field=role_id auth/approle/role/backend/role-id)
SECRET_ID=$(vault write -f -field=secret_id auth/approle/role/backend/secret-id)

echo "Role ID:  $ROLE_ID"
echo "Secret ID: $SECRET_ID"

mkdir -p vault/credentials
printf '%s' "$ROLE_ID"   > vault/credentials/backend-role-id
printf '%s' "$SECRET_ID" > vault/credentials/backend-secret-id

echo ""
echo "Done. Restart vault-agent: docker compose restart vault-agent"