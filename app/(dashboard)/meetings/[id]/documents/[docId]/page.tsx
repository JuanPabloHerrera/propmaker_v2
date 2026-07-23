'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { OutlineSidebar, type OutlineSection } from '@/components/proposal/OutlineSidebar'
import { ProposalToolbar } from '@/components/proposal/ProposalToolbar'
import { ProposalEditor } from '@/components/proposal/ProposalEditor'
import { SignatureBlock } from '@/components/proposal/SignatureBlock'
import { TranscriptDrawer } from '@/components/proposal/TranscriptDrawer'
import { FloatingRefineChat } from '@/components/documents/FloatingRefineChat'
import { Skeleton } from '@/components/ui/skeleton'
import { brandStyleBlock } from '@/lib/brand'
import type { Meeting, MeetingDocument, UserProfile } from '@/types'

export default function DocumentPage() {
  const { id, docId } = useParams<{ id: string; docId: string }>()
  const supabase = createClient()

  const [meeting, setMeeting] = React.useState<Meeting | null>(null)
  const [doc, setDoc] = React.useState<MeetingDocument | null>(null)
  const [profile, setProfile] = React.useState<UserProfile | null>(null)
  const [email, setEmail] = React.useState<string>('')
  const [sections, setSections] = React.useState<OutlineSection[]>([])
  const [activeSection, setActiveSection] = React.useState<string | null>(null)
  const [savedAgo, setSavedAgo] = React.useState<string>('just now')
  const [statusBusy, setStatusBusy] = React.useState(false)
  const [transcriptOpen, setTranscriptOpen] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    // Get the user first so the profile query can filter by user_id — the
    // public-read RLS policy on user_profiles (for shared documents) makes an
    // unfiltered select return multiple rows, which 406s under .single().
    const { data: { user } } = await supabase.auth.getUser()
    const [meetingRes, docRes, profileRes] = await Promise.all([
      supabase.from('meetings').select('*').eq('id', id).single(),
      fetch(`/api/documents/${docId}`).then((r) => (r.ok ? r.json() : null)),
      user
        ? supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    if (meetingRes.data) setMeeting(meetingRes.data as Meeting)
    if (docRes) setDoc(docRes as MeetingDocument)
    if (profileRes.data) setProfile(profileRes.data as UserProfile)
    if (user?.email) setEmail(user.email)
  }, [id, docId, supabase])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Light "saved Xs ago" indicator
  React.useEffect(() => {
    const t = setInterval(() => {
      if (doc?.updated_at) {
        const secs = Math.round(
          (Date.now() - new Date(doc.updated_at).getTime()) / 1000,
        )
        if (secs < 60) setSavedAgo(`${secs}s ago`)
        else setSavedAgo(`${Math.round(secs / 60)} min ago`)
      }
    }, 5000)
    return () => clearInterval(t)
  }, [doc?.updated_at])

  function jumpTo(sectionId: string) {
    const el = document.getElementById(sectionId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveSection(sectionId)
    }
  }

  async function toggleStatus() {
    if (!doc || statusBusy) return
    const prev = doc.status
    const next = prev === 'final' ? 'draft' : 'final'
    setStatusBusy(true)
    // Optimistic: flip the pill immediately so the user gets instant
    // feedback. Revert on API failure.
    setDoc((p) => (p ? { ...p, status: next } : p))
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update status')
      // Bump the meeting's deal_status when finalizing a proposal so the
      // dashboard reflects it without a separate Share step.
      if (next === 'final' && doc.doc_type === 'proposal') {
        await fetch(`/api/meetings/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deal_status: 'proposal_sent' }),
        }).catch(() => {})
      }
      toast.success(next === 'final' ? 'Marked as final.' : 'Reopened as draft.')
    } catch (err) {
      // Revert the optimistic change.
      setDoc((p) => (p ? { ...p, status: prev } : p))
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setStatusBusy(false)
    }
  }

  if (!meeting || !doc) {
    return <DocumentPageSkeleton />
  }

  const docTitle = doc.title || meeting.client_company || meeting.title

  return (
    <div className="flex h-screen lg-shell">
      <OutlineSidebar
        sections={sections}
        activeId={activeSection}
        onJump={jumpTo}
        status={doc.status === 'final' ? 'Final · published' : 'Draft · auto-saved'}
        savedAgo={savedAgo}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <ProposalToolbar
          meetingId={id}
          title={docTitle}
          proposal={doc}
          onViewTranscript={() => setTranscriptOpen(true)}
          onToggleStatus={toggleStatus}
          statusBusy={statusBusy}
        />

        <div className="flex-1 min-h-0 overflow-auto" style={{ padding: '32px 0' }}>
          {(() => {
            const css = brandStyleBlock(profile?.brand_colors)
            return css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null
          })()}
          <div className="proposal-paper">
            <ProposalEditor
              documentId={docId}
              initialJson={doc.content_json ?? null}
              onSectionsChange={setSections}
            />
            {doc.doc_type === 'proposal' && (profile?.signature_name || email) && (
              <SignatureBlock
                signatureName={profile?.signature_name ?? profile?.full_name ?? ''}
                signatureTitle={profile?.signature_title ?? ''}
                email={email}
                companyName={profile?.company_name}
                logoUrl={profile?.logo_url ?? null}
                status={doc.status ?? 'draft'}
              />
            )}
          </div>
        </div>
      </div>

      <FloatingRefineChat documentId={docId} onApplied={fetchData} />

      <TranscriptDrawer
        open={transcriptOpen}
        onClose={() => setTranscriptOpen(false)}
        meetingId={id}
      />
    </div>
  )
}

function DocumentPageSkeleton() {
  return (
    <div className="flex h-screen lg-shell">
      <div
        className="shrink-0 hidden md:block"
        style={{
          width: 240,
          padding: '24px 16px',
          borderRight: '0.5px solid var(--line-1)',
        }}
        aria-hidden="true"
      >
        <Skeleton style={{ height: 12, width: 80, marginBottom: 16 }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton
            key={i}
            style={{ height: 10, width: `${50 + ((i * 17) % 40)}%`, marginBottom: 12 }}
          />
        ))}
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <div
          className="flex items-center gap-3"
          style={{ padding: '12px 18px', borderBottom: '0.5px solid var(--line-1)' }}
        >
          <Skeleton style={{ height: 14, width: 180 }} />
          <div className="flex-1" />
          <Skeleton style={{ height: 28, width: 90, borderRadius: 7 }} />
          <Skeleton style={{ height: 28, width: 90, borderRadius: 7 }} />
        </div>
        <div className="flex-1 min-h-0 overflow-hidden" style={{ padding: '32px 0' }}>
          <div className="proposal-paper">
            <Skeleton style={{ height: 24, width: '60%', marginBottom: 18 }} />
            <Skeleton style={{ height: 14, width: '100%', marginBottom: 10 }} />
            <Skeleton style={{ height: 14, width: '92%', marginBottom: 10 }} />
            <Skeleton style={{ height: 14, width: '88%', marginBottom: 24 }} />
            <Skeleton style={{ height: 18, width: '40%', marginBottom: 14 }} />
            <Skeleton style={{ height: 14, width: '100%', marginBottom: 10 }} />
            <Skeleton style={{ height: 14, width: '95%', marginBottom: 10 }} />
            <Skeleton style={{ height: 14, width: '70%' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
