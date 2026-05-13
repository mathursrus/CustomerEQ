#!/usr/bin/env python3
"""
Dry-run validator for the dorny/paths-filter@v3 patterns used in
.github/workflows/ci.yml's docker-build job.

dorny uses picomatch with last-match-wins semantics. A leading positive
pattern (e.g., '**') is REQUIRED — without it, no path is ever included
and the filter is always false. With it, negation patterns subtract from
the universal match set, giving the skip-list behavior we want.

This script:
  1. Loads the patterns from ci.yml.
  2. Verifies the first pattern is '**' (defends against future regressions
     of the all-negative bug fixed in #351).
  3. Runs the matcher against representative changesets and confirms the
     filter resolves to the expected value.

Exit 0 on all-pass, non-zero on any mismatch.

Why Python: `pathspec` implements gitignore-style globs (including `**`
across directories) which is the same semantics dorny/picomatch uses for
this purpose. Bundled here because `js-yaml` isn't a direct project dep
and the repo has `pyyaml` already installed locally for prior workflow
validation needs (#343 PR #346 retro §C).
"""

from __future__ import annotations
import sys
import yaml
import pathspec


def load_patterns() -> list[str]:
    with open(".github/workflows/ci.yml", "r", encoding="utf-8") as f:
        doc = yaml.safe_load(f)
    filter_step = next(
        s for s in doc["jobs"]["docker-build"]["steps"] if s.get("id") == "changes"
    )
    filters_yaml = filter_step["with"]["filters"]
    filters = yaml.safe_load(filters_yaml)
    return list(filters["build"])


def path_included(path: str, patterns: list[str]) -> bool:
    """Last-match-wins. Walk patterns in order; flip include state on each match."""
    included = False
    for raw in patterns:
        negate = raw.startswith("!")
        glob = raw[1:] if negate else raw
        spec = pathspec.PathSpec.from_lines("gitwildmatch", [glob])
        if spec.match_file(path):
            included = not negate
    return included


def filter_outputs_build(changeset: list[str], patterns: list[str]) -> bool:
    """dorny outputs build=true iff at least one changed path is included."""
    return any(path_included(p, patterns) for p in changeset)


def main() -> int:
    patterns = load_patterns()
    print("Patterns (in order, from ci.yml docker-build):")
    for i, p in enumerate(patterns):
        print(f"  {i}: {p}")
    print()

    if not patterns or patterns[0] != "**":
        print("FAIL: first pattern must be '**' (positive baseline). See #351.")
        return 1

    cases = [
        (
            "doc-only — all .md under docs/",
            [
                "docs/retrospectives/manohar.madhira@outlook.com-issue-343-foo-postmortem.md",
                "docs/evidence/343-implement-work-list.md",
            ],
            False,
        ),
        ("doc-only — .md at repo root", ["README.md"], False),
        (
            "doc-only — CODEOWNERS + .gitattributes + LICENSE",
            ["CODEOWNERS", ".gitattributes", "LICENSE"],
            False,
        ),
        (
            "doc-only — issue/PR templates",
            [".github/ISSUE_TEMPLATE/bug.md", ".github/pull_request_template.md"],
            False,
        ),
        (
            "mixed — apps + docs",
            ["apps/api/src/server.ts", "docs/architecture/architecture.md"],
            True,
        ),
        (
            "code-only — apps + Dockerfile + package.json",
            ["apps/web/src/page.tsx", "Dockerfile.api", "package.json"],
            True,
        ),
        (
            "workflow edit (this PR pattern) — .github/workflows/ci.yml",
            [".github/workflows/ci.yml"],
            True,
        ),
        (
            "asset-in-code — apps/web/public/logo.png (must trigger build)",
            ["apps/web/public/logo.png"],
            True,
        ),
        (
            "asset-in-doc — docs/screenshot.png (must skip)",
            ["docs/screenshot.png"],
            False,
        ),
        (
            "prisma migration",
            [
                "packages/database/prisma/migrations/20260601000000_add_thing/migration.sql"
            ],
            True,
        ),
    ]

    fails = 0
    for name, changeset, expected in cases:
        got = filter_outputs_build(changeset, patterns)
        status = "PASS" if got == expected else "FAIL"
        if got != expected:
            fails += 1
        print(f"{status}  expected={expected} got={got}  {name}")
        if got != expected:
            for p in changeset:
                print(f"        {p} → included={path_included(p, patterns)}")

    print()
    if fails:
        print(f"{fails} case(s) failed")
        return 1
    print("all cases pass")
    return 0


if __name__ == "__main__":
    sys.exit(main())
