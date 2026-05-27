'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'

interface Props {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  placeholder?: string
}

export function CategoryCombobox({ value, onChange, suggestions, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = suggestions
    .filter((s) => s.toLowerCase().includes(value.toLowerCase()) && s !== value)
    .slice(0, 8)

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder ?? 'e.g. Web App, Compliance Audit'}
        className="h-10 rounded-xl border-[#d2d2d7] bg-[#f5f5f7] focus:bg-white"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-10 top-full mt-1 w-full bg-white border border-[#d2d2d7] rounded-xl shadow-md overflow-hidden">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { onChange(s); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-[#1d1d1f] hover:bg-[#f5f5f7]"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
