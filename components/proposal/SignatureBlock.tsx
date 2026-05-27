import * as React from 'react'
import { AvatarInitials } from '@/components/ui/avatar-initials'
import { Pill } from '@/components/ui/pill'

interface Props {
  signatureName: string
  signatureTitle: string
  email: string
  companyName?: string | null
  logoUrl?: string | null
  status: 'draft' | 'final'
}

function initialsFrom(name: string, fallback: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || fallback.slice(0, 2).toUpperCase()
}

export function SignatureBlock({
  signatureName,
  signatureTitle,
  email,
  companyName,
  logoUrl,
  status,
}: Props) {
  return (
    <>
      <hr />
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            // Plain <img>: the Supabase Storage URL is dynamic and we
            // don't want the Next image optimizer in the middle of a
            // print/share flow.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={companyName ? `${companyName} logo` : 'Company logo'}
              width={32}
              height={32}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                objectFit: 'contain',
                background: '#ffffff',
                border: '0.5px solid rgba(28,24,20,0.10)',
              }}
            />
          ) : (
            <AvatarInitials initials={initialsFrom(signatureName, email)} color="sage" size={32} />
          )}
          <div className="flex flex-col">
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-1)' }}>
              {signatureName || email.split('@')[0]}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              {[signatureTitle, companyName, email].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
        <Pill mono>{status === 'final' ? 'FINAL' : 'DRAFT'}</Pill>
      </div>
    </>
  )
}
