import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import PortalAnimation from '@/components/portal/PortalAnimation'

export default async function Home() {
  const user = await currentUser()

  if(!user) {
    return <PortalAnimation />
  }

  // F7 wave integrasi: role HANYA dari privateMetadata (server-only).
  // Akun lama yang masih simpan role di publicMetadata wajib re-onboarding
  // (lihat docs/OPERATIONS.md § backfill) — spoof publik = onboarding ulang.
  const role = user.privateMetadata?.role
  if(!role) {
    redirect('/onboarding')
  }

  redirect(role === 'client' ? '/client/homepage' : '/freelancer/dashboard')
}
