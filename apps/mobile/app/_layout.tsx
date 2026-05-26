import '../global.css'
import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Slot, useRouter, useSegments } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as SecureStore from 'expo-secure-store'

const tokenCache = {
  async getToken(key: string) { return SecureStore.getItemAsync(key) },
  async saveToken(key: string, value: string) { return SecureStore.setItemAsync(key, value) },
  async clearToken(key: string) { return SecureStore.deleteItemAsync(key) },
}

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })

const DEV_BYPASS = process.env.EXPO_PUBLIC_DEV_BYPASS_AUTH?.trim() === 'true'
const CLERK_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''
const CLERK_KEY_HINT = CLERK_KEY.length > 0 ? CLERK_KEY.substring(0, 12) + '…' : 'MISSING'
const CLERK_TIMEOUT_MS = 10_000

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const bypassed = useRef(false)
  const [elapsed, setElapsed] = useState(0)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (DEV_BYPASS || isLoaded) return
    const start = Date.now()
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500)
    const bail = setTimeout(() => { setTimedOut(true); clearInterval(tick) }, CLERK_TIMEOUT_MS)
    return () => { clearInterval(tick); clearTimeout(bail) }
  }, [isLoaded])

  useEffect(() => {
    if (DEV_BYPASS) {
      if (!bypassed.current && segments.length > 0) {
        bypassed.current = true
        router.replace('/(tabs)')
      }
      return
    }
    if (!isLoaded && !timedOut) return
    const inAuth = segments[0] === '(auth)'
    if (!isSignedIn && !inAuth) router.replace('/(auth)/sign-in')
    else if (isSignedIn && inAuth) router.replace('/(tabs)')
  }, [isLoaded, isSignedIn, segments, timedOut])

  if (!DEV_BYPASS && !isLoaded && !timedOut) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', gap: 12 }}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>
          {`key: ${CLERK_KEY_HINT}\nelapsed: ${elapsed}s / ${CLERK_TIMEOUT_MS / 1000}s`}
        </Text>
      </View>
    )
  }
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
