'use client'

import Link from 'next/link'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Icon } from '@/components/ui/icon'
import { DOCUMENT_CREDIT_COST } from '@/lib/billing/plans'
import { formatNumber } from '@/lib/format'

interface InsufficientCreditsModalProps {
  open: boolean
  balance: number
  onClose: () => void
  /** Which action was blocked — drives the copy. Defaults to 'document'. */
  context?: 'document' | 'meeting'
}

export function InsufficientCreditsModal({
  open,
  balance,
  onClose,
  context = 'document',
}: InsufficientCreditsModalProps) {
  const title = context === 'meeting' ? 'Not enough credits to start a meeting' : 'Not enough credits'
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <div className="flex flex-col items-center text-center gap-2 pt-2">
          <div
            aria-hidden="true"
            className="grid place-items-center"
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'rgba(217, 119, 6, 0.1)',
              color: '#b45309',
            }}
          >
            <Icon name="sparkle" size={20} />
          </div>
          <DialogTitle className="text-[15px] font-semibold" style={{ color: 'var(--ink-1)' }}>
            {title}
          </DialogTitle>
          <p className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
            {context === 'meeting' ? 'Starting a meeting needs ' : 'Generating a document costs '}
            <span className="mono-num font-medium">{DOCUMENT_CREDIT_COST}</span> credits and you
            have <span className="mono-num font-medium">{formatNumber(balance)}</span> left.
            {context === 'meeting'
              ? ' Top up or subscribe to begin.'
              : ' Top up or subscribe to keep generating.'}
          </p>
          <div className="flex gap-2 mt-2 w-full">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-[8px] text-[12px] font-medium"
              style={{ padding: '8px 0', background: 'rgba(28,24,20,0.06)', color: 'var(--ink-2)' }}
            >
              Not now
            </button>
            <Link
              href="/billing"
              className="flex-1 rounded-[8px] text-[12px] font-medium grid place-items-center"
              style={{ padding: '8px 0', background: 'var(--accent-base)', color: '#fff' }}
            >
              Get credits
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
