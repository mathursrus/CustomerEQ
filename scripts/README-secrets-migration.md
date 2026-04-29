# Secrets migration to Azure Key Vault — runbook (Issue #200)

Single idempotent bash script (`scripts/migrate-secrets-to-keyvault.sh`) that brings the production Container Apps in line with `docs/architecture/architecture.md:489` ("Secrets — Azure Key Vault — All secrets injected at runtime — never in code or .env files").

## What it does

Five phases, all idempotent:

1. **Preflight** — confirms the caller is logged in, the resource group + vault exist, and all 6 expected secrets are populated in the vault.
2. **Grant managed identity Key Vault Secrets User** — for `customereq-api` and `customereq-worker`. Enables system-assigned identity on the Container App if not already on. Role assignments are no-ops if already present.
3. **Migrate secrets** — for each `(app, env-var)` pair in the script's `MIGRATIONS` array:
   - Sets a Container App `secrets` entry as a `keyvaultref:` to the vault entry, using the system-assigned managed identity for resolution.
   - Updates the env var to use `secretRef:` (replaces plain `value`).
   - Skips per-app rows where the env var isn't actually present (defensive).
4. **Migrate ACR pull to managed identity** — for `customereq-api`, `customereq-worker`, and `customereq-web`:
   - Grants `AcrPull` RBAC on `customereqcr` to the Container App's managed identity.
   - Sets the registry config to `--identity system` (no more password).
   - Removes the orphaned auto-generated `customereqcrazurecrio-customereqcr` secret.
5. **Verify** — prints the post-migration `env` (secretRef-bound entries only), `secrets` (with `keyVaultUrl`), and `registries` blocks for each app; hits `/healthz` on the API and reports the status.

## Prerequisites

1. **Azure Key Vault** `customereq-kv` exists in resource group `customereq-prod`, RBAC mode enabled.
2. **All 6 secrets are populated** in the vault: `database-url`, `redis-url`, `clerk-secret-key`, `clerk-webhook-secret`, `mcp-api-key`, `openai-api-key`. The script's preflight phase verifies this and exits if any are missing.
3. **The caller has these RBAC roles**:
   - `Contributor` (or equivalent) on `customereq-prod` resource group — for `az containerapp` operations
   - `User Access Administrator` (or equivalent) on the resource group OR on the vault + ACR — for assigning RBAC roles to the Container Apps' managed identities (`Key Vault Secrets User`, `AcrPull`)
4. **`az` CLI** installed and `az login` complete on the calling host.

## Recommended run sequence

### 1. Dry run

```sh
./scripts/migrate-secrets-to-keyvault.sh --dry-run
```

Prints every `az` command that would run, without executing. Inspect the output for:
- The right resource group, vault name, ACR name
- The expected migration rows (and any unexpected skips)
- The expected role assignments

### 2. Real run

```sh
./scripts/migrate-secrets-to-keyvault.sh
```

The script narrates each phase. Each Container App update creates a new revision; with default single-revision mode, traffic only shifts to the new revision after it passes Container Apps' built-in startup probe. If a revision fails to start, the previous revision keeps serving production traffic.

Expected duration: 2–5 minutes total (each Container App update + revision rollout takes ~30s).

### 3. Verify (re-runnable, read-only)

The verify phase runs automatically at the end of the script. To re-run just the verification:

```sh
./scripts/migrate-secrets-to-keyvault.sh --skip-secrets --skip-acr
```

(`--skip-secrets` and `--skip-acr` together leave only Phase 1 preflight + Phase 5 verify active. Phase 2 also runs but is fully idempotent.)

## Flags

| Flag | Effect |
| :--- | :--- |
| `--dry-run` | Print commands without executing. Safe to run anytime. |
| `--skip-secrets` | Skip Phase 3 (per-secret migration). Useful for re-running just the ACR + verify steps. |
| `--skip-acr` | Skip Phase 4 (ACR pull migration). Useful if ACR migration was done separately. |
| `--skip-verify` | Skip Phase 5 (verification). Useful in CI when you'll verify separately. |
| `--resource-group <name>` | Override `customereq-prod`. |
| `--vault <name>` | Override `customereq-kv`. |
| `--acr <name>` | Override `customereqcr`. |
| `--help` | Print usage and exit. |

