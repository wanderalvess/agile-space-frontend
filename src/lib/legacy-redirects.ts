/**
 * Rotas que deixaram de existir e para onde vão (redirect permanente, 308, no next.config).
 * Links salvos, e-mails e a barra de endereços continuam funcionando.
 */
export interface LegacyRedirect {
  source: string;
  destination: string;
  permanent: true;
}

export const LEGACY_REDIRECTS: LegacyRedirect[] = [
  // /painel virou a aba Resumo do hub da squad.
  { source: '/painel', destination: '/squad?tab=resumo', permanent: true },
  // /dashboards/* (atalhos antigos do painel do PO) caem na aba Painéis do hub.
  { source: '/dashboards/:path*', destination: '/squad?tab=paineis', permanent: true },
  // /projects só repassava para a administração.
  { source: '/projects', destination: '/admin', permanent: true },
];
