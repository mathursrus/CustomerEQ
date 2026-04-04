import { defineConfig } from 'vite'

// Build target can be selected via EMBED_COMPONENT env var.
// Default builds the spin wheel; set EMBED_COMPONENT=ceq-support-chat for chat widget.
const component = process.env.EMBED_COMPONENT ?? 'ceq-spin-wheel'

const entries: Record<string, { entry: string; name: string; fileName: string }> = {
  'ceq-spin-wheel': {
    entry: 'src/ceq-spin-wheel.ts',
    name: 'CeqSpinWheel',
    fileName: 'ceq-spin-wheel.js',
  },
  'ceq-support-chat': {
    entry: 'src/ceq-support-chat.ts',
    name: 'CeqSupportChat',
    fileName: 'ceq-support-chat.js',
  },
}

const config = entries[component] ?? entries['ceq-spin-wheel']

export default defineConfig({
  build: {
    lib: {
      entry: config.entry,
      name: config.name,
      formats: ['iife'],
      fileName: () => config.fileName,
    },
    outDir: 'dist',
    minify: true,
    target: 'es2020',
  },
})
