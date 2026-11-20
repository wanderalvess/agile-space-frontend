import { MetadataRoute } from 'next';
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Portal Tech V&D',
    short_name: 'Portal Tech V&D',
    description: 'A plataforma definitiva para cerimônias ágeis e gerenciamento de fluxo.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    // Ícone provisório (monograma "VD" neutro); a arte definitiva depende da aprovação da marca TOTVS.
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
