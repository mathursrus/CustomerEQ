import { useSignIn } from '@clerk/clerk-expo'
import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native'

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
      <View style={s.logo}><Text style={s.logoText}>CustomerEQ</Text><Text style={s.logoSub}>CX Manager</Text></View>
      <TextInput style={s.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={s.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <Pressable style={s.btn} onPress={handleSignIn} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Sign In</Text>}
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: '#f8fafc' },
  logo: { alignItems: 'center', marginBottom: 48 },
  logoText: { fontSize: 32, fontWeight: '800', color: '#4F46E5' },
  logoSub: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 16 },
  btn: { backgroundColor: '#4F46E5', borderRadius: 12, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
