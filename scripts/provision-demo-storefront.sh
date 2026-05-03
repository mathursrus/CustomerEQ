#!/usr/bin/env bash
# shellcheck disable=SC2086
#
# scripts/provision-demo-storefront.sh
#
# One-time setup: creates the `customereq-demo` Container App and seeds the
# StarBrew demo data into the staging database.
#
# Run this once when setting up the demo environment for the first time.
# The deploy.yml workflow handles all subsequent image updates automatically.
#
# Usage:
#   ./scripts/provision-demo-storefront.sh [--dry-run]
#
# Prerequisites:
#   - `az` CLI logged in with sufficient permissions on customereq-prod
#   - `pnpm` available locally (for the seed step)
#   - DATABASE_URL pointing at the staging DB (exported or in .env)
#
set -euo pipefail

RESOURCE_GROUP="customereq-prod"
ENVIRONMENT="customereq-env"
REGISTRY="customereqcr.azurecr.io"
APP_NAME="customereq-demo"
IMAGE="$REGISTRY/customereq-demo:latest"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "[dry-run] Commands will be printed but not executed."
fi

run() {
  if $DRY_RUN; then
    echo "[dry-run]" "$@"
  else
    "$@"
  fi
}

# ── 1. Resolve API FQDN ───────────────────────────────────────────────
echo "→ Resolving staging API FQDN..."
API_FQDN=$(az containerapp show \
  --name customereq-api \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" \
  -o tsv)
echo "  API: https://$API_FQDN"

# ── 2. Create Container App ───────────────────────────────────────────
echo "→ Creating Container App '$APP_NAME'..."
run az containerapp create \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$ENVIRONMENT" \
  --image "$IMAGE" \
  --registry-server "$REGISTRY" \
  --registry-identity system \
  --target-port 3002 \
  --ingress external \
  --transport http \
  --min-replicas 1 \
  --max-replicas 1 \
  --env-vars \
    "DEMO_API_URL=https://$API_FQDN" \
    "DEMO_BRAND_ID=" \
  --cpu 0.25 \
  --memory 0.5Gi

# ── 3. Assign AcrPull to the app's managed identity ──────────────────
echo "→ Assigning AcrPull to managed identity..."
APP_PRINCIPAL=$(az containerapp show \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "identity.principalId" -o tsv)
ACR_ID=$(az acr show --name customereqcr --query id -o tsv)

run az role assignment create \
  --assignee-object-id "$APP_PRINCIPAL" \
  --assignee-principal-type ServicePrincipal \
  --role AcrPull \
  --scope "$ACR_ID"

# ── 4. Print demo URL ─────────────────────────────────────────────────
DEMO_FQDN=$(az containerapp show \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" \
  -o tsv 2>/dev/null || echo "<pending>")
echo ""
echo "✓ Container App created: https://$DEMO_FQDN"

# ── 5. Seed StarBrew demo data ────────────────────────────────────────
echo ""
echo "→ Seeding StarBrew demo data into staging DB..."
echo "  (Requires DATABASE_URL pointing at staging. Set it if not already exported.)"
echo ""

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "  ⚠  DATABASE_URL is not set. Skipping seed."
  echo "     Run manually once DATABASE_URL is available:"
  echo "       DATABASE_URL=<staging-url> pnpm seed:demo"
  echo ""
else
  run pnpm seed:demo
  echo ""
  echo "  ✓ Seed complete."
  echo ""
  echo "  Copy the 'brandId' printed above into the Container App env var:"
  echo "    az containerapp update --name $APP_NAME --resource-group $RESOURCE_GROUP \\"
  echo "      --set-env-vars DEMO_BRAND_ID=<brand-id-from-seed-output>"
fi

echo ""
echo "Done. Deploy pipeline (deploy.yml) will keep the image up to date on every push to main."
