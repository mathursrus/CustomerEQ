#!/usr/bin/env bash
# shellcheck disable=SC2086
#
# scripts/migrate-secrets-to-keyvault.sh
#
# Migrates production secrets from plain Container App env / encrypted-at-rest
# Container App secret store into Azure Key Vault references, AND switches
# Azure Container Registry pulls from password-based auth to managed identity.
# Closes Issue #200.
#
# Idempotent — safe to re-run after fixing a partial failure.
#
# Usage:
#   ./scripts/migrate-secrets-to-keyvault.sh [flags]
#
# Flags:
#   --dry-run                Print every az command without executing it.
#   --skip-secrets           Skip the per-secret migration phase.
#   --skip-acr               Skip the ACR-pull-via-managed-identity phase.
#   --skip-verify            Skip the post-migration verification phase.
#   --resource-group <name>  Override the resource group (default: customereq-prod).
#   --vault <name>           Override the Key Vault name (default: customereq-kv).
#   --acr <name>             Override the ACR name (default: customereqcr).
#   --help, -h               Show this help text.
#
# Prerequisites:
#   1. Azure Key Vault `customereq-kv` exists in `customereq-prod` resource group,
#      RBAC mode enabled.
#   2. The 6 must-move secrets are populated in the vault: database-url,
#      redis-url, clerk-secret-key, clerk-webhook-secret, mcp-api-key,
#      openai-api-key.
#   3. The caller has these RBAC roles:
#      - Contributor (or equivalent) on the customereq-prod resource group
#      - User Access Administrator (or equivalent) on the resource group OR
#        on the vault + ACR (needed for assigning RBAC to managed identities)
#   4. `az` CLI installed and `az login` complete.

set -euo pipefail

# ────────────────────────────────────────────────────────────────────────────
# Defaults
# ────────────────────────────────────────────────────────────────────────────

RESOURCE_GROUP="customereq-prod"
VAULT_NAME="customereq-kv"
ACR_NAME="customereqcr"
ACR_PASSWORD_SECRET_NAME="customereqcrazurecrio-customereqcr"

DRY_RUN=false
SKIP_SECRETS=false
SKIP_ACR=false
SKIP_VERIFY=false

# Per-app secret migration plan. Each row: <app>|<vault-secret-name>|<env-var-name>
# The script skips rows whose env var isn't present on the named app, so this
# array is intentionally inclusive — defines the universe; runtime checks
# narrow to what's actually configured.
MIGRATIONS=(
  "customereq-api|database-url|DATABASE_URL"
  "customereq-api|redis-url|REDIS_URL"
  "customereq-api|clerk-secret-key|CLERK_SECRET_KEY"
  "customereq-api|clerk-webhook-secret|CLERK_WEBHOOK_SECRET"
  "customereq-api|mcp-api-key|MCP_API_KEY"
  "customereq-api|openai-api-key|OPENAI_API_KEY"
  "customereq-worker|database-url|DATABASE_URL"
  "customereq-worker|redis-url|REDIS_URL"
  "customereq-worker|openai-api-key|OPENAI_API_KEY"
)

# Apps that pull images from ACR (all three).
ACR_PULL_APPS=(
  "customereq-api"
  "customereq-worker"
  "customereq-web"
)

# Apps that need Key Vault Secrets User on the vault (the two backend apps).
KV_READ_APPS=(
  "customereq-api"
  "customereq-worker"
)

# ────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" >&2; }

die() {
  log "ERROR: $*"
  exit 1
}

run() {
  if $DRY_RUN; then
    printf '  [DRY-RUN] ' >&2
    printf '%q ' "$@" >&2
    printf '\n' >&2
  else
    printf '  $ ' >&2
    printf '%q ' "$@" >&2
    printf '\n' >&2
    "$@"
  fi
}

