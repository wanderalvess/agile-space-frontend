import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// Regras que pegam bug de verdade ficam como erro. As que o código legado ainda viola em massa
// (any, setState em effect, aspas em texto, imports não usados...) ficam como aviso: aparecem no relatório,
// não travam o `npm run lint`, e dá para ir apertando uma por vez.
const legacyAsWarning = [
  '@typescript-eslint/no-explicit-any',
  '@typescript-eslint/no-require-imports',
  '@next/next/no-html-link-for-pages',
  'react/no-unescaped-entities',
  'react-hooks/set-state-in-effect',
  'react-hooks/refs',
  'react-hooks/preserve-manual-memoization',
  'react-hooks/static-components',
  'react-hooks/immutability',
  'react-hooks/purity',
]

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: Object.fromEntries(legacyAsWarning.map((r) => [r, 'warn'])) },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
    'public/**',
    'cypress/**',
  ]),
])

export default eslintConfig
