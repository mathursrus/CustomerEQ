'use client'

import type { Dispatch, FormEvent, SetStateAction } from 'react'

export type SourceType =
  | 'GOOGLE_BUSINESS_PROFILE'
  | 'LINKEDIN_ORG'
  | 'REDDIT'
  | 'X'
  | 'GENERIC_WEBHOOK'
  | 'GENERIC_API'

export type SyncMode = 'WEBHOOK' | 'POLL' | 'MANUAL'

export interface ExternalSignalSourceFormState {
  name: string
  sourceType: SourceType
  connectionMethod: string
  syncMode: SyncMode
  enabled: boolean
  scopeConfig: string
  filterConfig: string
  matchingConfig: string
  credentialRef: string
}

export const DEFAULT_EXTERNAL_SIGNAL_SOURCE_FORM: ExternalSignalSourceFormState = {
  name: '',
  sourceType: 'GENERIC_WEBHOOK',
  connectionMethod: 'webhook_secret',
  syncMode: 'WEBHOOK',
  enabled: true,
  scopeConfig: '{\n  "samplePayloads": []\n}',
  filterConfig: '{}',
  matchingConfig: '{\n  "memberResolutionEnabled": true\n}',
  credentialRef: '',
}

interface ExternalSignalSourceFormProps {
  form: ExternalSignalSourceFormState
  formHint: string
  submitting: boolean
  setForm: Dispatch<SetStateAction<ExternalSignalSourceFormState>>
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function ExternalSignalSourceForm({
  form,
  formHint,
  submitting,
  setForm,
  onSubmit,
}: ExternalSignalSourceFormProps) {
  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
          Source name
        </label>
        <input
          data-testid="external-source-name"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Acme flagship reviews"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
            Source type
          </label>
          <select
            data-testid="external-source-type"
            value={form.sourceType}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                sourceType: event.target.value as SourceType,
              }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="GOOGLE_BUSINESS_PROFILE">Google Business Profile</option>
            <option value="LINKEDIN_ORG">LinkedIn Org</option>
            <option value="REDDIT">Reddit</option>
            <option value="X">X</option>
            <option value="GENERIC_WEBHOOK">Generic webhook</option>
            <option value="GENERIC_API">Generic API</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
            Sync mode
          </label>
          <select
            data-testid="external-source-sync-mode"
            value={form.syncMode}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                syncMode: event.target.value as SyncMode,
              }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="WEBHOOK">Webhook</option>
            <option value="POLL">Poll</option>
            <option value="MANUAL">Manual</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
            Connection method
          </label>
          <input
            value={form.connectionMethod}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                connectionMethod: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="oauth or webhook_secret"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
            Credential reference
          </label>
          <input
            value={form.credentialRef}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                credentialRef: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Optional shared secret or secret ref"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              enabled: event.target.checked,
            }))
          }
        />
        Source enabled
      </label>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
          Scope config JSON
        </label>
        <textarea
          data-testid="external-source-scope-config"
          value={form.scopeConfig}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              scopeConfig: event.target.value,
            }))
          }
          rows={7}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="grid gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
            Filter config JSON
          </label>
          <textarea
            value={form.filterConfig}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                filterConfig: event.target.value,
              }))
            }
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
            Matching config JSON
          </label>
          <textarea
            value={form.matchingConfig}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                matchingConfig: event.target.value,
              }))
            }
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">{formHint}</p>

      <button
        type="submit"
        data-testid="save-external-source"
        disabled={submitting}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {submitting ? 'Saving...' : 'Save source'}
      </button>
    </form>
  )
}
