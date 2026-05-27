'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { OutlineSidebar, type OutlineSection } from '@/components/proposal/OutlineSidebar'
import { ProposalToolbar } from '@/components/proposal/ProposalToolbar'
import { ProposalEditor } from '@/components/proposal/ProposalEditor'
import { SignatureBlock } from '@/components/proposal/SignatureBlock'
import type { Meeting, Proposal, UserProfile } from '@/types'

export default function ProposalPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [meeting, setMeeting] = React.useState<Meeting | null>(null)
  const [proposal, setProposal] = React.useState<Proposal | null>(null)
  const [profile, setProfile] = React.useState<UserProfile | null>(null)
  const [email, setEmail] = React.useState<string>('')
  const [sections, setSections] = React.useState<OutlineSection[]>([])
  const [activeSection, setActiveSection] = React.useState<string | null>(null)
  const [mode, setMode] = React.useState<'edit' | 'preview'>('edit')
  const [savedAgo, setSavedAgo] = React.useState<string>('just now')
  const [statusBusy, setStatusBusy] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    const [meetingRes, proposalRes, profileRes, userRes] = await Promise.all([
      supabase.from('meetings').select('*').eq('id', id).single(),
      fetch(`/api/meetings/${id}/proposal`).then((r) => r.json()),
      supabase.from('user_profiles').select('*').single(),
      supabase.auth.getUser(),
    ])
    if (meetingRes.data) setMeeting(meetingRes.data as Meeting)
    if (proposalRes) setProposal(proposalRes as Proposal)
    if (profileRes.data) setProfile(profileRes.data as UserProfile)
    if (userRes.data.user?.email) setEmail(userRes.data.user.email)
  }, [id, supabase])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Light "saved Xs ago" indicator
  React.useEffect(() => {
    const t = setInterval(() => {
      if (proposal?.updated_at) {
        const secs = Math.round(
          (Date.now() - new Date(proposal.updated_at).getTime()) / 1000,
        )
        if (secs < 60) setSavedAgo(`${secs}s ago`)
        else setSavedAgo(`${Math.round(secs / 60)} min ago`)
      }
    }, 5000)
    return () => clearInterval(t)
  }, [proposal?.updated_at])

  function jumpTo(sectionId: string) {
    const el = document.getElementById(sectionId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveSection(sectionId)
    }
  }

  async function toggleStatus() {
    if (!proposal || statusBusy) return
    const next = proposal.status === 'final' ? 'draft' : 'final'
    setStatusBusy(true)
    try {
      const res = await fetch(`/api/meetings/${id}/proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update status')
      setProposal((p) => (p ? { ...p, status: next } : p))
      // Bump the meeting's deal_status when finalizing so the dashboard's
      // recent-meetings table reflects it without a separate Share step.
      if (next === 'final') {
        await fetch(`/api/meetings/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deal_status: 'proposal_sent' }),
        }).catch(() => {})
      }
      toast.success(next === 'final' ? 'Proposal marked as final.' : 'Reopened as draft.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setStatusBusy(false)
    }
  }

  async function printPDF() {
    if (!proposal) return
    // Open the window inside the click gesture so popup blockers don't kill it;
    // navigate it once we have a slug to use.
    const w = window.open('about:blank', '_blank')
    if (!w) {
      toast.error('Allow popups for PropMaker to export PDF.')
      return
    }
    let slug = proposal.public_slug
    if (!slug) {
      try {
        const res = await fetch(`/api/proposals/${proposal.id}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipients: [], message: null }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to prepare PDF')
        slug = data.slug
        setProposal((p) => (p ? { ...p, public_slug: slug } : p))
      } catch (err) {
        w.close()
        toast.error(err instanceof Error ? err.message : 'Failed to prepare PDF')
        return
      }
    }
    w.location.href = `/p/${slug}?print=1`
  }

  if (!meeting) {
    return (
      <div className="flex-1 flex items-center justify-center lg-shell">
        <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Loading…</p>
      </div>
    )
  }

  const docTitle = meeting.client_company
    ? `${meeting.client_company}`
    : meeting.title

  return (
    <div className="flex h-screen lg-shell">
      <OutlineSidebar
        sections={sections}
        activeId={activeSection}
        onJump={jumpTo}
        status={proposal?.status === 'final' ? 'Final · published' : 'Draft · auto-saved'}
        savedAgo={savedAgo}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <ProposalToolbar
          meetingId={id}
          title={docTitle}
          proposal={proposal}
          mode={mode}
          onModeChange={setMode}
          onPrint={printPDF}
          onRefine={() => toast.info('Refine flow coming soon.')}
          onToggleStatus={toggleStatus}
          statusBusy={statusBusy}
        />

        <div className="flex-1 min-h-0 overflow-auto" style={{ padding: '32px 0' }}>
          <div className="proposal-paper">
            <ProposalEditor
              meetingId={id}
              initialJson={proposal?.content_json ?? null}
              onSectionsChange={setSections}
              readOnly={mode === 'preview'}
            />
            {(profile?.signature_name || email) && (
              <SignatureBlock
                signatureName={profile?.signature_name ?? profile?.full_name ?? ''}
                signatureTitle={profile?.signature_title ?? ''}
                email={email}
                companyName={profile?.company_name}
                logoUrl={profile?.logo_url ?? null}
                status={proposal?.status ?? 'draft'}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
