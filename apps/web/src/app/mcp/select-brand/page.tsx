import Link from 'next/link'
import { getAuthorizedMcpBrands } from '@/lib/mcp-oauth'
import { getServerUserId } from '@/lib/server-auth'

type SelectBrandPageProps = {
  searchParams?: Promise<{
    data?: string
  }>
}

export default async function SelectBrandPage({
  searchParams,
}: SelectBrandPageProps) {
  const userId = await getServerUserId()
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const data = resolvedSearchParams?.data

  if (!userId || !data) {
    return (
      <main className="min-h-screen bg-white px-6 py-16 text-gray-900">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-semibold">Authentication failed</h1>
          <p className="mt-3 text-sm text-gray-600">
            The MCP callback is missing required session or request data.
          </p>
        </div>
      </main>
    )
  }

  const brands = await getAuthorizedMcpBrands(userId)

  return (
    <main className="min-h-screen bg-white px-6 py-16 text-gray-900">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold">Choose a brand</h1>
        <p className="mt-3 text-sm text-gray-600">
          Your account belongs to more than one CustomerEQ organization. Select
          the brand Cursor should use for this MCP session.
        </p>

        <div className="mt-8 space-y-3">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              href={`/api/mcp/callback?data=${encodeURIComponent(data)}&brandId=${encodeURIComponent(brand.id)}`}
              className="block rounded border border-gray-200 px-4 py-3 hover:border-gray-400"
            >
              <div className="font-medium">{brand.organizationName}</div>
              <div className="mt-1 text-sm text-gray-600">{brand.name}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
