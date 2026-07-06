import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const DECK_BUCKET = 'reference-decks'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Look up the row first so we can clean up a stored template deck, if any.
  const { data: row } = await supabase
    .from('reference_proposals')
    .select('file_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  const { error } = await supabase
    .from('reference_proposals')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (row?.file_path) {
    await supabase.storage.from(DECK_BUCKET).remove([row.file_path]).catch(() => {})
  }
  return new NextResponse(null, { status: 204 })
}
