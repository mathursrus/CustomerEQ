export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000'
export const DEV_BYPASS = process.env.EXPO_PUBLIC_DEV_BYPASS_AUTH?.trim() === 'true'
export const DEV_TOKEN = 'dev-bypass'
