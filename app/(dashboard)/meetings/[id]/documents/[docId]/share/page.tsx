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
import { DOC_TYPE_LABELS, type Meeting, type MeetingDocument, type UserProfile } from '@/types'

export default function SharePage() {
  const { id, docId } = useParams<{ id: string; docId: string }>()
  const supabase = createClient()

  const [meeting, setMeeting] = React.useState<Meeting | null>(null)
  const [doc, setDoc] = React.useState<MeetingDocument | null>(null)
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
      // Filter the profile by user_id — the public-read RLS policy on
      // user_profiles can otherwise return multiple rows and 406 under .single().
      const { data: { user } } = await supabase.auth.getUser()
      const [meetingRes, docRes, profileRes] = await Promise.all([
        supabase.from('meetings').select('*').eq('id', id).single(),
        supabase.from('meeting_documents').select('*').eq('id', docId).maybeSingle(),
        user
          ? supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      if (meetingRes.data) setMeeting(meetingRes.data as Meeting)
      if (docRes.data) setDoc(docRes.data as MeetingDocument)
      if (profileRes.data) setProfile(profileRes.data as UserProfile)
      if (docRes.data && !message) {
        const name = (profileRes.data as UserProfile | null)?.signature_name?.split(' ')[0] ?? ''
        setMessage(
          `Hi — really enjoyed today's call. Here's everything we discussed, plus the document we sketched together. Yell with questions.${name ? `\n— ${name}` : ''}`,
        )
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, docId])

  async function createOrFetchLink() {
    if (!doc) return
    setCreatingLink(true)
    try {
      const res = await fetch(`/api/documents/${doc.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: [], message: null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create link')
      setDoc((p) => (p ? { ...p, public_slug: data.slug } : p))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCreatingLink(false)
    }
  }

  async function send() {
    if (!doc || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/documents/${doc.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: meeting?.attendees ?? [],
          message,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send')
      if (data.slug && !doc.public_slug) {
        setDoc((p) => (p ? { ...p, public_slug: data.slug } : p))
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

  if (!meeting || !doc) {
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
  const shareUrl = doc.public_slug ? `${origin}/p/${doc.public_slug}` : null
  const typeLabel = DOC_TYPE_LABELS[doc.doc_type].toLowerCase()

  return (
    <div className="pm-page" style={{ padding: '28px 36px 32px' }}>
      <Link
        href={`/meetings/${id}/documents/${docId}`}
        className="inline-flex items-center gap-1 mb-3"
        style={{ fontSize: 12.5, color: 'var(--ink-3)' }}
      >
        <Icon name="chevL" size={12} />
        Back to document
      </Link>

      <div className="pm-eyebrow">Ready to send</div>
      <h1 className="pm-h1" style={{ marginBottom: 22 }}>
        Send {typeLabel}
        {meeting.client_company ? ` to ${meeting.client_company}.` : '.'}
      </h1>

      <div className="grid gap-5" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
        <div className="pt-2">
          <ProposalThumbnail
            title={doc.title || meeting.client_company || meeting.title}
            recipientNames={recipientNames}
            preparedBy={profile?.company_name ?? profile?.full_name ?? 'PropMaker'}
          />
        </div>

        <div className="flex flex-col gap-3.5">
          <ShareLinkCard
            shareUrl={shareUrl}
            onCreateLink={createOrFetchLink}
            creating={creatingLink}
            openCount={doc.open_count ?? 0}
            firstOpenedAt={doc.first_opened_at ?? null}
          />
          <RecipientsCard attendees={meeting.attendees ?? []} />
          <ExportActions
            meetingId={id}
            onSend={send}
            sending={sending}
            proposalSlug={doc.public_slug}
            proposalId={doc.id}
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
