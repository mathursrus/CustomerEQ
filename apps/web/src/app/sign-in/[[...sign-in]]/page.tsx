import { SignIn } from '@clerk/nextjs'

type SignInPageProps = {
  searchParams?: Promise<{
    redirect_url?: string
    redirectUrl?: string
  }>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const redirectUrl =
    resolvedSearchParams?.redirect_url ?? resolvedSearchParams?.redirectUrl

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignIn
        forceRedirectUrl={redirectUrl}
        fallbackRedirectUrl="/admin/programs"
      />
    </div>
  )
}
