import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/ceq-spin-wheel.ts',
      name: 'CeqSpinWheel',
      formats: ['iife'],
      fileName: () => 'ceq-spin-wheel.js',
    },
    outDir: 'dist',
    minify: true,
    target: 'es2020',
  },
})
