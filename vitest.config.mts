import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  // Arquivos de teste não entram na tsconfig: sem o alias explícito, `import ... from '@/lib/x'` num teste não resolve.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    // Testes que varrem a árvore de fontes (classes-legadas) passam de 5 s na suíte completa sob carga.
    testTimeout: 20000,
    include: ['src/**/__tests__/**/*.{test,spec}.{ts,tsx}', 'public/**/__tests__/**/*.{test,spec}.{ts,js}'],
  },
});