# Like run(), but ignore non-zero exit (used for idempotent operations like
# role assignment that fails when the role is already assigned).
run_ok() {
  if $DRY_RUN; then
    printf '  [DRY-RUN] ' >&2
    printf '%q ' "$@" >&2
    printf '\n' >&2
  else
    printf '  $ ' >&2
    printf '%q ' "$@" >&2
    printf '\n' >&2
    "$@" || log "  (command exited non-zero; treating as already-done)"
  fi
}

show_help() {
  sed -n '2,30p' "$0" | sed 's/^# \?//'
  exit 0
}

# ────────────────────────────────────────────────────────────────────────────
# Arg parsing
# ────────────────────────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)         DRY_RUN=true; shift ;;
    --skip-secrets)    SKIP_SECRETS=true; shift ;;
    --skip-acr)        SKIP_ACR=true; shift ;;
    --skip-verify)     SKIP_VERIFY=true; shift ;;
    --resource-group)  RESOURCE_GROUP="$2"; shift 2 ;;
    --vault)           VAULT_NAME="$2"; shift 2 ;;
    --acr)             ACR_NAME="$2"; shift 2 ;;
    --help|-h)         show_help ;;
    *)                 die "Unknown argument: $1 (use --help)" ;;
  esac
done

# ────────────────────────────────────────────────────────────────────────────
# Phase 1: Preflight
# ────────────────────────────────────────────────────────────────────────────

preflight() {
  log "═══ Phase 1: Preflight ═══"

  command -v az >/dev/null 2>&1 || die "'az' CLI not found in PATH"

  az account show >/dev/null 2>&1 \
    || die "not logged in to Azure (run 'az login' first)"

  log "Logged in as: $(az account show --query user.name -o tsv)"
  log "Subscription: $(az account show --query name -o tsv)"

  az group show --name "$RESOURCE_GROUP" >/dev/null 2>&1 \
    || die "resource group '$RESOURCE_GROUP' not found"

  az keyvault show --name "$VAULT_NAME" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1 \
    || die "Key Vault '$VAULT_NAME' not found in resource group '$RESOURCE_GROUP'"

  log "Vault $VAULT_NAME exists"

  # Confirm the 6 must-move secrets are populated
  local required=(database-url redis-url clerk-secret-key clerk-webhook-secret mcp-api-key openai-api-key)
  local missing=()
  for s in "${required[@]}"; do
    if ! az keyvault secret show --vault-name "$VAULT_NAME" --name "$s" >/dev/null 2>&1; then
      missing+=("$s")
    fi
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    die "missing secrets in vault: ${missing[*]}. Populate them before running this script."
  fi
  log "All 6 required secrets present in $VAULT_NAME"

  # Confirm the Container Apps exist
  for app in customereq-api customereq-worker customereq-web; do
    az containerapp show --name "$app" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1 \
      || die "Container App '$app' not found"
  done
  log "All three Container Apps exist (api, worker, web)"
}

# ────────────────────────────────────────────────────────────────────────────
# Helper: ensure system-assigned identity is enabled on a Container App.
# Returns the principalId on stdout.
# ────────────────────────────────────────────────────────────────────────────

ensure_identity() {
  local app="$1"
  local principal
  principal=$(az containerapp show --name "$app" --resource-group "$RESOURCE_GROUP" \
    --query "identity.principalId" -o tsv 2>/dev/null || true)

  if [[ -z "$principal" || "$principal" == "None" || "$principal" == "null" ]]; then
    log "  $app: enabling system-assigned identity"
    if $DRY_RUN; then
      printf '    [DRY-RUN] az containerapp identity assign --name %s --resource-group %s --system-assigned\n' \
        "$app" "$RESOURCE_GROUP" >&2
      principal="<dry-run-placeholder-principal>"
    else
      principal=$(az containerapp identity assign \
        --name "$app" \
        --resource-group "$RESOURCE_GROUP" \
        --system-assigned \
        --query "principalId" -o tsv)
    fi
  fi
  echo "$principal"
}

# ────────────────────────────────────────────────────────────────────────────
# Phase 2: Grant Key Vault Secrets User to backend Container App identities
# ────────────────────────────────────────────────────────────────────────────

