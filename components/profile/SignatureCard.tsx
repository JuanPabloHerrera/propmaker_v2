'use client'

import * as React from 'react'
import { AvatarInitials } from '@/components/ui/avatar-initials'

interface SignatureCardProps {
  name: string
  title: string
  onNameChange: (v: string) => void
  onTitleChange: (v: string) => void
  email: string
}

function initialsFrom(name: string, fallback: string) {
  const src = name.trim() || fallback
  const parts = src.split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || src.slice(0, 2).toUpperCase()
}

export function SignatureCard({
  name,
  title,
  onNameChange,
  onTitleChange,
  email,
}: SignatureCardProps) {
  return (
    <div className="card p-[22px]">
      <div className="text-[13px] font-semibold mb-2.5" style={{ color: 'var(--ink-1)' }}>
        Signature
      </div>
      <div className="flex items-center gap-2.5">
        <AvatarInitials initials={initialsFrom(name, email)} color="sage" size={36} />
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          <input
            className="field"
            placeholder="Your name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            style={{ height: 28, fontSize: 12.5 }}
          />
          <input
            className="field"
            placeholder="Role / Title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            style={{ height: 28, fontSize: 12.5 }}
          />
        </div>
      </div>
      <div className="text-[11px] mt-3" style={{ color: 'var(--ink-3)' }}>
        Used as the signature block in generated proposals.
      </div>
    </div>
  )
}
