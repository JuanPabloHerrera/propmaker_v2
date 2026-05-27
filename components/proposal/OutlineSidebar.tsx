'use client'

import * as React from 'react'

export interface OutlineSection {
  id: string
  label: string
}

interface Props {
  sections: OutlineSection[]
  activeId: string | null
  onJump: (id: string) => void
  status?: string
  savedAgo?: string
}

export function OutlineSidebar({ sections, activeId, onJump, status = 'Draft · auto-saved', savedAgo }: Props) {
  return (
    <aside
      className="pm-no-print"
      style={{
        width: 220,
        flexShrink: 0,
        background: 'rgba(255, 253, 247, 0.30)',
        backdropFilter: 'blur(28px) saturate(160%)',
        WebkitBackdropFilter: 'blur(28px) saturate(160%)',
        borderRight: '0.5px solid var(--line-1)',
        padding: '20px 12px',
      }}
    >
      <div className="pm-eyebrow" style={{ padding: '0 12px 10px' }}>
        Outline
      </div>
      {sections.length === 0 ? (
        <div className="text-[11.5px]" style={{ padding: '0 12px', color: 'var(--ink-3)' }}>
          No sections yet. The outline appears here once the agent drafts the proposal.
        </div>
      ) : (
        sections.map((s, i) => {
          const active = activeId === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onJump(s.id)}
              className="flex items-center gap-2 rounded-[7px] w-full text-left transition-colors"
              style={{
                padding: '6px 10px 6px 12px',
                color: active ? 'var(--ink-1)' : 'var(--ink-2)',
                background: active ? 'rgba(255,255,255,0.55)' : 'transparent',
                fontWeight: active ? 500 : 400,
                boxShadow: active
                  ? '0 1px 2px rgba(28,22,14,0.06), inset 0 0 0 0.5px rgba(255,255,255,0.6)'
                  : undefined,
              }}
            >
              <span
                className="mono-num shrink-0"
                style={{ fontSize: 10, color: 'var(--ink-3)', width: 16 }}
              >
                {(i + 1).toString().padStart(2, '0')}
              </span>
              <span style={{ fontSize: 12 }} className="truncate">
                {s.label}
              </span>
            </button>
          )
        })
      )}

      <div className="h-px my-2.5 mx-2" style={{ background: 'var(--line-1)' }} />

      <div style={{ padding: '0 12px' }}>
        <div className="pm-eyebrow" style={{ marginBottom: 6 }}>
          Status
        </div>
        <div
          className="flex items-center gap-2"
          style={{ fontSize: 11.5, color: 'var(--ink-2)' }}
        >
          <span className="dot" style={{ background: 'var(--accent-base)' }} />
          {status}
        </div>
        {savedAgo && (
          <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 3 }}>
            {savedAgo}
          </div>
        )}
      </div>
    </aside>
  )
}
