import * as React from 'react'
import { format } from 'date-fns'

interface Props {
  title: string
  recipientNames: string
  preparedBy: string
}

export function ProposalThumbnail({ title, recipientNames, preparedBy }: Props) {
  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          borderRadius: 12,
          overflow: 'hidden',
          background: 'rgba(255, 253, 247, 0.85)',
          border: '0.5px solid rgba(255, 255, 255, 0.65)',
          boxShadow:
            '0 16px 50px rgba(28, 22, 14, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
          padding: '28px 32px',
          transform: 'rotate(-1.2deg)',
        }}
      >
        <div className="pm-eyebrow">Proposal · {format(new Date(), 'MMM d, yyyy')}</div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            marginTop: 6,
            marginBottom: 8,
            color: 'var(--ink-1)',
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 14 }}>
          Prepared for {recipientNames || 'your client'} · by {preparedBy}
        </div>
        <div style={{ height: 1, background: 'var(--line-1)', margin: '4px 0 12px' }} />
        {[80, 100, 92, 100, 60, 100, 95, 75].map((w, i) => (
          <div
            key={i}
            style={{
              height: 6,
              borderRadius: 3,
              background: 'rgba(28, 24, 20, 0.07)',
              width: w + '%',
              marginBottom: 8,
            }}
          />
        ))}
        <div style={{ height: 10 }} />
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--ink-1)' }}>
          Investment
        </div>
        {[60, 78, 70].map((w, i) => (
          <div
            key={i}
            className="flex items-center justify-between"
            style={{ marginBottom: 6 }}
          >
            <div
              style={{
                height: 5,
                background: 'rgba(28, 24, 20, 0.07)',
                borderRadius: 3,
                width: w + '%',
              }}
            />
            <div className="mono-num" style={{ fontSize: 10.5, color: 'var(--ink-2)' }}>
              ${[18, 24, 12][i]},000
            </div>
          </div>
        ))}
      </div>
      <span
        style={{
          position: 'absolute',
          top: -10,
          left: 16,
          background:
            'linear-gradient(180deg, var(--accent-2), var(--accent-base))',
          color: 'white',
          padding: '3px 10px',
          borderRadius: 999,
          fontSize: 10,
          fontFamily: 'var(--font-mono), monospace',
          letterSpacing: '0.05em',
          boxShadow: '0 2px 8px var(--accent-glow)',
        }}
      >
        POLISHED · v0.3
      </span>
    </div>
  )
}
