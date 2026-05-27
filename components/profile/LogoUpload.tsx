'use client'

import * as React from 'react'
import { toast } from 'sonner'

const MAX_BYTES = 2 * 1024 * 1024
const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml'
const ACCEPT_DISPLAY = 'PNG, JPG, WEBP, or SVG · max 2 MB'

interface Props {
  value: string | null
  onChange: (next: string | null) => void
}

export function LogoUpload({ value, onChange }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState<'uploading' | 'removing' | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [dragOver, setDragOver] = React.useState(false)

  function validate(file: File): string | null {
    if (!file.type.startsWith('image/')) return 'Please choose an image file.'
    if (file.size > MAX_BYTES) return 'Logo must be 2 MB or smaller.'
    return null
  }

  async function upload(file: File) {
    const err = validate(file)
    if (err) {
      setError(err)
      toast.error(err)
      return
    }
    setError(null)
    setBusy('uploading')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/profile/logo', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      onChange(data.logo_url)
      toast.success('Logo updated')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    setBusy('removing')
    try {
      const res = await fetch('/api/profile/logo', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Remove failed')
      onChange(null)
      toast.success('Logo removed')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Remove failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(null)
    }
  }

  function pick() {
    inputRef.current?.click()
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void upload(file)
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={pick}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        aria-label={value ? 'Change logo' : 'Upload logo'}
        aria-describedby="logo-help logo-error"
        className="relative grid place-items-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-base)]"
        style={{
          width: 96,
          height: 96,
          borderRadius: 16,
          background: value
            ? '#ffffff'
            : dragOver
              ? 'rgba(77,138,107,0.10)'
              : 'repeating-linear-gradient(135deg, rgba(28,24,20,0.045) 0 8px, transparent 8px 16px), rgba(255,253,247,0.4)',
          border: `0.5px ${dragOver ? 'solid var(--accent-base)' : 'dashed rgba(28,24,20,0.18)'}`,
          color: 'var(--ink-3)',
          cursor: busy ? 'progress' : 'pointer',
          overflow: 'hidden',
        }}
      >
        {value ? (
          // Plain <img> rather than next/image because the bucket URL
          // is dynamic and we don't want to round-trip the Next image
          // optimizer for a tiny user logo.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Company logo"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        ) : (
          <span
            className="text-[10.5px] uppercase tracking-wider font-mono"
            aria-hidden="true"
          >
            {busy === 'uploading' ? 'UPLOADING' : 'LOGO'}
          </span>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void upload(file)
          // Reset so the same file can be re-picked.
          e.target.value = ''
        }}
      />

      <div className="flex items-center gap-2 mt-0.5">
        <button
          type="button"
          onClick={pick}
          disabled={busy !== null}
          className="text-[11px] underline-offset-2 hover:underline disabled:opacity-50"
          style={{ color: 'var(--ink-2)' }}
        >
          {value ? 'Replace' : 'Upload'}
        </button>
        {value && (
          <>
            <span style={{ color: 'var(--ink-4)' }}>·</span>
            <button
              type="button"
              onClick={remove}
              disabled={busy !== null}
              className="text-[11px] underline-offset-2 hover:underline disabled:opacity-50"
              style={{ color: 'var(--rec)' }}
            >
              Remove
            </button>
          </>
        )}
      </div>

      <div
        id="logo-help"
        className="text-[10px] text-center max-w-[120px]"
        style={{ color: 'var(--ink-4)' }}
      >
        {ACCEPT_DISPLAY}
      </div>

      {error && (
        <div
          id="logo-error"
          role="alert"
          className="text-[10.5px] text-center max-w-[140px]"
          style={{ color: 'var(--rec)' }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
