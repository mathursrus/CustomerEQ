'use client'

import { useMemo, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth, useUser } from '@clerk/nextjs'
import { API_URL, getAuthToken } from '@/lib/config'
import { AdminPendingBanner } from '@/components/admin/AdminPendingBanner'
import { orgFormSchema } from '../lib/schema'
import { computePendingItems } from '../lib/pendingItems'
import { SECTION_FIELDS, type ConsentMode, type OrgFormValues, type ProfileResponse, type SectionId } from '../lib/types'
import { IdentitySection } from './sections/IdentitySection'
import { DefaultsSection } from './sections/DefaultsSection'
import { LookAndFeelSection } from './sections/LookAndFeelSection'
import { MemberIdentificationSection } from './sections/MemberIdentificationSection'
import { ConsentLegalSection } from './sections/ConsentLegalSection'
import { DeveloperSupportSection } from './sections/DeveloperSupportSection'
import { ImpliedAttestationModal } from './ImpliedAttestationModal'

// Issue #292 Slice 4 — orchestrator for the six-section form.
//
// Single useForm at the top of the page; per-section dirty + Save / Cancel
// reveal via formState.dirtyFields filtered through SECTION_FIELDS. PATCH
// submits only the fields that belong to the saving section, plus the
// attestation block when consentMode flips to IMPLIED_ON_SUBMIT.

interface SectionConfig {
  id: SectionId
  title: string
  help: string
  saveLabel: string
  collapsible?: boolean
  initiallyCollapsed?: boolean
}

const SECTIONS: SectionConfig[] = [
  { id: 's-identity', title: 'Identity', help: 'Your customer-facing identity.', saveLabel: 'Save Identity' },
  {
    id: 's-defaults',
    title: 'Defaults',
    help: "Defaults applied when surveys or pages don't override.",
    saveLabel: 'Save Defaults',
  },
  {
    id: 's-lookfeel',
    title: 'Look & Feel',
    help: 'Default theme for customer-facing surfaces.',
    saveLabel: 'Save Look & Feel',
  },
  {
    id: 's-members',
    title: 'Member identification',
    help: 'How CustomerEQ recognizes your members.',
    saveLabel: 'Save Member identification',
  },
  {
    id: 's-consent',
    title: 'Consent & legal',
    help: 'Consent posture and the legal links surfaced to your members.',
    saveLabel: 'Save Consent',
  },
  {
    id: 's-developer',
    title: 'Developer & Support reference',
    help: 'Read-only identifiers + support contact. No action required.',
    saveLabel: '',
    collapsible: true,
    initiallyCollapsed: true,
  },
]

function brandToFormValues(profile: ProfileResponse): OrgFormValues {
  const b = profile.brand
  return {
    name: b.name ?? '',
    siteDomain: b.siteDomain ?? '',
    logoUrl: b.logoUrl ?? '',
    orgSize: b.orgSize ?? '',
    timezone: b.timezone,
    locale: b.locale,
    defaultThemeId: b.defaultThemeId ?? '',
    memberIdentifierKind: b.memberIdentifierKind,
    consentMode: b.consentMode,
    consentTextDefault: b.consentTextDefault ?? '',
    privacyPolicyUrl: b.privacyPolicyUrl ?? '',
    termsUrl: b.termsUrl ?? '',
  }
}

interface OrganizationSettingsFormProps {
  initial: ProfileResponse
}

