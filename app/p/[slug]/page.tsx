import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProposalEditor } from '@/components/proposal/ProposalEditor'
import { SignatureBlock } from '@/components/proposal/SignatureBlock'
import { AutoPrint } from '@/components/proposal/AutoPrint'
import type { Proposal, UserProfile, Meeting } from '@/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function PublicProposalPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()

  // The "Public read shared proposals" RLS policy permits unauthenticated reads
  // when public_slug is set, so this works without a session.
  const { data: proposal } = await supabase
    .from('proposals')
    .select('*')
    .eq('public_slug', slug)
    .maybeSingle()

  if (!proposal) notFound()

  const p = proposal as Proposal

  // Look up the meeting + profile via service-role-equivalent fetches.
  // Since we only have anon access here and the profile/meeting tables aren't
  // public, we render with minimal info. The proposal content itself carries
  // the doc; signature is best-effort.
  let signatureName = ''
  let signatureTitle = ''
  let companyName: string | null = null
  let logoUrl: string | null = null
  let title = 'Proposal'

  // The "Public read profiles of users with shared proposals" RLS policy
  // (migration 006) lets anon clients read signature + brand fields for
  // any user who has at least one proposal with a public_slug. The
  // meeting read is best-effort and silently degrades if RLS blocks.
  try {
    const meetingRes = await supabase
      .from('meetings')
      .select('title, client_company')
      .eq('id', p.meeting_id)
      .maybeSingle()
    if (meetingRes.data) {
      const m = meetingRes.data as Pick<Meeting, 'title' | 'client_company'>
      title = m.client_company || m.title || 'Proposal'
    }

    const profileRes = await supabase
      .from('user_profiles')
      .select('signature_name, signature_title, company_name, full_name, logo_url')
      .eq('user_id', p.user_id)
      .maybeSingle()
    if (profileRes.data) {
      const prof = profileRes.data as Pick<
        UserProfile,
        'signature_name' | 'signature_title' | 'company_name' | 'full_name' | 'logo_url'
      >
      signatureName = prof.signature_name ?? prof.full_name ?? ''
      signatureTitle = prof.signature_title ?? ''
      companyName = prof.company_name ?? null
      logoUrl = prof.logo_url ?? null
    }
  } catch {
    // ignore — render proposal without surrounding metadata
  }

  return (
    <div className="min-h-screen lg-shell" style={{ padding: '32px 0' }}>
      <AutoPrint />
      <div className="proposal-paper">
        <ProposalEditor
          meetingId={p.meeting_id}
          initialJson={p.content_json ?? null}
          readOnly
        />
        {(signatureName || companyName || logoUrl) && (
          <SignatureBlock
            signatureName={signatureName}
            signatureTitle={signatureTitle}
            email=""
            companyName={companyName}
            logoUrl={logoUrl}
            status={p.status}
          />
        )}
        <div
          className="mt-8 pm-no-print"
          style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center' }}
        >
          Powered by PropMaker · {title}
        </div>
      </div>
    </div>
  )
}
