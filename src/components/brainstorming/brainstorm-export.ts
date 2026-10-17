/**
 * Exportação do Brainstorming: resumo em Markdown e planilha CSV. Ideias que o servidor ainda não revelou a
 * quem exporta (texto vazio) ficam de fora.
 */
import { votesOf } from '@/lib/brainstorming-utils';
import type { BrainstormingGroup, BrainstormingIdea } from '@/lib/types';
import { quadrantLabel, sortByVotes } from './brainstorm-room-logic';

const readable = (ideas: readonly BrainstormingIdea[]) => ideas.filter((idea) => !idea.hidden);

function ideaLine(idea: BrainstormingIdea): string {
  const votes = votesOf(idea).length;
  const label = quadrantLabel(idea.qualifiers);
  const decision = label === 'a classificar' ? '' : ` (${label.toLowerCase()})`;
  return `- [${votes} ${votes === 1 ? 'voto' : 'votos'}] ${idea.content.replace(/\s*\n\s*/g, ' ')}${decision}`;
}

/** Resumo em Markdown: grupos na ordem deles, ideias por votos, e no fim as que ficaram sem grupo. */
export function buildMarkdown(opts: {
  title: string;
  date: string;
  ideas: readonly BrainstormingIdea[];
  groups: readonly BrainstormingGroup[];
}): string {
  const ideas = readable(opts.ideas);
  const lines: string[] = [`# Brainstorming: ${opts.title || 'Sem título'} (${opts.date})`, ''];

  const ordered = [...opts.groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const group of ordered) {
    const inGroup = ideas.filter((i) => i.groupId === group.id);
    if (inGroup.length === 0) continue;
    lines.push(`## ${group.title}`, '', ...sortByVotes(inGroup).map(ideaLine), '');
  }

  const known = new Set(opts.groups.map((g) => g.id));
  const loose = ideas.filter((i) => !i.groupId || !known.has(i.groupId));
  if (loose.length > 0) lines.push('## Sem grupo', '', ...sortByVotes(loose).map(ideaLine), '');

  return lines.join('\n').trim();
}

/** Texto que começa com = + - @ vira fórmula no Excel: um apóstrofo na frente impede. */
function safeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Uma célula do CSV entre aspas, com as aspas internas dobradas (uma vez só). */
export function csvCell(value: string | number): string {
  return `"${safeCell(String(value)).replace(/"/g, '""')}"`;
}

export const CSV_HEADER = ['Grupo', 'Votos', 'Conteúdo', 'Retorno', 'Esforço', 'Data de criação'] as const;

/** Planilha: uma linha por ideia (grupo, votos, texto, retorno, esforço e data). */
export function buildCsv(ideas: readonly BrainstormingIdea[], groups: readonly BrainstormingGroup[]): string {
  const titleOf = new Map(groups.map((g) => [g.id, g.title]));
  const rows: (string | number)[][] = [[...CSV_HEADER]];
  for (const idea of readable(ideas)) {
    rows.push([
      idea.groupId ? titleOf.get(idea.groupId) || 'Desconhecido' : 'Sem grupo',
      votesOf(idea).length,
      idea.content,
      idea.qualifiers?.roi ?? '',
      idea.qualifiers?.effort ?? '',
      Number.isNaN(Date.parse(idea.createdAt)) ? '' : new Date(idea.createdAt).toLocaleString('pt-BR'),
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

/** Nome do arquivo sem os caracteres que o sistema recusa. */
export function csvFileName(title: string | undefined): string {
  const base = (title ?? '').trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
  return `brainstorming_${base || 'resumo'}.csv`;
}
