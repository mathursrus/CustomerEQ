import '../global.css'
// clerk-js@5 headless bundle accesses browser globals absent in React Native/Hermes.
// Use a minimal stub — do NOT alias global itself or add document (both cause
// other libraries to misdetect the environment and crash).
if (typeof window === 'undefined') {
  ;(global as any).window = {
    addEventListener:    () => {},
    removeEventListener: () => {},
    location: {
      hostname: 'localhost', host: 'localhost',
      href: 'https://localhost/', origin: 'https://localhost', protocol: 'https:',
    },
  }
}
if (typeof isSecureContext === 'undefined') {
  ;(global as any).isSecureContext = true
}
import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Slot, useRouter, useSegments } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })

const DEV_BYPASS = process.env.EXPO_PUBLIC_DEV_BYPASS_AUTH?.trim() === 'true'
const AUTH_TIMEOUT_MS = 30_000

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const bypassed = useRef(false)
  const [authTimedOut, setAuthTimedOut] = useState(false)

  useEffect(() => {
    if (isLoaded || DEV_BYPASS) return
    const t = setTimeout(() => setAuthTimedOut(true), AUTH_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [isLoaded])

  useEffect(() => {
    if (DEV_BYPASS) {
      if (!bypassed.current && segments.length > 0) {
        bypassed.current = true
        router.replace('/(tabs)')
      }
      return
    }
    if (!isLoaded) return
    const inAuth = segments[0] === '(auth)'
    if (!isSignedIn && !inAuth) router.replace('/(auth)/sign-in')
    else if (isSignedIn && inAuth) router.replace('/(tabs)')
  }, [isLoaded, isSignedIn, segments])

  if (!DEV_BYPASS && !isLoaded) {
    if (authTimedOut) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: 32 }}>
          <Text style={{ color: '#ef4444', fontSize: 16, textAlign: 'center', marginBottom: 8 }}>
            Unable to connect to authentication service.
          </Text>
          <Text style={{ color: '#64748b', fontSize: 14, textAlign: 'center', marginBottom: 12 }}>
            Please check your internet connection and reopen the app.
          </Text>
          <Text style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center' }}>
            If this persists, contact support@wellnessatwork.me
          </Text>
        </View>
      )
    }
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
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