export function OrganizationSettingsForm({ initial }: OrganizationSettingsFormProps) {
  const { getToken } = useAuth()
  const { user } = useUser()
  const adminEmail = user?.primaryEmailAddress?.emailAddress ?? ''

  const initialValues = useMemo(() => brandToFormValues(initial), [initial])
  const methods = useForm<OrgFormValues>({
    defaultValues: initialValues,
    resolver: zodResolver(orgFormSchema),
    mode: 'onChange',
  })

  const [collapsed, setCollapsed] = useState<Record<SectionId, boolean>>({
    's-identity': false,
    's-defaults': false,
    's-lookfeel': false,
    's-members': false,
    's-consent': false,
    's-developer': true,
  })
  const [toast, setToast] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pendingConsentMode, setPendingConsentMode] = useState<ConsentMode | null>(null)
  const [pendingAttestation, setPendingAttestation] = useState<{
    justification: string
    confirmed: true
  } | null>(null)

  const values = methods.watch()
  const pendingItems = useMemo(() => computePendingItems(values), [values])

  async function patchProfile(body: Record<string, unknown>): Promise<void> {
    const token = await getAuthToken(getToken)
    const res = await fetch(`${API_URL}/v1/admin/brand/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      let message = `Save failed (HTTP ${res.status})`
      try {
        const err = (await res.json()) as { error?: string; code?: string }
        if (err.error) message = err.error
        if (err.code === 'MEMBER_IDENTIFIER_KIND_LOCKED') {
          message =
            'This option cannot be changed once members are enrolled. Contact CustomerEQ Support.'
        }
        if (err.code === 'EXPLICIT_REQUIRES_PRIVACY_TOKEN') {
          message = 'Add a privacy link ({{privacy}}) to your consent text before saving.'
        }
      } catch {
        // Body wasn't JSON; leave the default message in place.
      }
      throw new Error(message)
    }
  }

  function buildSectionPatch(sectionId: SectionId, all: OrgFormValues): Record<string, unknown> {
    const fields = SECTION_FIELDS[sectionId]
    const out: Record<string, unknown> = {}
    for (const f of fields) {
      const v = all[f]
      // Send empty strings as null so the API clears the column. orgSize
      // empty string is treated as "no selection" → null. Required strings
      // (name, timezone, locale) never reach this branch as empty —
      // Zod blocks the submit.
      if (v === '') {
        // Keep required fields out of the null-coercion branch.
        if (f === 'name' || f === 'timezone' || f === 'locale' || f === 'defaultThemeId') continue
        out[f] = null
      } else {
        out[f] = v
      }
    }
    return out
  }

  function isSectionDirty(sectionId: SectionId): boolean {
    const dirtyFields = methods.formState.dirtyFields as Partial<Record<keyof OrgFormValues, boolean>>
    return SECTION_FIELDS[sectionId].some((f) => Boolean(dirtyFields[f]))
  }

  function pendingFieldsForSection(sectionId: SectionId): boolean {
    return pendingItems.some((p) => p.jumpToSectionId === sectionId)
  }

  async function handleSaveSection(sectionId: SectionId) {
    setSaveError(null)
    const valid = await methods.trigger(SECTION_FIELDS[sectionId])
    if (!valid) return

    const all = methods.getValues()
    const patch = buildSectionPatch(sectionId, all)

    // For consent section, attach the attestation block when the section's
    // PATCH includes a consentMode change to IMPLIED_ON_SUBMIT.
    if (sectionId === 's-consent' && all.consentMode === 'IMPLIED_ON_SUBMIT' && pendingAttestation) {
      patch.attestation = pendingAttestation
    }

    try {
      await patchProfile(patch)
      methods.reset(all, { keepValues: true, keepDirty: false })
      setPendingAttestation(null)
      setToast(`${sectionConfigById(sectionId).title} saved`)
      setTimeout(() => setToast(null), 2400)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  function handleCancelSection(sectionId: SectionId) {
    for (const f of SECTION_FIELDS[sectionId]) {
      methods.setValue(f, initialValues[f] as never, { shouldDirty: false, shouldValidate: false })
    }
    if (sectionId === 's-consent') setPendingAttestation(null)
  }

  function sectionConfigById(id: SectionId): SectionConfig {
    return SECTIONS.find((s) => s.id === id) ?? SECTIONS[0]
  }

  function handleConsentModeFlipAttempt(next: ConsentMode) {
    if (next === 'IMPLIED_ON_SUBMIT' && values.consentMode !== 'IMPLIED_ON_SUBMIT') {
      setPendingConsentMode(next)
      return
    }
    methods.setValue('consentMode', next, { shouldDirty: true, shouldValidate: true })
    setPendingAttestation(null)
  }

  function confirmImpliedAttestation(att: { justification: string; confirmed: true }) {
    setPendingAttestation(att)
    methods.setValue('consentMode', 'IMPLIED_ON_SUBMIT', {
      shouldDirty: true,
      shouldValidate: true,
    })
    setPendingConsentMode(null)
  }

  function cancelImpliedAttestation() {
    setPendingConsentMode(null)
  }

  return (
    <FormProvider {...methods}>
      <div>
        <header className="mb-6">
          <h1 className="m-0 text-2xl font-bold text-gray-900">Organization settings</h1>
          <p className="m-0 mt-1 max-w-3xl text-sm text-gray-500">
            Your organization's preferences and configuration. Sections save independently — edit
            one at a time without committing the whole page.
          </p>
        </header>

        <AdminPendingBanner items={pendingItems} />

        <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1fr_220px]">
          <div className="flex min-w-0 flex-col gap-5">
            {SECTIONS.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                collapsed={section.collapsible ? collapsed[section.id] : false}
                onToggleCollapse={
                  section.collapsible
                    ? () => setCollapsed((c) => ({ ...c, [section.id]: !c[section.id] }))
                    : undefined
                }
                pending={pendingFieldsForSection(section.id)}
                dirty={isSectionDirty(section.id)}
                onSave={() => void handleSaveSection(section.id)}
                onCancel={() => handleCancelSection(section.id)}
                error={saveError}
              >
                {renderSectionBody(section.id, initial, handleConsentModeFlipAttempt)}
              </SectionCard>
            ))}
          </div>

          {/*
            TOC wrapper takes the full grid-row height (default align-items:
            stretch) so the inner sticky <nav> has room to remain pinned while
            the sections column scrolls. Don't set items-start on the parent
            grid or self-start here — both collapse the cell to the TOC's
            natural height and break sticky positioning.
          */}
          <div className="hidden lg:block">
            <Toc sections={SECTIONS} pendingFor={pendingFieldsForSection} />
          </div>
        </div>

        <ImpliedAttestationModal
          open={pendingConsentMode === 'IMPLIED_ON_SUBMIT'}
          adminEmail={adminEmail}
          onConfirm={confirmImpliedAttestation}
          onCancel={cancelImpliedAttestation}
        />

        {toast && (
          <div className="fixed right-7 top-20 z-50 flex items-center gap-2 rounded-md bg-gray-900 px-3.5 py-2.5 text-sm text-white shadow-lg">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-xs font-bold">
              ✓
            </span>
            {toast}
          </div>
        )}
      </div>
    </FormProvider>
  )

  function renderSectionBody(
    id: SectionId,
    profile: ProfileResponse,
    onConsentModeFlipAttempt: (next: ConsentMode) => void,
  ): React.ReactNode {
    switch (id) {
      case 's-identity':
        return <IdentitySection />
      case 's-defaults':
        return <DefaultsSection />
      case 's-lookfeel':
        return <LookAndFeelSection themes={profile.themes} />
      case 's-members':
        return (
          <MemberIdentificationSection
            memberCount={profile.memberCount}
            supportEmail={profile.supportEmail}
          />
        )
      case 's-consent':
        return <ConsentLegalSection onConsentModeFlipAttempt={onConsentModeFlipAttempt} />
      case 's-developer':
        return (
          <DeveloperSupportSection brand={profile.brand} supportEmail={profile.supportEmail} />
        )
    }
  }
}

interface SectionCardProps {
  section: SectionConfig
  collapsed: boolean
  onToggleCollapse?: () => void
  pending: boolean
  dirty: boolean
  onSave: () => void
  onCancel: () => void
  error: string | null
  children: React.ReactNode
}

function SectionCard({
  section,
  collapsed,
  onToggleCollapse,
  pending,
  dirty,
  onSave,
  onCancel,
  error,
  children,
}: SectionCardProps) {
  return (
    <section
      id={section.id}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      <header
        className={`flex items-start justify-between gap-3 px-5 pb-2.5 pt-4 ${
          onToggleCollapse ? 'cursor-pointer select-none' : ''
        }`}
        onClick={onToggleCollapse}
      >
        <div className="flex-1">
          <h2 className="m-0 mb-1 flex items-center gap-2 text-base font-semibold text-gray-900">
            {section.title}
            {pending && (
              <span className="text-xs font-medium text-amber-600" aria-label="Has pending fields">
                ●
              </span>
            )}
          </h2>
          <p className="m-0 text-sm text-gray-500">{section.help}</p>
        </div>
        {onToggleCollapse && (
          <span
            aria-hidden="true"
            className="select-none text-sm font-medium text-gray-600 transition-transform"
          >
            {collapsed ? '▶' : '▼'}
          </span>
        )}
      </header>
      {!collapsed && (
        <>
          <div className="space-y-4 px-5 pb-4 pt-1">{children}</div>
          {section.saveLabel && dirty && (
            <div className="flex items-center gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
              <span className="mr-auto flex items-center gap-1.5 text-xs text-gray-500">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-600" />
                Unsaved changes
              </span>
              {error && (
                <span className="text-xs font-medium text-red-600">{error}</span>
              )}
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                {section.saveLabel}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function Toc({
  sections,
  pendingFor,
}: {
  sections: SectionConfig[]
  pendingFor: (id: SectionId) => boolean
}) {
  return (
    <nav
      aria-label="On this page"
      // top-4 keeps the rail just below the admin <main>'s top padding edge
      // (admin layout gives <main> overflow-y-auto, so this is the active
      // scroll container — sticky offsets are measured from there, not the
      // viewport).
      className="sticky top-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
    >
      <p className="m-0 mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
        On this page
      </p>
      <ul className="m-0 list-none p-0">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="flex items-center justify-between gap-2 rounded-md border-l-2 border-transparent px-2.5 py-1.5 text-sm text-gray-500 hover:text-gray-900"
            >
              <span>{s.title}</span>
              {pendingFor(s.id) && (
                <span aria-hidden className="text-xs text-amber-500">
                  ●
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
