import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // standalone output is required by Dockerfile.web but breaks on Windows/OneDrive
  // due to symlink permission errors — only enable in CI / Docker builds.
  ...(process.env.CI || process.env.DOCKER ? { output: 'standalone' as const } : {}),
  transpilePackages: ['@customerEQ/ui', '@customerEQ/mcp-server'],
  webpack(config) {
    // ESM workspace packages (e.g. @customerEQ/mcp-server) import TypeScript source
    // files using .js extensions (TS ESM convention). Tell webpack to also try .ts
    // when it encounters a .js import so transpilePackages works correctly.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return config
  },
}

export default nextConfig

