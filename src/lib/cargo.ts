/**
 * Cargo da pessoa para EXIBIR (Minha identidade, mesa do Poker, Retro, Brainstorming). Uma só regra, para as telas
 * não divergirem: vale o cargo que a administração mostra (`jobTitle`, o mesmo da tela de Usuários & Acesso) e, sem
 * ele, o papel da pessoa na squad ativa. "admin" e "user" são nível de acesso, não cargo, e nunca aparecem aqui.
 *
 * Só exibição. Permissão e liderança continuam saindo do vínculo (`userProfile.role`), nunca daqui.
 */
export function resolveCargo(jobTitle?: string | null, squadRole?: string | null): string {
  const isCargo = (v?: string | null) => {
    const t = (v ?? '').trim();
    return t && t.toLowerCase() !== 'admin' && t.toLowerCase() !== 'user' ? t : '';
  };
  return isCargo(jobTitle) || isCargo(squadRole);
}