## Idempotency

Re-running the script after a successful run is safe and produces no functional change:

- `az containerapp secret set` overwrites the named secret entry.
- `az containerapp update --set-env-vars` overwrites only the named env var.
- `az role assignment create` returns non-zero when the role is already assigned; the script tolerates this via the `run_ok` helper.
- `az containerapp registry set` overwrites the registry config.
- `az containerapp secret remove` is tolerant of the secret already being absent.

If the script fails partway, fix the underlying cause and re-run. Already-completed steps will be no-ops.

## Rollback

Container Apps run in single-revision mode by default — the previous (working) revision keeps serving traffic until the new revision's startup probe passes. So a failed migration never takes prod down by itself. To revert a specific app to its prior config:

```sh
# List recent revisions, newest first
az containerapp revision list --name customereq-api --resource-group customereq-prod \
  --query "[].{name:name, active:properties.active, createdAt:properties.createdTime}" \
  -o table

# Re-activate the prior revision (replace REVISION_NAME)
az containerapp revision activate --name customereq-api --resource-group customereq-prod \
  --revision REVISION_NAME
```

## Optional follow-up: disable ACR admin user

After verifying managed-identity ACR pulls work end-to-end (deploy a new revision; confirm it pulls the image successfully), the ACR admin user can be disabled — it's no longer needed:

```sh
az acr update --name customereqcr --admin-enabled false
```

This is **not** automated by the script because it's a one-way change that affects everyone who has the ACR admin password (CI/CD, ad-hoc maintenance scripts, etc.). Confirm nothing depends on it before disabling. To verify ACR pulls work after disabling, force a new revision:

```sh
az containerapp update --name customereq-api --resource-group customereq-prod
```

If the new revision pulls the image and starts cleanly, managed-identity pulls are working.

## Acceptance criteria for the issue (#200)

After a successful run:

- [ ] All 6 must-move secrets in `customereq-api`'s `secrets` block show `keyVaultUrl` and `identity: system`.
- [ ] `customereq-worker`'s `secrets` block shows the same for the secrets it actually uses (`database-url`, `redis-url`, `openai-api-key`).
- [ ] Both apps' `env` blocks show `secretRef: <name>` (no plain `value`) for every must-move secret.
- [ ] All three apps' `registries` block shows `identity: system` and no `passwordSecretRef`.
- [ ] The auto-generated `customereqcrazurecrio-customereqcr` secret is removed from all three apps.
- [ ] `/healthz` on `customereq-api` returns 200 with `database: ok` and `redis: ok` after the migration.

## What this script intentionally does NOT do

- **Populate the Key Vault.** That's a manual step (or a separate, earlier script). The script's preflight phase requires the secrets to already exist in the vault.
- **Disable the ACR admin user.** See "Optional follow-up" above.
- **Migrate the web app's runtime secrets.** The web app's env block isn't part of this migration plan; if it has runtime secrets that need migration, add rows to the `MIGRATIONS` array and re-run.
- **Configure Clerk webhook endpoint.** That's a Clerk dashboard action, separate from this infrastructure migration.
- **Back up the previous secret values.** Migration is from `value` → `keyvaultref`; if you need a recovery path beyond Container Apps revision rollback, capture values to the vault before running this script.

## References

- Issue: https://github.com/mathursrus/CustomerEQ/issues/200
- Architecture: `docs/architecture/architecture.md:489` (§8 Infrastructure)
- Container Apps Key Vault references: https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets#reference-secret-from-key-vault
- Container Apps managed-identity ACR pulls: https://learn.microsoft.com/en-us/azure/container-apps/managed-identity-image-pull
