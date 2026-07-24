import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DocumentsTable, type DocumentRow } from '@/components/dashboard/DocumentsTable'
import { DOC_TYPE_LABELS, type DocType } from '@/types'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 25
const DOC_TYPES: DocType[] = ['minute', 'summary', 'proposal', 'notes']

interface Search {
  type?: string
  page?: string
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const params = await searchParams
  const activeType = DOC_TYPES.includes(params.type as DocType)
    ? (params.type as DocType)
    : null
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('meeting_documents')
    .select('id, meeting_id, doc_type, title, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to)
  if (activeType) query = query.eq('doc_type', activeType)

  const { data: docsData, count } = await query
  const docs = (docsData ?? []) as Array<
    Pick<DocumentRow, 'id' | 'meeting_id' | 'doc_type' | 'title' | 'created_at'>
  >

  // Second pass: pull the parent meetings for the docs on this page so we can
  // show client/title without relying on a PostgREST embedding.
  const meetingIds = [...new Set(docs.map((d) => d.meeting_id))]
  const meetingMap = new Map<string, { title: string | null; client_company: string | null }>()
  if (meetingIds.length) {
    const { data: meetingsData } = await supabase
      .from('meetings')
      .select('id, title, client_company')
      .in('id', meetingIds)
    for (const m of meetingsData ?? []) {
      meetingMap.set(m.id as string, {
        title: (m.title as string | null) ?? null,
        client_company: (m.client_company as string | null) ?? null,
      })
    }
  }

  const documents: DocumentRow[] = docs.map((d) => {
    const m = meetingMap.get(d.meeting_id)
    return {
      ...d,
      meetingTitle: m?.title ?? null,
      clientCompany: m?.client_company ?? null,
    }
  })

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="pm-page" style={{ padding: '28px 36px 32px' }}>
      <div className="mb-5">
        <h1 className="pm-h1">Documents</h1>
        <p className="text-[12.5px]" style={{ color: 'var(--ink-3)', marginTop: 4 }}>
          Every minute, summary, proposal, and notes document across all your meetings.
        </p>
      </div>

      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <FilterChip label="All" href="/documents" active={activeType === null} />
        {DOC_TYPES.map((t) => (
          <FilterChip
            key={t}
            label={DOC_TYPE_LABELS[t]}
            href={`/documents?type=${t}`}
            active={activeType === t}
          />
        ))}
      </div>

      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[13px] font-semibold" style={{ color: 'var(--ink-1)' }}>
          {activeType ? DOC_TYPE_LABELS[activeType] : 'All documents'}
        </div>
        {total > 0 && (
          <div className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
            {from + 1}–{Math.min(to + 1, total)} of {total}
          </div>
        )}
      </div>

      <DocumentsTable documents={documents} />

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} type={activeType} />
      )}
    </div>
  )
}

function FilterChip({
  label,
  href,
  active,
}: {
  label: string
  href: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-full text-[11.5px] px-3 py-1 border transition-colors',
        active ? 'font-medium' : 'hover:bg-white/55',
      )}
      style={{
        color: active ? 'var(--ink-1)' : 'var(--ink-2)',
        borderColor: active ? 'var(--accent-base)' : 'var(--line-1)',
        background: active ? 'var(--accent-tint, rgba(77,138,107,0.08))' : 'transparent',
      }}
    >
      {label}
    </Link>
  )
}

function Pagination({
  page,
  totalPages,
  type,
}: {
  page: number
  totalPages: number
  type: DocType | null
}) {
  const q = (p: number) =>
    type ? `/documents?type=${type}&page=${p}` : `/documents?page=${p}`
  const hasPrev = page > 1
  const hasNext = page < totalPages
  return (
    <div className="flex items-center justify-between mt-4">
      <PageLink href={q(page - 1)} disabled={!hasPrev} label="← Previous" />
      <div className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
        Page {page} of {totalPages}
      </div>
      <PageLink href={q(page + 1)} disabled={!hasNext} label="Next →" />
    </div>
  )
}

function PageLink({
  href,
  disabled,
  label,
}: {
  href: string
  disabled: boolean
  label: string
}) {
  const base = 'rounded-[7px] text-[12px] px-3 py-1.5 transition-colors border'
  if (disabled) {
    return (
      <span
        className={base}
        style={{
          color: 'var(--ink-3)',
          borderColor: 'var(--line-1)',
          opacity: 0.5,
          cursor: 'not-allowed',
        }}
      >
        {label}
      </span>
    )
  }
  return (
    <Link
      href={href}
      className={`${base} hover:bg-white/55`}
      style={{ color: 'var(--ink-1)', borderColor: 'var(--line-1)' }}
    >
      {label}
    </Link>
  )
}
