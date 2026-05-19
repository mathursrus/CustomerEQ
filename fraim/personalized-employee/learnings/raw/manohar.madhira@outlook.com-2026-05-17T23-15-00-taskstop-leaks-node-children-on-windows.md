---
author: manohar.madhira@outlook.com
date: 2026-05-17
context: issue-378
---

# Coaching Moment: taskstop-leaks-node-children-on-windows

## What happened

After issuing `TaskStop` on a backgrounded `pnpm dev` task during #378 Phase 12 walkthrough, child node processes (turbo → tsx → next-dev → worker → demo-storefront) **continued to hold the dev ports** 3000, 3002, and 4000. The next `pnpm dev` invocation logged *"Port 3000 is in use by process 26468, using available port 3003 instead"* and *"EADDRINUSE 0.0.0.0:4000"* for the API. The user's browser was still pointed at `:3000` (the orphaned dead instance from the very first failed startup) and reported *"Localhost:3000 is up, but is not fetching any records"* — because the orphaned web instance was wired to the dead first API process that had crashed on Prisma init at the same startup. The diagnosis took ~15 minutes because I assumed `TaskStop` cleanly terminated the whole tree; it doesn't on Windows. The fix was a port-listening sweep with PowerShell: `Get-NetTCPConnection -LocalPort 3000,3002,3003,4000 -State Listen | foreach { Stop-Process -Id $_.OwningProcess -Force }`. After that the next `pnpm dev` came up cleanly on the canonical ports. The user said *"It is wasting a lot of my time"* — the cost of this gap was real.

## What was learned

**`TaskStop` on a pnpm/turbo/npm-script background process kills only the parent shell on Windows; child processes (node, tsx, next-dev) orphan and keep holding listening ports.** Any restart cycle on a `pnpm dev` background task must follow `TaskStop` with a port-listening sweep on the dev ports before assuming the previous instance is gone.

## What the agent should have done

1. **After every `TaskStop` on a `pnpm dev` (or similar multi-package turbo) task**, run a port-listening sweep before starting the replacement:
   ```powershell
   $ports = 3000,3002,3003,4000
   foreach ($p in $ports) {
     $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
     if ($conns) { foreach ($c in $conns) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue } }
   }
   ```
   Until every dev port is `free`, the new instance will silently fall back to alternates and the user will be testing the wrong process.

2. **When the user reports "site is up but not fetching records,"** add port-mismatch to the diagnostic list before assuming application-level bugs. Check `Get-NetTCPConnection -LocalPort 3000,3002,3003,4000` and confirm exactly one process per port and that it matches the most-recent `pnpm dev` task's PID tree.

3. **Long-term fix candidate**: wrap the `pnpm dev` invocation in a script that uses Windows Job Object (`/job` flag) or `cross-port-killer` so child processes inherit the parent's kill signal. Out of scope for #378 — but worth filing for the next dev-experience pass.

Net-new operational learning, Windows-specific. Likely worth promoting to L1 (or to a dev-experience tooling improvement) because the same trap will fire any time `pnpm dev` is restarted under harness control.
