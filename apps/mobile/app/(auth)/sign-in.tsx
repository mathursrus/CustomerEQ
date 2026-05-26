import { useSignIn, useSSO } from '@clerk/clerk-expo'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

// Required for iOS: closes the browser tab after OAuth redirect comes back to the app
WebBrowser.maybeCompleteAuthSession()

type OAuthStrategy = 'oauth_google' | 'oauth_github'

function OAuthButton({ strategy, label }: { strategy: OAuthStrategy; label: string }) {
  const { startSSOFlow } = useSSO()
  const [loading, setLoading] = useState(false)

  async function handlePress() {
    setLoading(true)
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy,
        redirectUrl: Linking.createURL('/oauth-native-callback'),
      })
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId })
      }
    } catch (e) {
      Alert.alert('Sign in failed', e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Pressable style={s.oauthBtn} onPress={handlePress} disabled={loading}>
      {loading
        ? <ActivityIndicator color="#374151" />
        : <Text style={s.oauthBtnText}>{label}</Text>}
    </Pressable>
  )
}

export default function SignIn() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignIn() {
    if (!isLoaded) return
    setLoading(true)
    try {
      const result = await signIn.create({ identifier: email, password })
      if (result.status === 'complete') await setActive({ session: result.createdSessionId })
    } catch (e: unknown) {
      Alert.alert('Sign in failed', e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={s.container}>
      <View style={s.logo}>
        <Text style={s.logoText}>CustomerEQ</Text>
        <Text style={s.logoSub}>CX Manager</Text>
      </View>

      <OAuthButton strategy="oauth_google" label="Continue with Google" />
      <OAuthButton strategy="oauth_github" label="Continue with GitHub" />

      <View style={s.dividerRow}>
        <View style={s.dividerLine} />
        <Text style={s.dividerLabel}>or</Text>
        <View style={s.dividerLine} />
      </View>

      <TextInput
        style={s.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={s.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Pressable style={s.btn} onPress={handleSignIn} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Sign In</Text>}
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: '#f8fafc' },
  logo:         { alignItems: 'center', marginBottom: 40 },
  logoText:     { fontSize: 32, fontWeight: '800', color: '#4F46E5', letterSpacing: -0.5 },
  logoSub:      { fontSize: 14, color: '#6b7280', marginTop: 4 },
  oauthBtn:     { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 10 },
  oauthBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  dividerRow:   { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerLabel: { marginHorizontal: 12, fontSize: 13, color: '#9ca3af' },
  input:        { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 16 },
  btn:          { backgroundColor: '#4F46E5', borderRadius: 12, padding: 16, alignItems: 'center' },
  btnText:      { color: '#fff', fontWeight: '700', fontSize: 16 },
})
