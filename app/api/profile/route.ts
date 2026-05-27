import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}

interface ProfilePatch {
  full_name?: string | null
  company_name?: string | null
  tagline?: string | null
  website?: string | null
  industry?: string | null
  voice_tones?: string[]
  tone_prompt?: string | null
  signature_name?: string | null
  signature_title?: string | null
  brand_colors?: string[]
  logo_url?: string | null
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as ProfilePatch

  const update: ProfilePatch = {}
  const allowed: (keyof ProfilePatch)[] = [
    'full_name',
    'company_name',
    'tagline',
    'website',
    'industry',
    'voice_tones',
    'tone_prompt',
    'signature_name',
    'signature_title',
    'brand_colors',
    'logo_url',
  ]
  for (const key of allowed) {
    if (key in body) {
      // @ts-expect-error narrowed by allowed list
      update[key] = body[key]
    }
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update(update)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}
