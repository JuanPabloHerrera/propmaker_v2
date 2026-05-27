import { Skeleton } from '@/components/ui/skeleton'

export default function ProfileLoading() {
  return (
    <div className="pm-page" style={{ padding: '28px 36px 32px' }}>
      <div className="flex items-end justify-between mb-[22px] gap-4">
        <div>
          <Skeleton style={{ height: 10, width: 60, marginBottom: 8 }} />
          <Skeleton style={{ height: 28, width: 220 }} />
        </div>
        <div className="flex gap-2.5">
          <Skeleton style={{ height: 28, width: 60, borderRadius: 7 }} />
          <Skeleton style={{ height: 28, width: 110, borderRadius: 7 }} />
        </div>
      </div>

      <div className="card" style={{ padding: 22, marginBottom: 14 }}>
        <div className="flex gap-4 items-start">
          <Skeleton style={{ height: 96, width: 96, borderRadius: 16 }} />
          <div className="flex-1 grid grid-cols-2 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i}>
                <Skeleton style={{ height: 10, width: 70, marginBottom: 6 }} />
                <Skeleton style={{ height: 34, width: '100%', borderRadius: 9 }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 22, marginBottom: 14 }}>
        <Skeleton style={{ height: 14, width: 120, marginBottom: 10 }} />
        <Skeleton style={{ height: 12, width: '70%', marginBottom: 14 }} />
        <div className="flex gap-1.5 flex-wrap">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 26, width: 90, borderRadius: 999 }} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <div className="card" style={{ padding: 22, height: 130 }} />
        <div className="card" style={{ padding: 22, height: 130 }} />
      </div>
    </div>
  )
}
