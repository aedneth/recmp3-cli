import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  banner: {
    js: '#!/usr/bin/env node',
  },
  clean: true,
  dts: false,
  external: ['keytar'],
  treeshake: true,
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
