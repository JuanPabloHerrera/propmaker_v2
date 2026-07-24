import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from './ProfileForm'
import type { UserProfile } from '@/types'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  // Profile row is created by the auth trigger; this fallback only covers
  // the rare case where the trigger hasn't run yet.
  const safe: UserProfile = profile ?? {
    user_id: user.id,
    full_name: null,
    company_name: null,
    tagline: null,
    website: null,
    industry: null,
    voice_tones: [],
    tone_prompt: null,
    signature_name: null,
    signature_title: null,
    brand_colors: [],
    onboarded_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  return <ProfileForm profile={safe} email={user.email ?? ''} />
}
