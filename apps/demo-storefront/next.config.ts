import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  ...(process.env.CI || process.env.DOCKER ? { output: 'standalone' as const } : {}),
}

export default nextConfig
