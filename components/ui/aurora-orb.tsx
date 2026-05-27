import * as React from 'react'
import { Icon } from '@/components/ui/icon'

interface AuroraOrbProps {
  size?: number
}

// Animated conic-gradient orb behind a frosted glass disc. Used on the
// Processing screen as the "agent is working" visual.
// Respects prefers-reduced-motion via the orb-spin animation (defined inline
// here, and the @media (prefers-reduced-motion: reduce) block below).
export function AuroraOrb({ size = 120 }: AuroraOrbProps) {
  return (
    <div
      style={{ position: 'relative', width: size, height: size }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes orb-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .pm-orb { animation: none !important; }
        }
      `}</style>
      <div
        className="pm-orb"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background:
            'conic-gradient(from 0deg, var(--accent-base), #c98a3a, #6fa888, var(--accent-base))',
          filter: 'blur(20px)',
          animation: 'orb-spin 4s linear infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 14,
          borderRadius: '50%',
          background: 'rgba(255, 253, 247, 0.6)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '0.5px solid rgba(255, 255, 255, 0.8)',
          display: 'grid',
          placeItems: 'center',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.6)',
          color: 'var(--accent-base)',
        }}
      >
        <Icon name="sparkle" size={30} />
      </div>
    </div>
  )
}
