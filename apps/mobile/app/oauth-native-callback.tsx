import * as WebBrowser from 'expo-web-browser'

// Expo Router delivers the deep-link redirect here after OAuth completes.
// maybeCompleteAuthSession() hands the result back to the waiting startSSOFlow().
WebBrowser.maybeCompleteAuthSession()

export default function OAuthNativeCallback() {
  return null
}
