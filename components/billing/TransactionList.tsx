import { format } from 'date-fns'
import type { CreditTransaction, CreditTransactionType } from '@/types'

const TYPE_LABELS: Record<CreditTransactionType, string> = {
  grant: 'Free credits',
  purchase: 'Credit pack',
  subscription_grant: 'Plan credits',
  spend: 'Document generated',
  refund: 'Refund',
}

export function TransactionList({ transactions }: { transactions: CreditTransaction[] }) {
  return (
    <div className="card overflow-hidden">
      <div
        className="text-[13px] font-semibold"
        style={{ padding: '12px 18px', borderBottom: '0.5px solid var(--line-1)', color: 'var(--ink-1)' }}
      >
        Recent activity
      </div>
      {transactions.length === 0 ? (
        <div className="p-6 text-[12px]" style={{ color: 'var(--ink-3)' }}>
          No credit activity yet.
        </div>
      ) : (
        transactions.map((tx, i) => (
          <div
            key={tx.id}
            className="flex items-center gap-3"
            style={{
              padding: '11px 18px',
              borderBottom: i < transactions.length - 1 ? '0.5px solid var(--line-1)' : 'none',
            }}
          >
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium" style={{ color: 'var(--ink-1)' }}>
                {TYPE_LABELS[tx.type] ?? tx.type}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                {format(new Date(tx.created_at), 'MMM d, yyyy · h:mm a')}
                {tx.reason ? ` · ${tx.reason}` : ''}
              </div>
            </div>
            <div
              className="mono-num text-[12.5px] font-medium shrink-0"
              style={{ color: tx.amount < 0 ? 'var(--ink-2)' : 'var(--accent-base)' }}
            >
              {tx.amount > 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()}
            </div>
            <div
              className="mono-num text-[11px] shrink-0"
              style={{ color: 'var(--ink-3)', width: 72, textAlign: 'right' }}
            >
              = {tx.balance_after.toLocaleString()}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
