/**
 * Fases do fluxo de uma história (Codificação, Testes Auto, Code Review, QA, TI) e classificação de uma subtarefa
 * numa fase. A classificação usa SÓ o tipo da issue (`issuetype.name`), nunca o título, que é texto livre e gera
 * falso-positivo (ex.: "Ajustar rotina de notificação" tem "ti" dentro de "notificação").
 */
import type { SquadWorkflowPhase } from '@/lib/types';

export type PhaseKind = 'DEV' | 'Auto' | 'Review' | 'QA' | 'TI' | 'OUTRA';

export interface WorkflowPhase {
  /** Rótulo por extenso, ex. "Code Review". */
  label: string;
  /** Sigla curta (a `kind` da fase configurada, ou DEV/Auto/Review/QA/TI). */
  shortLabel: string;
  /** Posição na sequência: fases com a mesma ordem rodam em paralelo; 99 = tipo não reconhecido. */
  order: number;
  /** Classes de cor guardadas na config da squad; ausente quando a fase vem da heurística por tipo. */
  configuredColor?: string;
  /** Chave da cor padrão quando não há cor configurada. */
  kind: PhaseKind;
  /** false = o tipo não casou com nenhuma regra. */
  matched: boolean;
}

/** Normaliza o tipo da issue: minúsculo, sem acento, sem espaço nas pontas. */
export function normalizeIssueType(type?: string): string {
  return (type || '')
    .toLowerCase()
    .trim()
    .replace(/[áàâã]/g, 'a')
    .replace(/[éê]/g, 'e')
    .replace(/í/g, 'i')
    .replace(/[óôõ]/g, 'o')
    .replace(/ú/g, 'u')
    .replace(/ç/g, 'c');
}

// Palavra inteira: evita 'ti' colar dentro de 'automatizados' (automa-ti-zados).
function hasWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`).test(text);
}

/** Ordem padrão do fluxo quando a squad não configurou fases. */
export const DEFAULT_PHASE_ORDER: Record<string, number> = { DEV: 0, Auto: 1, Review: 2, QA: 3, TI: 4 };

export const DEFAULT_PHASES: { kind: PhaseKind; label: string }[] = [
  { kind: 'DEV', label: 'Codificação' },
  { kind: 'Auto', label: 'Testes automáticos' },
  { kind: 'Review', label: 'Code review' },
  { kind: 'QA', label: 'Teste QA' },
  { kind: 'TI', label: 'Execução de TI' },
];

function classifyByType(type?: string): { kind: PhaseKind; label: string; matched: boolean } {
  const t = normalizeIssueType(type);
  if (t.includes('review') || t.includes('revisao')) return { kind: 'Review', label: 'Code review', matched: true };
  // Automatizados ANTES de QA/TI: "automatizados" contém "ti".
  if (t.includes('automatiz') || t.includes('unitario')) return { kind: 'Auto', label: 'Testes automáticos', matched: true };
  if (hasWord(t, 'qa') || t.includes('teste')) return { kind: 'QA', label: 'Teste QA', matched: true };
  if (hasWord(t, 'ti') || t.includes('execucao') || t.includes('acompanhamento')) return { kind: 'TI', label: 'Execução de TI', matched: true };
  if (t.includes('codifica') || t.includes('desenvolv') || hasWord(t, 'dev')) return { kind: 'DEV', label: 'Codificação', matched: true };
  return { kind: 'OUTRA', label: 'Outra fase', matched: false };
}

/**
 * Fase de uma subtarefa: o mapeamento da squad (`SquadConfig.phases`, ordem do array = ordem da fase) manda;
 * quando não cobre o tipo, cai na heurística por tipo.
 */
export function resolveWorkflowPhase(task: { type?: string }, phases?: SquadWorkflowPhase[]): WorkflowPhase {
  if (phases && phases.length > 0) {
    const t = normalizeIssueType(task.type);
    const idx = phases.findIndex((p) => p.issueTypes.some((it) => normalizeIssueType(it) === t));
    if (idx >= 0) {
      const p = phases[idx];
      const byType = classifyByType(task.type);
      return { label: p.label, shortLabel: p.kind, order: idx, configuredColor: p.color, kind: byType.kind, matched: true };
    }
  }
  const d = classifyByType(task.type);
  // Tipo não reconhecido ordena por ÚLTIMO (99): não é DEV de verdade e não pode abrir a cascata.
  return {
    label: d.label,
    shortLabel: d.kind === 'OUTRA' ? 'Outra' : d.kind,
    order: d.matched ? (DEFAULT_PHASE_ORDER[d.kind] ?? 99) : 99,
    kind: d.kind,
    matched: d.matched,
  };
}
