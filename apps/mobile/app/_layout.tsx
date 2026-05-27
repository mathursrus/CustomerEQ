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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Slot, useRouter, useSegments } from 'expo-router'
import { useEffect, useRef } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })

const DEV_BYPASS = process.env.EXPO_PUBLIC_DEV_BYPASS_AUTH?.trim() === 'true'

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const bypassed = useRef(false)

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
