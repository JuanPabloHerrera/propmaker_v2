import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Legacy route — the proposal editor now lives at /meetings/[id]/documents/[docId].
 * Old bookmarks land on the meeting's most recent proposal document, or the
 * documents hub when none exists yet.
 */
export default async function LegacyProposalPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: doc } = await supabase
    .from('meeting_documents')
    .select('id')
    .eq('meeting_id', id)
    .eq('user_id', user.id)
    .eq('doc_type', 'proposal')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  redirect(doc ? `/meetings/${id}/documents/${doc.id}` : `/meetings/${id}/documents`)
}
