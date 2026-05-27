'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Icon } from '@/components/ui/icon'

interface Props {
  meetingId: string
  onSend: () => Promise<void>
  sending?: boolean
  proposalSlug?: string | null
}

export function ExportActions({ onSend, sending, proposalSlug }: Props) {
  function comingSoon(label: string) {
    toast.info(`${label} export coming soon.`)
  }

  function openPrintView() {
    if (proposalSlug) {
      // Open the public view in print mode.
      const w = window.open(`/p/${proposalSlug}?print=1`, '_blank')
      if (w) w.focus()
    } else {
      toast.info('Create a share link first.')
    }
  }

  return (
    <div
      className="card flex flex-col gap-2.5"
      style={{ padding: 14 }}
    >
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={openPrintView}
          className="inline-flex items-center justify-center gap-1.5 flex-1 font-medium"
          style={{
            height: 30,
            padding: '0 9px',
            borderRadius: 7,
            fontSize: 12,
            color: 'var(--ink-1)',
            background: 'rgba(255,255,255,0.6)',
            border: '0.5px solid rgba(28,24,20,0.10)',
          }}
        >
          <Icon name="download" size={12} />
          PDF
        </button>
        <button
          type="button"
          onClick={() => comingSoon('Google Docs')}
          className="inline-flex items-center justify-center gap-1.5 flex-1 font-medium"
          style={{
            height: 30,
            padding: '0 9px',
            borderRadius: 7,
            fontSize: 12,
            color: 'var(--ink-1)',
            background: 'rgba(255,255,255,0.6)',
            border: '0.5px solid rgba(28,24,20,0.10)',
          }}
        >
          <Icon name="doc" size={12} />
          Docs
        </button>
        <button
          type="button"
          onClick={() => comingSoon('Notion')}
          className="inline-flex items-center justify-center gap-1.5 flex-1 font-medium"
          style={{
            height: 30,
            padding: '0 9px',
            borderRadius: 7,
            fontSize: 12,
            color: 'var(--ink-1)',
            background: 'rgba(255,255,255,0.6)',
            border: '0.5px solid rgba(28,24,20,0.10)',
          }}
        >
          <Icon name="copy" size={12} />
          Notion
        </button>
      </div>
      <button
        type="button"
        onClick={onSend}
        disabled={sending}
        className="inline-flex items-center justify-center gap-2 text-white font-medium"
        style={{
          height: 40,
          padding: '0 16px',
          fontSize: 13.5,
          borderRadius: 9,
          background:
            'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
          border: '0.5px solid rgba(77,138,107,0.6)',
          boxShadow:
            '0 1px 3px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)',
        }}
      >
        <Icon name="send" size={14} />
        {sending ? 'Sending…' : 'Send proposal'}
      </button>
      <div
        className="text-center"
        style={{ fontSize: 10.5, color: 'var(--ink-3)' }}
      >
        Recipients will be notified via PropMaker (email send is in preview).
      </div>
    </div>
  )
}
