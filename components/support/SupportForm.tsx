'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Icon } from '@/components/ui/icon'

const CATEGORIES = ['Bug', 'Billing', 'Feature request', 'Question', 'Other'] as const

const inputStyle: React.CSSProperties = {
  padding: '9px 11px',
  borderRadius: 9,
  border: '0.5px solid var(--line-1)',
  background: 'rgba(255,255,255,0.55)',
  fontSize: 13,
  color: 'var(--ink-1)',
  width: '100%',
}

export function SupportForm({ userEmail }: { userEmail: string }) {
  const [category, setCategory] = React.useState<string>('Question')
  const [subject, setSubject] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [sent, setSent] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          subject,
          message,
          // Helps place a bug report without asking the user where they were.
          page: typeof document !== 'undefined' ? document.referrer || '' : '',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not send your message')

      setSent(true)
      setSubject('')
      setMessage('')
      toast.success('Message sent — we’ll reply by email.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send your message')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="card flex items-center gap-4" style={{ borderRadius: 14, padding: '20px 24px' }}>
        <div
          aria-hidden="true"
          className="grid place-items-center shrink-0"
          style={{
            width: 40,
            height: 40,
            borderRadius: 11,
            background: 'rgba(77, 138, 107, 0.12)',
            color: 'var(--accent-base)',
          }}
        >
          <Icon name="check" size={18} />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-medium" style={{ color: 'var(--ink-1)' }}>
            Message sent
          </div>
          <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
            We&apos;ll reply to {userEmail}.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="shrink-0 rounded-[8px] text-[12px] font-medium"
          style={{ padding: '8px 14px', background: 'rgba(28,24,20,0.06)', color: 'var(--ink-2)' }}
        >
          Send another
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3" style={{ borderRadius: 14, padding: '20px 24px' }}>
      <div className="flex flex-col gap-1.5">
        <label className="pm-eyebrow" htmlFor="support-category">
          Topic
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className="rounded-[7px] text-[12px] transition-colors"
              style={{
                padding: '6px 11px',
                background: category === c ? 'var(--accent-base)' : 'rgba(28,24,20,0.05)',
                color: category === c ? '#fff' : 'var(--ink-2)',
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="pm-eyebrow" htmlFor="support-subject">
          Subject
        </label>
        <input
          id="support-subject"
          required
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Short summary"
          style={inputStyle}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="pm-eyebrow" htmlFor="support-message">
          Message
        </label>
        <textarea
          id="support-message"
          required
          maxLength={5000}
          rows={7}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What happened, and what did you expect instead?"
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />
        <div className="text-[11px] text-right" style={{ color: 'var(--ink-3)' }}>
          {message.length}/5000
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
          Sent from {userEmail} — your plan and credit balance are included automatically.
        </div>
        <button
          type="submit"
          disabled={busy || !subject.trim() || !message.trim()}
          className="shrink-0 rounded-[8px] text-[12px] font-medium disabled:opacity-50"
          style={{ padding: '9px 18px', background: 'var(--accent-base)', color: '#fff' }}
        >
          {busy ? 'Sending…' : 'Send message'}
        </button>
      </div>
    </form>
  )
}
