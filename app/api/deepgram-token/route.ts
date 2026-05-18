import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.DEEPGRAM_API_KEY
  if (!key) return NextResponse.json({ error: 'Deepgram not configured' }, { status: 503 })

  return NextResponse.json({ key })
}
