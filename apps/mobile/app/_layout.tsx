import '../global.css'
import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Slot, useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

// In-memory cache — no native dependencies, works in Expo Go and production.
// For production builds, swap this out for expo-secure-store.
const _tokenStore = new Map<string, string>()
const tokenCache = {
  async getToken(key: string) { return _tokenStore.get(key) ?? null },
  async saveToken(key: string, value: string) { _tokenStore.set(key, value) },
}

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  useEffect(() => {
    if (!isLoaded) return
    const inAuth = segments[0] === '(auth)'
    if (!isSignedIn && !inAuth) router.replace('/(auth)/sign-in')
    else if (isSignedIn && inAuth) router.replace('/(tabs)')
  }, [isLoaded, isSignedIn, segments])
  return <>{children}</>
}

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <AuthGate>
            <Slot />
          </AuthGate>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ClerkProvider>
  )
}
