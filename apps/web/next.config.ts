import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // standalone output is required by Dockerfile.web but breaks on Windows/OneDrive
  // due to symlink permission errors — only enable in CI / Docker builds.
  ...(process.env.CI || process.env.DOCKER ? { output: 'standalone' as const } : {}),
  transpilePackages: ['@customerEQ/ui', '@customerEQ/mcp-server'],
}

export default nextConfig
