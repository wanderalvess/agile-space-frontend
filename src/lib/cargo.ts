/**
 * Cargo da pessoa: o definido na administração (`users.jobTitle`, tela Usuários & Acesso). É o cargo de ponta a ponta,
 * em todas as telas (cabeçalho, Minha identidade, Poker, Retro, Brainstorming...). Não há fallback para o papel na
 * squad: papel de squad é permissão/vínculo e continua em `userProfile.role`. Sem cargo definido, devolve ''
 * (as telas mostram "Sem cargo"). "admin" e "user" são nível de acesso, nunca cargo.
 */
export function resolveCargo(jobTitle?: string | null): string {
  const t = (jobTitle ?? '').trim();
  return t && t.toLowerCase() !== 'admin' && t.toLowerCase() !== 'user' ? t : '';
}

/** Rótulo para mostrar onde o cargo aparece como texto. */
export const SEM_CARGO = 'Sem cargo';