grant_kv_access() {
  log "═══ Phase 2: Grant 'Key Vault Secrets User' to backend Container Apps ═══"

  local vault_id
  vault_id=$(az keyvault show --name "$VAULT_NAME" --resource-group "$RESOURCE_GROUP" \
    --query id -o tsv)

  for app in "${KV_READ_APPS[@]}"; do
    log "$app:"
    local principal
    principal=$(ensure_identity "$app")
    log "  identity principal: $principal"
    # Use --assignee-object-id + --assignee-principal-type to bypass the
    # Graph API lookup that --assignee triggers. The lookup fails for many
    # callers without Microsoft Graph permissions and produces a confusing
    # downstream "MissingSubscription" error. The values are already known
    # at this point: a system-assigned managed identity is a ServicePrincipal
    # in Azure RBAC parlance.
    run_ok az role assignment create \
      --assignee-object-id "$principal" \
      --assignee-principal-type ServicePrincipal \
      --role "Key Vault Secrets User" \
      --scope "$vault_id"
  done
}

# ────────────────────────────────────────────────────────────────────────────
# Phase 3: Migrate per-secret bindings — set as keyvaultref + secretRef.
# ────────────────────────────────────────────────────────────────────────────

migrate_secrets() {
  if $SKIP_SECRETS; then
    log "═══ Phase 3: SKIPPED secret migration (--skip-secrets) ═══"
    return
  fi

  log "═══ Phase 3: Migrate per-app secrets to Key Vault references ═══"

  local vault_uri
  vault_uri=$(az keyvault show --name "$VAULT_NAME" --resource-group "$RESOURCE_GROUP" \
    --query properties.vaultUri -o tsv)
  vault_uri="${vault_uri%/}" # strip trailing slash

  for migration in "${MIGRATIONS[@]}"; do
    IFS='|' read -r app secret_name env_var <<< "$migration"

    log "$app: $env_var → $VAULT_NAME/$secret_name"

    # Skip if env var isn't on this app (defensive — different apps have
    # different env layouts).
    local env_present
    env_present=$(az containerapp show --name "$app" --resource-group "$RESOURCE_GROUP" \
      --query "properties.template.containers[0].env[?name=='$env_var'].name | [0]" \
      -o tsv 2>/dev/null || echo "")
    if [[ -z "$env_present" || "$env_present" == "None" ]]; then
      log "  env var $env_var not present on $app; skipping"
      continue
    fi

    # Set the Container App secret as a Key Vault reference. This overwrites
    # any existing secret entry of the same name (idempotent).
    run az containerapp secret set \
      --name "$app" \
      --resource-group "$RESOURCE_GROUP" \
      --secrets "${secret_name}=keyvaultref:${vault_uri}/secrets/${secret_name},identityref:system" \
      --output none

    # Repoint the env var to the secret. Idempotent — the second run
    # overwrites with the same value.
    run az containerapp update \
      --name "$app" \
      --resource-group "$RESOURCE_GROUP" \
      --set-env-vars "${env_var}=secretref:${secret_name}" \
      --output none

    log "  done"
  done
}

# ────────────────────────────────────────────────────────────────────────────
# Phase 4: Switch ACR pulls to managed identity
# ────────────────────────────────────────────────────────────────────────────

