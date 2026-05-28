// Issue #420 — Shared audience builder shell.
//
// Mounts the two side-by-side add-cards (R16) and the accumulated audience
// list (R20-R23) below them. Owns the canonical list of rows + dedup logic
// (R21: existing search beats custom-list paste on identical identifier) +
// emits an AudienceBuilderState upward whenever the selection changes, so
// the parent flow (SelfServeFlow / ManagedEmailFlow) can drive Generate /
// Send + the inline preview count.
//
// Submission payload is encoded as a `mode: 'custom_list'` paste of the
// selected rows' externalIds (or emails for auto-enroll) — this lets the
// backend re-resolve the exact same set of members at Generate time without
// introducing a new audience mode and without disrupting the existing
// composerSnapshot / audit-log machinery.

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { AddFromExistingMembersCard } from './AddFromExistingMembersCard'
import { AddFromCustomListCard } from './AddFromCustomListCard'
import { AudienceList } from './AudienceList'
import type { AudienceBuilderState, AudienceRow } from './types'

interface AudienceBuilderProps {
  surveyId: string
  surveyNameInMail: string
  expiresAtIso: string
  totalMemberCount: number
  onChange: (state: AudienceBuilderState) => void
}

const rowKey = (r: AudienceRow): string =>
  r.memberId ?? r.identifier.toLowerCase()

export function AudienceBuilder({
  surveyId,
  surveyNameInMail,
  expiresAtIso,
  totalMemberCount,
  onChange,
}: AudienceBuilderProps) {
  const [rows, setRows] = useState<AudienceRow[]>([])

  const alreadyAddedKeys = useMemo(
    () => new Set(rows.map((r) => rowKey(r))),
    [rows],
  )

  const handleAddRows = useCallback((incoming: AudienceRow[]) => {
    setRows((prev) => {
      const seen = new Set(prev.map((r) => rowKey(r)))
      const next = [...prev]
      for (const row of incoming) {
        const key = rowKey(row)
        if (!seen.has(key)) {
          next.push(row)
          seen.add(key)
        }
      }
      return next
    })
  }, [])

  const handleToggleRow = useCallback((key: string) => {
    setRows((prev) =>
      prev.map((r) =>
        rowKey(r) === key && r.suppressionStatus === 'OK'
          ? { ...r, selected: !r.selected }
          : r,
      ),
    )
  }, [])

  const handleBulkSelectPage = useCallback((keys: string[], select: boolean) => {
    const keySet = new Set(keys)
    setRows((prev) =>
      prev.map((r) =>
        keySet.has(rowKey(r)) && r.suppressionStatus === 'OK'
          ? { ...r, selected: select }
          : r,
      ),
    )
  }, [])

  const handleRemoveUnchecked = useCallback(() => {
    setRows((prev) =>
      prev.filter((r) => r.selected || r.suppressionStatus !== 'OK'),
    )
  }, [])

  // Emit the audience-builder state upward whenever rows change.
  useEffect(() => {
    const selectableRows = rows.filter(
      (r) => r.selected && r.suppressionStatus === 'OK',
    )
    const selectedCount = selectableRows.length
    const suppressedCount = rows.filter(
      (r) => r.suppressionStatus !== 'OK',
    ).length
    const willAutoEnrollCount = selectableRows.filter((r) => r.willAutoEnroll).length

    // Issue #531 — split selection into two server-side resolution channels:
    //   - rows the UI already resolved (have memberId) → memberIds[], looked
    //     up server-side by Member.id directly (no brand-kind shape inference);
    //   - typed-but-unresolved auto-enroll rows (no memberId) → identifiers
    //     paste body, parsed/auto-enrolled by the existing path.
    // Pre-fix the UI mashed both into a paste body and the server's
    // brand-kind-aware parser silently dropped resolved rows whose externalId
    // shape disagreed with Brand.memberIdentifierKind (production 2026-05-28).
    const memberIds: string[] = []
    const autoEnrollIdentifiers: string[] = []
    for (const r of selectableRows) {
      if (r.memberId) memberIds.push(r.memberId)
      else autoEnrollIdentifiers.push(r.identifier)
    }
    const identifiers = autoEnrollIdentifiers.join('\n')

    onChange({
      rows,
      selectedCount,
      suppressedCount,
      willAutoEnrollCount,
      submitAudience: {
        mode: 'custom_list',
        identifiers,
        autoEnroll: true,
        memberIds,
      },
    })
  }, [rows, onChange])

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <AddFromExistingMembersCard
          surveyId={surveyId}
          surveyNameInMail={surveyNameInMail}
          expiresAtIso={expiresAtIso}
          totalMemberCount={totalMemberCount}
          alreadyAddedKeys={alreadyAddedKeys}
          onAddRows={handleAddRows}
        />
        <AddFromCustomListCard
          surveyId={surveyId}
          surveyNameInMail={surveyNameInMail}
          expiresAtIso={expiresAtIso}
          alreadyAddedKeys={alreadyAddedKeys}
          onAddRows={handleAddRows}
        />
      </div>

      <AudienceList
        rows={rows}
        onToggleRow={handleToggleRow}
        onBulkSelectPage={handleBulkSelectPage}
        onRemoveUnchecked={handleRemoveUnchecked}
      />
    </section>
  )
}
