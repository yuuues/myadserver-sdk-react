import { defineConfig } from 'tsup';

export default defineConfig([
  // Main bundle (includes React adapter)
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom'],
    treeshake: true,
    splitting: false,
    minify: false,
    esbuildOptions(options) {
      options.jsx = 'automatic';
    },
  },
  // Core-only bundle (framework-agnostic)
  {
    entry: ['src/core/index.ts'],
    outDir: 'dist/core',
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: false,
    treeshake: true,
    splitting: false,
    minify: false,
  },
]);
