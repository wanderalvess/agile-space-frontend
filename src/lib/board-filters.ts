/**
 * Filtros rápidos do Quadro que falam de pessoa ("Helen", "Marcos"): o nome vem do que a squad cadastrou no filtro
 * e é comparado com quem de fato é responsável pelas issues. Nenhum nome de pessoa fica no código.
 */

export interface PersonMatchIssue {
  /** Login/chave do Jira (ex.: "ana.souza"). */
  assignee?: string;
  assigneeName?: string;
  extraFields?: { label: string; value?: string | null }[];
}

function fold(s?: string | null): string {
  return (s ?? '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().trim();
}

function tokens(s: string, separator: RegExp): string[] {
  return s.split(separator).filter(Boolean);
}

/**
 * O filtro nomeia uma pessoa desta issue? Vale o nome inteiro dentro do nome, do login ou do campo "dev";
 * ou o primeiro nome do filtro igual ao primeiro nome da pessoa (filtro "Ana Paula" acha "Ana Paula Souza" e "ana.souza").
 */
export function matchesPersonFilter(filterName: string, issue: PersonMatchIssue): boolean {
  const wanted = fold(filterName);
  if (!wanted) return false;

  const login = fold(issue.assignee);
  const name = fold(issue.assigneeName);
  const dev = fold(issue.extraFields?.find((f) => fold(f.label).includes('dev'))?.value);

  if ([login, name, dev].some((v) => v && v.includes(wanted))) return true;

  const first = tokens(wanted, /\s+/)[0];
  if (!first || first.length < 3) return false;
  const firstNames = [tokens(name, /\s+/)[0], tokens(login, /[._\-\s]+/)[0], tokens(dev, /\s+/)[0]];
  return firstNames.some((n) => n === first);
}
