'use client'

import { MigrationWizard } from '../_components/MigrationWizard'

// Issue #524 Slice 1 — entry route for the guided "switch member identifier
// kind" wizard. The wizard itself creates the migration on mount and walks the
// admin through choose & prepare → upload & validate → confirm & migrate.

export default function NewMigrationPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <MigrationWizard />
    </div>
  )
}
