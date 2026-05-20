#!/usr/bin/env bash
# scripts/check-no-attribution-toggle.sh
#
# R7 gate for Issue #413: the "Powered by CustomerEQ" footer must be
# non-toggleable. No code path in this repository may introduce a flag,
# environment variable, settings field, or runtime override that hides
# the attribution footer or disables the link.
#
# This script greps the repository for toggle-shaped identifiers that
# would violate R7 and exits non-zero if any match is found outside
# documentation, this script itself, and the FRAIM learning corpus
# (which catalogs past discussions but doesn't define behavior).
#
# Usage:
#   bash scripts/check-no-attribution-toggle.sh
#
# Wired into the smoke test chain via the root package.json
# "check:no-attribution-toggle" script.

set -euo pipefail

# Identifiers that would shape an attribution-toggle. Pattern is loose
# on purpose (case-insensitive, partial-word) so a renamed-but-equivalent
# flag is still caught.
PATTERNS=(
  "hideFooter"
  "hide_footer"
  "hideAttribution"
  "hide_attribution"
  "showPoweredBy"
  "show_powered_by"
  "disableFooter"
  "disable_footer"
  "attributionEnabled"
  "attribution_enabled"
  "hideCustomerEQAttribution"
  "hide_customereq_attribution"
  "poweredByEnabled"
  "powered_by_enabled"
)

# Paths excluded from the gate:
#   - This script itself (it names the patterns we're forbidding).
#   - docs/ — specs/RFCs/mocks/evidence may reference the patterns to
#     explain what's forbidden. The forward-paid-tier "Brand-level
#     attribution toggle" deferred follow-up in
#     docs/feature-specs/413-survey-footer.md mentions
#     `hideCustomerEQAttribution` by name; that's a discussion of a
#     FUTURE capability gated on infra that doesn't exist, not a current
#     toggle.
#   - fraim/personalized-employee/learnings/ — past learnings catalog
#     references to toggle patterns from prior reviews.
#   - **/*.test.* and **/*.spec.* — test files reference the patterns
#     as negative assertions (e.g., `expect(...).not.toMatch(/hideFooter|...)`)
#     to enforce that production code never grows them. Treating the test
#     as a violation would forbid its own enforcement.
#   - node_modules/ — third-party code is out of scope.
#   - .git/ — version control internals.

EXCLUDES=(
  "--exclude-dir=node_modules"
  "--exclude-dir=.git"
  "--exclude-dir=.next"
  "--exclude-dir=dist"
  "--exclude-dir=build"
  "--exclude-dir=coverage"
  "--exclude=check-no-attribution-toggle.sh"
  "--exclude=*.test.ts"
  "--exclude=*.test.tsx"
  "--exclude=*.test.js"
  "--exclude=*.test.jsx"
  "--exclude=*.spec.ts"
  "--exclude=*.spec.tsx"
)

FOUND=0
MATCHES=""

for pat in "${PATTERNS[@]}"; do
  # -r recursive, -n line-numbers, -I skip binary, -i case-insensitive,
  # then exclude doc/learning paths via -- pipe to grep -v
  if hits=$(grep -rni "${EXCLUDES[@]}" -I "$pat" . 2>/dev/null \
              | grep -v "^\./docs/" \
              | grep -v "^\./fraim/personalized-employee/learnings/" \
              | grep -v "^\./fraim/personalized-employee/coaching-moments/" \
              || true); then
    if [ -n "$hits" ]; then
      MATCHES="${MATCHES}${MATCHES:+\n}--- Pattern: ${pat} ---\n${hits}"
      FOUND=1
    fi
  fi
done

if [ "$FOUND" -eq 1 ]; then
  echo "ERROR: R7 gate violated — attribution-toggle identifier(s) found in the repository."
  echo ""
  echo "Issue #413 requires the 'Powered by CustomerEQ' footer to be non-toggleable."
  echo "The following matches were found OUTSIDE the allowed paths (docs/, learnings/, this script):"
  echo ""
  printf "%b\n" "$MATCHES"
  echo ""
  echo "If a paid-tier toggle is being added intentionally, that's the 'Brand-level"
  echo "attribution toggle (paid tier)' deferred follow-up — it requires its own"
  echo "design + RFC + issue. Do not introduce it on #413's branch."
  exit 1
fi

echo "OK: R7 gate clean. No attribution-toggle identifiers found outside docs/learnings/."
exit 0
