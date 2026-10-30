/**
 * Cargo da pessoa: o definido na administração (`users.jobTitle`, tela Usuários & Acesso). É o cargo de ponta a ponta,
 * em todas as telas (cabeçalho, Minha identidade, Poker, Retro, Brainstorming...). Não há fallback para o papel na
 * squad: papel de squad é permissão/vínculo e continua em `userProfile.role`. Sem cargo definido, devolve ''
 * (as telas mostram "Sem cargo"). "admin" e "user" são nível de acesso, nunca cargo.
 */
export function resolveCargo(jobTitle?: string | null): string {
  const t = (jobTitle ?? '').trim();
  return t && t.toLowerCase() !== 'admin' && t.toLowerCase() !== 'user' ? canonicalCargo(t) : '';
}

/** Nomes canônicos dos dois cargos que tinham grafias duplicadas (a administração só oferece estes). */
export const CARGO_DEV = 'Desenvolvedor(a)';
export const CARGO_QA = 'Analista de QA';

const norm = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

const CARGO_ALIASES: Readonly<Record<string, string>> = {
  developer: CARGO_DEV,
  desenvolvedor: CARGO_DEV,
  desenvolvedora: CARGO_DEV,
  'desenvolvedor(a)': CARGO_DEV,
  dev: CARGO_DEV,
  qa: CARGO_QA,
  'analista de qa': CARGO_QA,
  'qa engineer': CARGO_QA,
  'quality assurance': CARGO_QA,
  'analista de qualidade': CARGO_QA,
};

/**
 * Nome canônico do cargo. Dados antigos e o Jira ainda chegam como "Developer", "QA" e outras grafias; aqui elas
 * viram um cargo só (`Desenvolvedor(a)` e `Analista de QA`). A comparação é EXATA (sem caixa, acento nem espaços nas
 * pontas), nunca por "contém": "Desenvolvedor Backend" e "Tech Lead" passam como vieram, só aparados. Vazio -> ''.
 * Use sempre antes de comparar cargos; nunca compare o texto cru.
 */
export function canonicalCargo(value?: string | null): string {
  const t = (value ?? '').trim();
  if (!t) return '';
  return CARGO_ALIASES[norm(t)] ?? t;
}

/** Rótulo para mostrar onde o cargo aparece como texto. */
export const SEM_CARGO = 'Sem cargo';
