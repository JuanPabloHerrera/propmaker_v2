'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Icon } from '@/components/ui/icon'
import { PRICE_UNIT_LABELS, type Meeting, type Product } from '@/types'

interface Props {
  meetingId: string
  initialAttachedIds: string[]
  initialDetectedIds: string[]
  onMeetingChange?: (next: Partial<Meeting>) => void
}

interface PendingActions {
  add: Set<string>
  dismiss: Set<string>
}

/**
 * Shows the products auto-detected from the meeting transcript.
 * Each row has "Add" (move into attached_product_ids) and "Dismiss"
 * (remove from detected_product_ids) — both PATCH the meeting and
 * update optimistically.
 *
 * Detection runs once on mount; the consultant can re-trigger via
 * "Re-detect" if they keep editing the catalog or notes.
 */
export function DetectedProductsCard({
  meetingId,
  initialAttachedIds,
  initialDetectedIds,
  onMeetingChange,
}: Props) {
  const [detected, setDetected] = React.useState<Product[]>([])
  const [attached, setAttached] = React.useState<Set<string>>(
    () => new Set(initialAttachedIds),
  )
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState<PendingActions>({
    add: new Set(),
    dismiss: new Set(),
  })

  const runDetect = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/meetings/${meetingId}/detect-products`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Detection failed')
      setDetected((data.products as Product[]) ?? [])
      onMeetingChange?.({
        detected_product_ids: (data.detected_product_ids as string[]) ?? [],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Detection failed')
    } finally {
      setLoading(false)
    }
  }, [meetingId, onMeetingChange])

  // Kick off detection exactly once on mount. The ref guard is essential:
  // runDetect calls onMeetingChange → setMeeting on the parent, which would
  // re-render and (if this effect were keyed on runDetect) re-trigger
  // detection forever. Manual re-runs go through the "Re-detect" button.
  const didDetectRef = React.useRef(false)
  React.useEffect(() => {
    if (didDetectRef.current) return
    didDetectRef.current = true
    void runDetect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function patchMeeting(update: Partial<Meeting>) {
    const res = await fetch(`/api/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? 'Update failed')
    }
  }

  async function addToAttached(p: Product) {
    if (pending.add.has(p.id)) return
    setPending((s) => ({ ...s, add: new Set(s.add).add(p.id) }))
    const nextAttached = new Set(attached).add(p.id)
    const nextDetected = detected.filter((d) => d.id !== p.id)
    const nextAttachedIds = Array.from(nextAttached)
    const nextDetectedIds = nextDetected.map((d) => d.id)
    // Optimistic UI
    setAttached(nextAttached)
    setDetected(nextDetected)
    try {
      await patchMeeting({
        attached_product_ids: nextAttachedIds,
        detected_product_ids: nextDetectedIds,
      })
      onMeetingChange?.({
        attached_product_ids: nextAttachedIds,
        detected_product_ids: nextDetectedIds,
      })
      toast.success(`Added ${p.name}`)
    } catch (e) {
      // Revert
      setAttached(attached)
      setDetected(detected)
      toast.error(e instanceof Error ? e.message : 'Add failed')
    } finally {
      setPending((s) => {
        const next = new Set(s.add)
        next.delete(p.id)
        return { ...s, add: next }
      })
    }
  }

  async function dismiss(p: Product) {
    if (pending.dismiss.has(p.id)) return
    setPending((s) => ({ ...s, dismiss: new Set(s.dismiss).add(p.id) }))
    const nextDetected = detected.filter((d) => d.id !== p.id)
    setDetected(nextDetected)
    try {
      await patchMeeting({ detected_product_ids: nextDetected.map((d) => d.id) })
      onMeetingChange?.({ detected_product_ids: nextDetected.map((d) => d.id) })
    } catch (e) {
      setDetected(detected)
      toast.error(e instanceof Error ? e.message : 'Dismiss failed')
    } finally {
      setPending((s) => {
        const next = new Set(s.dismiss)
        next.delete(p.id)
        return { ...s, dismiss: next }
      })
    }
  }

  if (loading && detected.length === 0) {
    return (
      <div
        className="card flex items-center gap-2"
        role="status"
        aria-live="polite"
        style={{ padding: '10px 14px' }}
      >
        <span className="animate-pulse" style={{ color: 'var(--accent-base)' }}>
          <Icon name="sparkle" size={13} />
        </span>
        <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
          Scanning the transcript for catalog matches…
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="card flex items-center justify-between"
        role="alert"
        style={{ padding: '10px 14px' }}
      >
        <span className="text-[12px]" style={{ color: 'var(--rec)' }}>
          {error}
        </span>
        <button
          type="button"
          onClick={runDetect}
          className="text-[11.5px] hover:underline"
          style={{ color: 'var(--ink-2)' }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (detected.length === 0) return null

  return (
    <section
      aria-label="Detected products"
      className="card"
      style={{ padding: '12px 14px' }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <span style={{ color: 'var(--accent-base)' }}>
            <Icon name="sparkle" size={13} />
          </span>
          <span
            className="text-[11px] uppercase tracking-wider font-mono"
            style={{ color: 'var(--ink-3)' }}
          >
            Detected from transcript
          </span>
        </div>
        <button
          type="button"
          onClick={runDetect}
          disabled={loading}
          className="text-[11px] hover:underline disabled:opacity-50"
          style={{ color: 'var(--ink-3)' }}
        >
          {loading ? 'Re-detecting…' : 'Re-detect'}
        </button>
      </div>
      <ul className="flex flex-col gap-1.5">
        {detected.map((p) => {
          const isAdding = pending.add.has(p.id)
          const isDismissing = pending.dismiss.has(p.id)
          const price = formatPrice(p)
          return (
            <li
              key={p.id}
              className="flex items-center gap-3"
              style={{
                padding: '6px 8px',
                borderRadius: 8,
                background: 'rgba(255,253,247,0.6)',
                border: '0.5px solid var(--line-1)',
              }}
            >
              <div className="flex-1 min-w-0">
                <div
                  className="text-[12.5px] font-medium truncate"
                  style={{ color: 'var(--ink-1)' }}
                >
                  {p.name}
                </div>
                <div className="text-[11px] flex gap-1.5 truncate" style={{ color: 'var(--ink-3)' }}>
                  <span>{p.category}</span>
                  {price && <span>· {price}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => addToAttached(p)}
                disabled={isAdding || isDismissing}
                className="text-[11px] font-medium disabled:opacity-50"
                style={{
                  height: 24,
                  padding: '0 9px',
                  borderRadius: 6,
                  color: 'white',
                  background:
                    'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
                  border: '0.5px solid rgba(77,138,107,0.6)',
                  cursor: 'pointer',
                }}
              >
                {isAdding ? 'Adding…' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => dismiss(p)}
                disabled={isAdding || isDismissing}
                aria-label={`Dismiss ${p.name}`}
                className="grid place-items-center rounded-md hover:bg-[rgba(28,24,20,0.05)] disabled:opacity-50"
                style={{ width: 24, height: 24, color: 'var(--ink-3)' }}
              >
                <Icon name="close" size={11} strokeWidth={1.6} />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function formatPrice(p: Product): string | null {
  if (p.price_amount == null) return null
  const unit = p.price_unit ? ` (${PRICE_UNIT_LABELS[p.price_unit]})` : ''
  return `${p.currency} ${p.price_amount.toLocaleString()}${unit}`
}
