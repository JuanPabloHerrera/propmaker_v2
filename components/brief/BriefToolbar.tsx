'use client'

import * as React from 'react'
import { AvatarInitials } from '@/components/ui/avatar-initials'
import { Icon } from '@/components/ui/icon'

interface Props {
  title: string
  clientCompany?: string | null
  saveState: 'idle' | 'saving' | 'saved'
  onRegenerate: () => void
  regenerating: boolean
  onGenerate: () => void
  generating: boolean
  disabled?: boolean
}

export function BriefToolbar({
  title,
  clientCompany,
  saveState,
  onRegenerate,
  regenerating,
  onGenerate,
  generating,
  disabled,
}: Props) {
  return (
    <div
      className="flex items-center gap-3 shrink-0"
      style={{
        height: 48,
        padding: '0 18px',
        borderBottom: '0.5px solid var(--line-1)',
        background: 'rgba(255, 255, 255, 0.30)',
        backdropFilter: 'blur(30px) saturate(160%)',
        WebkitBackdropFilter: 'blur(30px) saturate(160%)',
      }}
    >
      <AvatarInitials initials="P" color="bot" size={24} />
      <div className="flex flex-col min-w-0">
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-1)' }}>
          Proposal brief · Review &amp; prioritize
        </div>
        <div className="truncate" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
          {clientCompany ? `${clientCompany} · ` : ''}
          {title}
        </div>
      </div>

      <div className="flex-1" />

      <span
        className="mono-num"
        style={{ fontSize: 10.5, color: 'var(--ink-3)', minWidth: 56, textAlign: 'right' }}
      >
        {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : ''}
      </span>

      <button
        type="button"
        onClick={onRegenerate}
        disabled={disabled || regenerating || generating}
        className="flex items-center gap-1.5 font-medium disabled:opacity-50"
        style={{
          height: 26,
          padding: '0 10px',
          borderRadius: 7,
          fontSize: 11.5,
          color: 'var(--ink-2)',
          background: 'transparent',
          border: '0.5px solid var(--line-1)',
        }}
      >
        <Icon name="sparkle" size={12} />
        {regenerating ? 'Regenerating…' : 'Regenerate'}
      </button>

      <button
        type="button"
        onClick={onGenerate}
        disabled={disabled || generating || regenerating}
        className="flex items-center gap-1.5 font-medium disabled:opacity-60"
        style={{
          height: 26,
          padding: '0 12px',
          borderRadius: 7,
          fontSize: 11.5,
          color: 'white',
          background: 'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
          border: '0.5px solid rgba(77,138,107,0.6)',
          cursor: generating ? 'default' : 'pointer',
        }}
      >
        {generating ? 'Generating…' : 'Generate proposal'}
        {!generating && <Icon name="chevR" size={12} strokeWidth={1.8} />}
      </button>
    </div>
  )
}
