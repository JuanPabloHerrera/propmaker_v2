'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { ProposalThumbnail } from '@/components/share/ProposalThumbnail'
import { ShareLinkCard } from '@/components/share/ShareLinkCard'
import { RecipientsCard } from '@/components/share/RecipientsCard'
import { ExportActions } from '@/components/share/ExportActions'
import { Icon } from '@/components/ui/icon'
import { Skeleton } from '@/components/ui/skeleton'
import type { Meeting, Proposal, UserProfile } from '@/types'

export default function SharePage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [meeting, setMeeting] = React.useState<Meeting | null>(null)
  const [proposal, setProposal] = React.useState<Proposal | null>(null)
  const [profile, setProfile] = React.useState<UserProfile | null>(null)
  const [message, setMessage] = React.useState('')
  const [creatingLink, setCreatingLink] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [origin, setOrigin] = React.useState('')

  React.useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  React.useEffect(() => {
    ;(async () => {
      const [meetingRes, propRes, profileRes] = await Promise.all([
        supabase.from('meetings').select('*').eq('id', id).single(),
        supabase.from('proposals').select('*').eq('meeting_id', id).maybeSingle(),
        supabase.from('user_profiles').select('*').single(),
      ])
      if (meetingRes.data) setMeeting(meetingRes.data as Meeting)
      if (propRes.data) setProposal(propRes.data as Proposal)
      if (profileRes.data) setProfile(profileRes.data as UserProfile)
      if (propRes.data && !message) {
        const name = (profileRes.data as UserProfile | null)?.signature_name?.split(' ')[0] ?? ''
        setMessage(
          `Hi — really enjoyed today's call. Here's everything we discussed, plus the proposal we sketched together. Yell with questions.${name ? `\n— ${name}` : ''}`,
        )
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function createOrFetchLink() {
    if (!proposal) return
    setCreatingLink(true)
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: [], message: null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create link')
      setProposal((p) => (p ? { ...p, public_slug: data.slug } : p))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCreatingLink(false)
    }
  }

  async function send() {
    if (!proposal || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: meeting?.attendees ?? [],
          message,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send')
      if (data.slug && !proposal.public_slug) {
        setProposal((p) => (p ? { ...p, public_slug: data.slug } : p))
      }
      toast.success(
        `Recipients notified (preview mode) — ${data.sent ?? 0} share${data.sent === 1 ? '' : 's'} logged.`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSending(false)
    }
  }

  if (!meeting || !proposal) {
    return (
      <div className="pm-page lg-shell" style={{ padding: '28px 36px 32px' }}>
        <Skeleton style={{ height: 28, width: 280, marginBottom: 22 }} />
        <div className="grid grid-cols-[1fr_1fr] gap-5">
          <Skeleton style={{ height: 420, width: '100%', borderRadius: 14 }} />
          <div className="flex flex-col gap-3.5">
            <Skeleton style={{ height: 110, width: '100%', borderRadius: 12 }} />
            <Skeleton style={{ height: 140, width: '100%', borderRadius: 12 }} />
            <Skeleton style={{ height: 80, width: '100%', borderRadius: 12 }} />
          </div>
        </div>
      </div>
    )
  }

  const recipientNames =
    meeting.attendees?.map((a) => a.name).filter(Boolean).join(' & ') ?? ''
  const shareUrl = proposal.public_slug ? `${origin}/p/${proposal.public_slug}` : null

  return (
    <div className="pm-page" style={{ padding: '28px 36px 32px' }}>
      <Link
        href={`/meetings/${id}/proposal`}
        className="inline-flex items-center gap-1 mb-3"
        style={{ fontSize: 12.5, color: 'var(--ink-3)' }}
      >
        <Icon name="chevL" size={12} />
        Back to proposal
      </Link>

      <div className="pm-eyebrow">Ready to send</div>
      <h1 className="pm-h1" style={{ marginBottom: 22 }}>
        Send proposal{meeting.client_company ? ` to ${meeting.client_company}.` : '.'}
      </h1>

      <div className="grid gap-5" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
        <div className="pt-2">
          <ProposalThumbnail
            title={meeting.client_company || meeting.title}
            recipientNames={recipientNames}
            preparedBy={profile?.company_name ?? profile?.full_name ?? 'PropMaker'}
          />
        </div>

        <div className="flex flex-col gap-3.5">
          <ShareLinkCard
            shareUrl={shareUrl}
            onCreateLink={createOrFetchLink}
            creating={creatingLink}
            openCount={proposal.open_count ?? 0}
            firstOpenedAt={proposal.first_opened_at ?? null}
          />
          <RecipientsCard attendees={meeting.attendees ?? []} />
          <ExportActions
            meetingId={id}
            onSend={send}
            sending={sending}
            proposalSlug={proposal.public_slug}
          />
        </div>
      </div>

      <div className="card p-[18px] mt-5">
        <div className="text-[13px] font-semibold mb-3" style={{ color: 'var(--ink-1)' }}>
          Message
        </div>
        <textarea
          className="field"
          style={{ minHeight: 90, padding: '8px 11px' }}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Optional note to attach with the link."
        />
      </div>
    </div>
  )
}
