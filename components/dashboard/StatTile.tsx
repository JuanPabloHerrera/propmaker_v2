import * as React from 'react'

interface StatTileProps {
  label: string
  value: string | number
  unit?: string
  hint?: string
}

export function StatTile({ label, value, unit, hint }: StatTileProps) {
  return (
    <div className="card p-4">
      <div className="pm-eyebrow mb-1.5">{label}</div>
      <div className="flex items-end gap-1.5">
        <div
          className="mono-num"
          style={{
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            color: 'var(--ink-1)',
          }}
        >
          {value}
        </div>
        {unit && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', paddingBottom: 3 }}>{unit}</div>
        )}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>{hint}</div>
      )}
    </div>
  )
}
