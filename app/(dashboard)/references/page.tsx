'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Icon } from '@/components/ui/icon'
import { ReferenceCard } from '@/components/references/ReferenceCard'
import type { ReferenceProposal } from '@/types'

interface ProposalOption {
  proposalId: string
  label: string
}

const ACCEPT = '.pdf,.docx,.txt,.md,.markdown,.pptx'
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const DECK_BUCKET = 'reference-decks'

// Upload size limits.
const PPTX_MAX_BYTES = 25 * 1024 * 1024 // reference-decks bucket file_size_limit
const FILE_MAX_BYTES = 4.5 * 1024 * 1024 // non-pptx go via the API — Vercel's ~4.5MB body cap

function isPptx(file: File): boolean {
  return file.type === PPTX_MIME || /\.pptx$/i.test(file.name)
}

export default function ReferencesPage() {
  const supabase = React.useMemo(() => createClient(), [])
  const [refs, setRefs] = React.useState<ReferenceProposal[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const [title, setTitle] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [mode, setMode] = React.useState<'file' | 'paste'>('file')
  const [pasted, setPasted] = React.useState('')
  const fileRef = React.useRef<HTMLInputElement>(null)

  const [proposalOptions, setProposalOptions] = React.useState<ProposalOption[]>([])
  const [selectedProposal, setSelectedProposal] = React.useState('')

  const refresh = React.useCallback(async () => {
    const res = await fetch('/api/reference-proposals')
    if (res.ok) setRefs((await res.json()) as ReferenceProposal[])
    setLoading(false)
  }, [])

  const loadProposals = React.useCallback(async () => {
    const { data } = await supabase
      .from('meeting_documents')
      .select('id, created_at, meetings(title, client_company)')
      .eq('doc_type', 'proposal')
      .order('created_at', { ascending: false })
    type MeetingRel = { title?: string; client_company?: string | null }
    const opts: ProposalOption[] = (data ?? []).map((row: Record<string, unknown>) => {
      const rel = row.meetings as MeetingRel | MeetingRel[] | null
      const m = Array.isArray(rel) ? rel[0] : rel
      const meetingTitle = m?.title || 'Untitled meeting'
      const company = m?.client_company || undefined
      return {
        proposalId: row.id as string,
        label: company ? `${company} · ${meetingTitle}` : meetingTitle,
      }
    })
    setProposalOptions(opts)
  }, [supabase])

  React.useEffect(() => {
    void refresh()
    void loadProposals()
  }, [refresh, loadProposals])

  function resetForm() {
    setTitle('')
    setCategory('')
    setPasted('')
    if (fileRef.current) fileRef.current.value = ''
  }

  // .pptx style templates can be large; upload them straight to Storage from the
  // browser (the API's multipart route hits Vercel's ~4.5MB body limit), then
  // register the stored file as JSON.
  async function uploadPptxTemplate(file: File) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Please sign in again.')
    const path = `${user.id}/${crypto.randomUUID()}.pptx`

    const { error: upErr } = await supabase.storage
      .from(DECK_BUCKET)
      .upload(path, file, { contentType: PPTX_MIME, upsert: false })
    if (upErr) throw new Error(upErr.message || 'Could not upload the PowerPoint.')

    const res = await fetch('/api/reference-proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        category: category.trim() || null,
        file_path: path,
        original_filename: file.name,
      }),
    })
    if (!res.ok) {
      // Clean up the orphaned object so a failed registration leaves nothing behind.
      await supabase.storage.from(DECK_BUCKET).remove([path]).catch(() => {})
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? 'Could not save the template.')
    }
  }

  async function submitUpload(file?: File) {
    if (!title.trim()) {
      toast.error('Give the reference a title first.')
      return
    }
    if (!file && !pasted.trim()) {
      toast.error('Choose a file or paste the proposal text.')
      return
    }

    if (file) {
      const pptx = isPptx(file)
      const max = pptx ? PPTX_MAX_BYTES : FILE_MAX_BYTES
      if (file.size > max) {
        const limitMb = (max / 1024 / 1024).toFixed(max % (1024 * 1024) ? 1 : 0)
        toast.error(
          `${pptx ? 'PowerPoint templates' : 'PDF/DOCX/text files'} must be under ${limitMb} MB — ` +
            `this one is ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
        )
        return
      }
    }

    setBusy(true)
    try {
      if (file && isPptx(file)) {
        await uploadPptxTemplate(file)
      } else {
        const form = new FormData()
        form.append('title', title)
        if (category.trim()) form.append('category', category)
        if (file) form.append('file', file)
        else form.append('pasted_text', pasted)
        const res = await fetch('/api/reference-proposals', { method: 'POST', body: form })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      }
      toast.success('Reference saved.')
      resetForm()
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  async function importProposal() {
    if (!selectedProposal) return
    const opt = proposalOptions.find((o) => o.proposalId === selectedProposal)
    setBusy(true)
    try {
      const res = await fetch('/api/reference-proposals/from-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: selectedProposal, title: opt?.label ?? 'Past proposal' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      toast.success('Proposal added as a reference.')
      setSelectedProposal('')
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/reference-proposals/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error('Delete failed')
      setRefs((prev) => prev.filter((r) => r.id !== id))
    } catch {
      toast.error('Could not delete that reference.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="pm-page" style={{ padding: '28px 36px 32px' }}>
      <div className="pm-eyebrow">Library</div>
      <h1 className="pm-h1" style={{ marginBottom: 6 }}>
        Reference proposals
      </h1>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 22, maxWidth: 640 }}>
        Add past proposals so the agent can echo the structure, tone, and pricing approach of similar
        projects when drafting new ones. Each one is summarized on save — line items still come only from
        your catalog.
      </p>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1.3fr' }}>
        {/* Add column */}
        <div className="flex flex-col gap-3.5">
          <div className="card p-5">
            <div className="text-[13px] font-semibold mb-3" style={{ color: 'var(--ink-1)' }}>
              Add a reference
            </div>

            <label className="block">
              <span className="block text-[11px] font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>
                Title
              </span>
              <input
                className="field"
                style={{ height: 36, fontSize: 13 }}
                placeholder="e.g. Acme Coffee — brand refresh"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            <label className="block mt-3">
              <span className="block text-[11px] font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>
                Category (optional)
              </span>
              <input
                className="field"
                style={{ height: 36, fontSize: 13 }}
                placeholder="Branding, Web, Consulting…"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </label>

            <div className="flex gap-1.5 mt-3.5">
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
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="w-full flex flex-col items-center justify-center text-center disabled:opacity-50"
                  style={{
                    padding: '20px 12px',
                    borderRadius: 10,
                    border: '1px dashed var(--line-1)',
                    background: 'rgba(255,255,255,0.4)',
                  }}
                >
                  <Icon name="download" size={16} />
                  <div className="text-[12.5px] font-medium mt-1.5" style={{ color: 'var(--ink-1)' }}>
                    {busy ? 'Processing…' : 'Choose a file'}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                    PDF, DOCX, TXT, MD (up to 4.5 MB) · .PPTX template (up to 25 MB)
                  </div>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPT}
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void submitUpload(f)
                  }}
                />
              </div>
            ) : (
              <div className="mt-3">
                <textarea
                  className="field"
                  style={{ minHeight: 120, fontSize: 12.5, padding: 10, resize: 'vertical' }}
                  placeholder="Paste the full proposal text…"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => void submitUpload()}
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-2 text-white font-medium mt-2.5 disabled:opacity-60"
                  style={{
                    height: 38,
                    fontSize: 13,
                    borderRadius: 9,
                    background: 'linear-gradient(180deg, var(--accent-2) 0%, var(--accent-base) 100%)',
                    border: '0.5px solid rgba(77,138,107,0.6)',
                  }}
                >
                  {busy ? 'Saving…' : 'Save reference'}
                </button>
              </div>
            )}
          </div>

          {proposalOptions.length > 0 && (
            <div className="card p-5">
              <div className="text-[13px] font-semibold mb-1" style={{ color: 'var(--ink-1)' }}>
                Reuse a PropMaker proposal
              </div>
              <p className="text-[11.5px] mb-3" style={{ color: 'var(--ink-2)' }}>
                Pull a proposal you already generated into your reference library.
              </p>
              <select
                className="field"
                style={{ height: 36, fontSize: 12.5 }}
                value={selectedProposal}
                onChange={(e) => setSelectedProposal(e.target.value)}
              >
                <option value="">Select a proposal…</option>
                {proposalOptions.map((o) => (
                  <option key={o.proposalId} value={o.proposalId}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void importProposal()}
                disabled={busy || !selectedProposal}
                className="w-full inline-flex items-center justify-center gap-1.5 font-medium mt-2.5 disabled:opacity-50"
                style={{
                  height: 34,
                  fontSize: 12.5,
                  borderRadius: 8,
                  color: 'var(--ink-1)',
                  background: 'rgba(255,255,255,0.6)',
                  border: '0.5px solid rgba(28,24,20,0.10)',
                }}
              >
                <Icon name="plus" size={12} />
                Add as reference
              </button>
            </div>
          )}
        </div>

        {/* Library column */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="text-[13px] font-semibold" style={{ color: 'var(--ink-1)' }}>
              Your library
            </div>
            <span className="mono-num" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              {refs.length}
            </span>
          </div>

          {loading ? (
            <div className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
              Loading…
            </div>
          ) : refs.length === 0 ? (
            <div
              className="card flex flex-col items-center justify-center text-center"
              style={{ padding: '40px 20px' }}
            >
              <Icon name="archive" size={20} />
              <div className="text-[12.5px] font-medium mt-2" style={{ color: 'var(--ink-1)' }}>
                No references yet
              </div>
              <div className="text-[11.5px] mt-1" style={{ color: 'var(--ink-3)' }}>
                Upload a past proposal or reuse one you generated here.
              </div>
            </div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {refs.map((r) => (
                <ReferenceCard
                  key={r.id}
                  reference={r}
                  onDelete={remove}
                  deleting={deletingId === r.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
