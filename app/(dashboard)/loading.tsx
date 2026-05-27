import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="pm-page" style={{ padding: '28px 36px 32px' }}>
      {/* Greeting */}
      <div className="mb-[22px]">
        <Skeleton style={{ height: 28, width: 240, marginBottom: 8 }} />
        <Skeleton style={{ height: 14, width: 320 }} />
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-3 mb-[22px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card" style={{ padding: 18 }}>
            <Skeleton style={{ height: 11, width: 80, marginBottom: 10 }} />
            <Skeleton style={{ height: 24, width: 60 }} />
          </div>
        ))}
      </div>

      {/* Table header */}
      <Skeleton style={{ height: 14, width: 140, margin: '0 0 10px' }} />

      <div className="card overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="grid items-center"
            style={{
              gridTemplateColumns: '1.5fr 2fr 1.2fr 1fr 30px',
              padding: '14px 18px',
              borderBottom: i < 4 ? '0.5px solid var(--line-1)' : 'none',
              gap: 12,
            }}
          >
            <Skeleton style={{ height: 12, width: '70%' }} />
            <div>
              <Skeleton style={{ height: 11, width: '80%', marginBottom: 4 }} />
              <Skeleton style={{ height: 10, width: '50%' }} />
            </div>
            <Skeleton style={{ height: 11, width: '60%' }} />
            <Skeleton style={{ height: 20, width: 90, borderRadius: 999 }} />
            <Skeleton style={{ height: 10, width: 10, borderRadius: 999 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