migrate_acr_pull() {
  if $SKIP_ACR; then
    log "═══ Phase 4: SKIPPED ACR-pull migration (--skip-acr) ═══"
    return
  fi

  log "═══ Phase 4: Switch ACR pulls to managed identity ═══"

  local acr_id
  acr_id=$(az acr show --name "$ACR_NAME" --query id -o tsv 2>/dev/null) \
    || die "ACR '$ACR_NAME' not found (or no permission to read)"

  local acr_server
  acr_server=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)

  for app in "${ACR_PULL_APPS[@]}"; do
    log "$app:"

    local principal
    principal=$(ensure_identity "$app")

    log "  granting AcrPull on $ACR_NAME to principal $principal"
    # Same Graph-API bypass as the Key Vault role assignment in Phase 2.
    run_ok az role assignment create \
      --assignee-object-id "$principal" \
      --assignee-principal-type ServicePrincipal \
      --role AcrPull \
      --scope "$acr_id"

    log "  switching pulls to managed identity"
    run az containerapp registry set \
      --name "$app" \
      --resource-group "$RESOURCE_GROUP" \
      --server "$acr_server" \
      --identity system \
      --output none

    # Remove the orphaned ACR password secret entry. Tolerant of "already
    # gone" since this is rerunnable.
    log "  removing orphaned secret '$ACR_PASSWORD_SECRET_NAME' if present"
    run_ok az containerapp secret remove \
      --name "$app" \
      --resource-group "$RESOURCE_GROUP" \
      --secret-names "$ACR_PASSWORD_SECRET_NAME" \
      --output none
  done

  log "Note: ACR admin user is intentionally left enabled by this script."
  log "      Disable it manually after verifying managed-identity pulls work:"
  log "        az acr update --name $ACR_NAME --admin-enabled false"
}

# ────────────────────────────────────────────────────────────────────────────
# Phase 5: Verify
# ────────────────────────────────────────────────────────────────────────────

verify() {
  if $SKIP_VERIFY; then
    log "═══ Phase 5: SKIPPED verification (--skip-verify) ═══"
    return
  fi

  log "═══ Phase 5: Post-migration verification ═══"

  for app in customereq-api customereq-worker customereq-web; do
    log "─── $app ──────────────────────────────────────"
    log "  env (showing only secretRef-bound entries):"
    az containerapp show --name "$app" --resource-group "$RESOURCE_GROUP" \
      --query "properties.template.containers[0].env[?secretRef!=null].{name:name, secretRef:secretRef}" \
      -o table 2>/dev/null || log "    (no secretRef-bound env vars)"
    log "  secrets (showing keyVaultUrl when present):"
    az containerapp show --name "$app" --resource-group "$RESOURCE_GROUP" \
      --query "properties.configuration.secrets[].{name:name, keyVaultUrl:keyVaultUrl, identity:identity}" \
      -o table 2>/dev/null || log "    (no secrets)"
    log "  registry:"
    az containerapp show --name "$app" --resource-group "$RESOURCE_GROUP" \
      --query "properties.configuration.registries[].{server:server, identity:identity, passwordSecretRef:passwordSecretRef}" \
      -o table 2>/dev/null || log "    (no registries)"
  done

  # Health check on api
  if $DRY_RUN; then
    log "[DRY-RUN] would curl /healthz on customereq-api"
  else
    local api_fqdn
    api_fqdn=$(az containerapp show --name customereq-api --resource-group "$RESOURCE_GROUP" \
      --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null || echo "")
    if [[ -n "$api_fqdn" ]]; then
      log "Health check: https://$api_fqdn/healthz (allowing 30s for new revision to roll out)"
      local status="000"
      for i in 1 2 3 4 5 6; do
        status=$(curl -s -o /dev/null -w "%{http_code}" "https://$api_fqdn/healthz" || echo "000")
        if [[ "$status" == "200" ]]; then
          log "  attempt $i: 200 OK"
          break
        fi
        log "  attempt $i: $status (waiting 5s)"
        sleep 5
      done
      if [[ "$status" != "200" ]]; then
        log "  WARN: /healthz did not return 200 within 30s. Check the revision logs:"
        log "        az containerapp logs show --name customereq-api --resource-group $RESOURCE_GROUP --follow"
      fi
    fi
  fi
}

# ────────────────────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────────────────────

log "Starting (DRY_RUN=$DRY_RUN, RG=$RESOURCE_GROUP, VAULT=$VAULT_NAME, ACR=$ACR_NAME)"
preflight
grant_kv_access
migrate_secrets
migrate_acr_pull
verify
log "Done."
