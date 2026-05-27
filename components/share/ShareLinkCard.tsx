'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Icon } from '@/components/ui/icon'
import { Pill } from '@/components/ui/pill'

interface Props {
  shareUrl: string | null
  onCreateLink: () => Promise<void>
  creating?: boolean
}

export function ShareLinkCard({ shareUrl, onCreateLink, creating }: Props) {
  function copy() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl).catch(() => {})
    toast.success('Link copied')
  }

  return (
    <div className="card p-[18px]">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[13px] font-semibold" style={{ color: 'var(--ink-1)' }}>
          Share via link
        </div>
        {shareUrl ? (
          <Pill variant="ok">
            <span className="dot" style={{ background: 'var(--ok)' }} />
            Live
          </Pill>
        ) : (
          <Pill>Not published</Pill>
        )}
      </div>
      {shareUrl ? (
        <div
          className="glass-soft flex items-center"
          style={{ borderRadius: 9, padding: '0 4px 0 12px', height: 34 }}
        >
          <span
            className="mono-num truncate"
            style={{ fontSize: 11.5, color: 'var(--ink-2)', flex: 1 }}
          >
            {shareUrl}
          </span>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 font-medium"
            style={{
              height: 26,
              padding: '0 9px',
              borderRadius: 6,
              fontSize: 11.5,
              color: 'var(--ink-1)',
              background: 'rgba(255,255,255,0.6)',
              border: '0.5px solid rgba(28,24,20,0.10)',
            }}
          >
            <Icon name="copy" size={12} />
            Copy
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onCreateLink}
          disabled={creating}
          className="inline-flex items-center gap-1.5 text-white font-medium"
          style={{
            height: 30,
            padding: '0 12px',
            borderRadius: 7,
            fontSize: 12,
            background:
              'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
            border: '0.5px solid rgba(77,138,107,0.6)',
          }}
        >
          <Icon name="link" size={12} />
          {creating ? 'Creating…' : 'Create share link'}
        </button>
      )}
      <div
        className="flex items-center gap-4 mt-3"
        style={{ fontSize: 11, color: 'var(--ink-3)' }}
      >
        <span>· Anyone with link</span>
        <span>· Read-only</span>
      </div>
    </div>
  )
}
