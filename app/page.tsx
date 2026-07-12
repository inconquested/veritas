import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import PortalAnimation from '@/components/portal/PortalAnimation'

export default async function Home() {
  const user = await currentUser()

  if(!user) {
    return <PortalAnimation />
  }

  const role = user.publicMetadata?.role
  if(!role) {
    redirect('/onboarding')
  }

  redirect(role === 'client' ? '/client/homepage' : '/freelancer/dashboard')
}
