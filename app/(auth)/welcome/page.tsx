import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingHero } from '@/components/onboarding/OnboardingHero'

export default async function WelcomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  // If already onboarded, send to dashboard.
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarded_at, company_name, signature_name')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profile?.onboarded_at) redirect('/')

  // Check whether the user already has products (for the "Done" checkmark).
  const { count: productCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const hasProfile = !!(profile?.company_name || profile?.signature_name)
  const hasProducts = (productCount ?? 0) > 0

  return <OnboardingHero hasProfile={hasProfile} hasProducts={hasProducts} />
}
