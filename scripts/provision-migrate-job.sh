#!/usr/bin/env bash
# scripts/provision-migrate-job.sh
#
# One-time provisioning of the customereq-migrate Azure Container Apps Job.
# Closes issue #386: dedicated migration stage in the deploy pipeline.
#
# Run this once from a machine with az CLI access to customereq-prod.
# The deploy pipeline (deploy.yml) assumes this job exists.
#
# Secrets pattern follows CLAUDE.md §Production Secrets Policy:
#   - DATABASE_URL sourced from Key Vault customereq-kv via managed identity ref.
#   - ACR pull via system-assigned managed identity (no username/password).
#
# Usage:
#   ./scripts/provision-migrate-job.sh [--dry-run]
set -euo pipefail

RESOURCE_GROUP="customereq-prod"
VAULT="customereq-kv"
ACR="customereqcr"
ENVIRONMENT="customereq-env"
JOB_NAME="customereq-migrate"
IMAGE="${ACR}.azurecr.io/customereq-api:latest"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "[dry-run] Commands will be printed but not executed."
fi

run() {
  if $DRY_RUN; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
VAULT_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.KeyVault/vaults/${VAULT}"
ACR_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.ContainerRegistry/registries/${ACR}"

echo "=== Provisioning ${JOB_NAME} ACA Job ==="

# Create the ACA Job with:
#   - Manual trigger (started by the deploy pipeline, not on a schedule)
#   - System-assigned managed identity for KV + ACR access
#   - DATABASE_URL from Key Vault (no plain-value secrets)
#   - 5-minute replica timeout, no retries (fail fast)
run az containerapp job create \
  --name "$JOB_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$ENVIRONMENT" \
  --trigger-type Manual \
  --replica-timeout 300 \
  --replica-retry-limit 0 \
  --replica-completion-count 1 \
  --parallelism 1 \
  --image "$IMAGE" \
  --mi-system-assigned \
  --registry-server "${ACR}.azurecr.io" \
  --registry-identity system \
  --secrets "database-url=keyvaultref:https://${VAULT}.vault.azure.net/secrets/database-url,identityref:system" \
  --env-vars "DATABASE_URL=secretref:database-url" \
  --command "/app/apps/api/docker-entrypoint-migrate.sh"

# Retrieve the system-assigned principal ID for role assignments
PRINCIPAL_ID=$(az containerapp job show \
  --name "$JOB_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "identity.principalId" -o tsv)

echo "Managed identity principal: ${PRINCIPAL_ID}"

# Grant Key Vault Secrets User so the job can read database-url
run az role assignment create \
  --assignee "$PRINCIPAL_ID" \
  --role "Key Vault Secrets User" \
  --scope "$VAULT_SCOPE"

# Grant AcrPull so the job can pull the API image
run az role assignment create \
  --assignee "$PRINCIPAL_ID" \
  --role "AcrPull" \
  --scope "$ACR_SCOPE"

echo "=== ${JOB_NAME} provisioned successfully ==="
echo "Run './scripts/migrate-secrets-to-keyvault.sh --dry-run' to confirm no plain-value drift."
