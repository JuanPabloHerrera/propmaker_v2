'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Icon } from '@/components/ui/icon'

const ACCEPT = '.pdf,.docx,.txt,.md,.markdown'
// Files go through the API route as multipart — Vercel's ~4.5MB body cap.
const FILE_MAX_BYTES = 4.5 * 1024 * 1024

export default function UploadMeetingPage() {
  const router = useRouter()

  const [mode, setMode] = React.useState<'file' | 'paste'>('file')
  const [pasted, setPasted] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [dragOver, setDragOver] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  async function submit(file?: File) {
    if (!file && !pasted.trim()) {
      toast.error('Choose a file or paste the transcript text.')
      return
    }
    if (file && file.size > FILE_MAX_BYTES) {
      toast.error(
        `Files must be under 4.5 MB — this one is ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
      )
      return
    }

    setBusy(true)
    try {
      const form = new FormData()
      if (file) form.append('file', file)
      else form.append('pasted_text', pasted)
      const res = await fetch('/api/meetings/upload', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      toast.success('Meeting created — generate documents from it below.')
      router.push(`/meetings/${data.id}/documents`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
      setBusy(false)
    }
  }

  return (
    <div className="pm-page" style={{ padding: '28px 36px 32px', maxWidth: 720 }}>
      <Link
        href="/"
        className="inline-flex items-center gap-1 mb-3"
        style={{ fontSize: 12.5, color: 'var(--ink-3)' }}
      >
        <Icon name="chevL" size={12} />
        Back
      </Link>

      <div className="pm-eyebrow">Upload meeting</div>
      <h1 className="pm-h1" style={{ marginBottom: 6 }}>
        Import a transcript
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginBottom: 22 }}>
        Upload a transcript or meeting notes (PDF, DOCX, TXT, MD) or paste the
        text — then generate minutes, summaries, and proposals from it. Title
        and client are detected automatically.
      </p>

      <div className="card p-5" style={{ borderRadius: 14 }}>
        <div className="flex gap-1.5">
          {(['file', 'paste'] as const).map((mItem) => (
            <button
              key={mItem}
              type="button"
              onClick={() => setMode(mItem)}
              className="pill cursor-pointer"
              style={{
                height: 28,
                fontSize: 11.5,
                padding: '0 12px',
                background: mode === mItem ? 'var(--accent-soft)' : undefined,
                color: mode === mItem ? 'var(--accent-base)' : undefined,
                borderColor: mode === mItem ? 'rgba(77,138,107,0.2)' : undefined,
              }}
            >
              {mItem === 'file' ? 'Upload file' : 'Paste text'}
            </button>
          ))}
        </div>

        {mode === 'file' ? (
          <div className="mt-3.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const f = e.dataTransfer.files?.[0]
                if (f && !busy) void submit(f)
              }}
              disabled={busy}
              className="w-full flex flex-col items-center justify-center text-center disabled:opacity-50"
              style={{
                padding: '32px 12px',
                borderRadius: 10,
                border: dragOver ? '1px dashed var(--accent-base)' : '1px dashed var(--line-1)',
                background: dragOver ? 'var(--accent-soft)' : 'rgba(255,255,255,0.4)',
              }}
            >
              <Icon name="upload" size={18} />
              <div className="text-[12.5px] font-medium mt-1.5" style={{ color: 'var(--ink-1)' }}>
                {busy ? 'Processing…' : 'Choose a file or drop it here'}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                PDF, DOCX, TXT, MD · up to 4.5 MB
              </div>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void submit(f)
                e.target.value = ''
              }}
            />
          </div>
        ) : (
          <div className="mt-3.5">
            <textarea
              className="field"
              style={{ minHeight: 220, fontSize: 12.5, padding: 10, resize: 'vertical' }}
              placeholder="Paste the transcript or meeting notes…"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 text-white font-medium mt-2.5 disabled:opacity-60"
              style={{
                height: 38,
                fontSize: 13,
                borderRadius: 9,
                background: 'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
                border: '0.5px solid rgba(77,138,107,0.6)',
                boxShadow: '0 1px 3px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)',
              }}
            >
              <Icon name="upload" size={14} />
              {busy ? 'Creating meeting…' : 'Create meeting'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
