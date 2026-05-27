'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { VoiceTonePills } from '@/components/profile/VoiceTonePills'
import { SignatureCard } from '@/components/profile/SignatureCard'
import { BrandPalette } from '@/components/profile/BrandPalette'
import { LogoUpload } from '@/components/profile/LogoUpload'
import type { UserProfile } from '@/types'

interface ProfileFormProps {
  profile: UserProfile
  email: string
}

export function ProfileForm({ profile, email }: ProfileFormProps) {
  const router = useRouter()
  const [state, setState] = React.useState({
    full_name: profile.full_name ?? '',
    company_name: profile.company_name ?? '',
    tagline: profile.tagline ?? '',
    website: profile.website ?? '',
    industry: profile.industry ?? '',
    voice_tones: profile.voice_tones ?? [],
    tone_prompt: profile.tone_prompt ?? '',
    signature_name: profile.signature_name ?? profile.full_name ?? '',
    signature_title: profile.signature_title ?? '',
    brand_colors: profile.brand_colors ?? [],
    logo_url: profile.logo_url ?? null,
  })
  const [saving, setSaving] = React.useState(false)

  function set<K extends keyof typeof state>(key: K, value: (typeof state)[K]) {
    setState((s) => ({ ...s, [key]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      toast.success('Profile saved')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="pm-page" style={{ padding: '28px 36px 32px' }}>
      <div className="pm-page-header flex items-end justify-between mb-[22px] gap-4">
        <div>
          <div className="pm-eyebrow">Settings</div>
          <h1 className="pm-h1">Profile &amp; Brand</h1>
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="btn"
            style={btnStyle}
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
            style={btnPrimaryStyle}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Company */}
      <div className="card p-[22px] mb-3.5">
        <div className="flex gap-4 items-start">
          <LogoUpload
            value={state.logo_url}
            onChange={(v) => set('logo_url', v)}
          />
          <div className="flex-1 grid grid-cols-2 gap-3">
            <Field label="Your name">
              <input
                className="field"
                value={state.full_name}
                onChange={(e) => set('full_name', e.target.value)}
                placeholder="Sarah Chen"
              />
            </Field>
            <Field label="Company name">
              <input
                className="field"
                value={state.company_name}
                onChange={(e) => set('company_name', e.target.value)}
                placeholder="Apex Studio"
              />
            </Field>
            <Field label="Tagline">
              <input
                className="field"
                value={state.tagline}
                onChange={(e) => set('tagline', e.target.value)}
                placeholder="What you do, in one line"
              />
            </Field>
            <Field label="Website">
              <input
                className="field"
                value={state.website}
                onChange={(e) => set('website', e.target.value)}
                placeholder="apexstudio.co"
              />
            </Field>
            <Field label="Industry">
              <input
                className="field"
                value={state.industry}
                onChange={(e) => set('industry', e.target.value)}
                placeholder="Design &amp; Brand"
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Voice & tone */}
      <div className="card p-[22px] mb-3.5">
        <div className="text-[13px] font-semibold mb-1.5" style={{ color: 'var(--ink-1)' }}>
          Voice &amp; tone
        </div>
        <p className="text-[12px] mb-3" style={{ color: 'var(--ink-3)' }}>
          How should PropMaker sound when drafting proposals on your behalf?
        </p>
        <VoiceTonePills value={state.voice_tones} onChange={(v) => set('voice_tones', v)} />
        <textarea
          className="field mt-3.5"
          style={{ minHeight: 70, padding: '8px 11px' }}
          value={state.tone_prompt}
          onChange={(e) => set('tone_prompt', e.target.value)}
          placeholder="Optional: extra guidance for the agent on style, vocabulary, what to avoid."
        />
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <SignatureCard
          name={state.signature_name}
          title={state.signature_title}
          onNameChange={(v) => set('signature_name', v)}
          onTitleChange={(v) => set('signature_title', v)}
          email={email}
        />
        <BrandPalette
          value={state.brand_colors}
          onChange={(v) => set('brand_colors', v)}
        />
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="block text-[11px] font-medium mb-1.5"
        style={{ color: 'var(--ink-2)', letterSpacing: '0.01em' }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 28,
  padding: '0 11px',
  borderRadius: 7,
  fontSize: 12.5,
  fontWeight: 500,
  color: 'var(--ink-1)',
  background: 'rgba(255,255,255,0.6)',
  border: '0.5px solid rgba(28,24,20,0.10)',
  boxShadow: '0 1px 2px rgba(28,22,14,0.06), inset 0 0.5px 0 rgba(255,255,255,0.7)',
  cursor: 'pointer',
}

const btnPrimaryStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 28,
  padding: '0 14px',
  borderRadius: 7,
  fontSize: 12.5,
  fontWeight: 500,
  color: 'white',
  background: 'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
  border: '0.5px solid rgba(77,138,107,0.6)',
  boxShadow: '0 1px 3px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)',
  cursor: 'pointer',
}
