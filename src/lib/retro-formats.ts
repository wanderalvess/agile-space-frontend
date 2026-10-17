import {
  RETRO_TEMPLATES,
  type RetroBoard,
  type RetroColumnDef,
  type RetroColumnTheme,
  type RetroTemplateKey,
} from './types';

/** Pergunta do check-in quando o facilitador não escreve a própria. */
export const DEFAULT_HEALTH_CHECK_QUESTION = 'Como você está chegando nessa retro?';

/** Opções ligáveis na criação da retro (as mesmas das configurações da sala). */
export const SETUP_TOGGLES = [
  { key: 'isAuthorsRevealed', title: 'Autores abertos', desc: 'Todos veem quem escreveu cada cartão' },
  { key: 'syncStageEnabled', title: 'Sincronizar coluna ativa', desc: 'Todos acompanham a coluna do facilitador' },
  { key: 'healthCheckEnabled', title: 'Check-in inicial', desc: 'Pergunta como cada pessoa chega à retro' },
  { key: 'autoRevealOnTimerEnd', title: 'Revelar ao fim do timer', desc: 'Os cartões aparecem quando o tempo acaba' },
  { key: 'autoSortOnVoteEnd', title: 'Ordenar por votos ao encerrar', desc: 'Os mais votados sobem para o topo' },
] as const;

export type SetupToggleKey = (typeof SETUP_TOGGLES)[number]['key'];
export type SetupSettings = Record<SetupToggleKey, boolean>;

export const DEFAULT_SETUP_SETTINGS: SetupSettings = Object.fromEntries(SETUP_TOGGLES.map((t) => [t.key, false])) as SetupSettings;

export interface RetroFormat {
  key: RetroTemplateKey;
  name: string;
  desc: string;
}

/** Formatos oferecidos na criação. As colunas de cada um vêm de `RETRO_TEMPLATES` (fonte única). */
export const RETRO_FORMATS: readonly RetroFormat[] = [
  { key: 'classic', name: 'Clássico', desc: 'O que funcionou, o que melhorar e as ações' },
  { key: 'start_stop_continue', name: 'Start / Stop / Continue', desc: 'Comportamentos do time: começar, parar e continuar' },
  { key: 'four_ls', name: '4Ls', desc: 'Curti, aprendi, faltou e desejei' },
  { key: 'daki', name: 'DAKI', desc: 'Remover, adicionar, manter e melhorar práticas' },
  { key: 'sailboat', name: 'Veleiro', desc: 'Vento, sol, âncora e pedras adiante' },
  { key: 'starfish', name: 'Estrela-do-mar', desc: 'Manter, menos, mais, começar e parar' },
  { key: 'mad_sad_glad', name: 'Mad / Sad / Glad', desc: 'O clima da squad: alegria, tristeza e frustração' },
  { key: 'three_little_pigs', name: 'Três porquinhos', desc: 'Quão sólidos estão os processos' },
  { key: 'speed_car', name: 'Carro veloz', desc: 'Motor que acelera e paraquedas que freia' },
  { key: 'custom', name: 'Personalizado', desc: 'De 2 a 6 colunas definidas por você' },
];

export const MIN_CUSTOM_COLUMNS = 2;
export const MAX_CUSTOM_COLUMNS = 6;

export function retroFormatName(key?: RetroTemplateKey | null): string | undefined {
  return RETRO_FORMATS.find((f) => f.key === key)?.name;
}

/** Colunas de um formato pronto; `custom` não tem (vêm do editor). */
export function formatColumns(key: RetroTemplateKey): RetroColumnDef[] | null {
  return key === 'custom' ? null : RETRO_TEMPLATES[key] ?? null;
}

export interface CustomColumnDraft {
  title: string;
  theme: RetroColumnTheme;
}

export const DEFAULT_CUSTOM_COLUMNS: CustomColumnDraft[] = [
  { title: '', theme: 'success' },
  { title: '', theme: 'warning' },
  { title: '', theme: 'action' },
];

export type NewRetroProblem = 'no-title' | 'custom-columns';

/** O que impede de criar: sem título, ou formato personalizado com menos de 2 colunas ou nomes repetidos. */
export function validateNewRetro(args: { title: string; template: RetroTemplateKey; customColumns: readonly CustomColumnDraft[] }): NewRetroProblem | null {
  if (!args.title.trim()) return 'no-title';
  if (args.template === 'custom') {
    const names = args.customColumns.map((c) => c.title.trim().toLowerCase()).filter(Boolean);
    if (names.length < MIN_CUSTOM_COLUMNS || new Set(names).size !== names.length) return 'custom-columns';
  }
  return null;
}

/** Colunas do quadro novo: as do formato, ou as personalizadas (só as nomeadas, numeradas em ordem). */
export function resolveNewColumns(args: { template: RetroTemplateKey; customColumns: readonly CustomColumnDraft[]; now: number }): RetroColumnDef[] {
  if (args.template === 'custom') {
    return args.customColumns
      .filter((c) => c.title.trim())
      .map((c, i) => ({ id: `custom_${i}_${args.now}`, title: c.title.trim(), theme: c.theme, order: i }));
  }
  return formatColumns(args.template) ?? RETRO_TEMPLATES.classic;
}

/** Corpo do POST que cria a retro: mesmo contrato de antes, só montado num lugar testável. */
export function buildNewRetroBoard(args: {
  id: string;
  userId: string;
  title: string;
  team: string;
  template: RetroTemplateKey;
  customColumns: readonly CustomColumnDraft[];
  settings: SetupSettings;
  healthCheckQuestion: string;
  squadId?: string;
  sprintId?: string;
  now?: Date;
}): Partial<RetroBoard> & { id: string } {
  const now = args.now ?? new Date();
  const columns = resolveNewColumns({ template: args.template, customColumns: args.customColumns, now: now.getTime() });
  return {
    id: args.id,
    creatorId: args.userId,
    isCardsRevealed: false,
    votingStatus: 'disabled',
    maxVotesPerParticipant: 5,
    ...args.settings,
    timer: { status: 'stopped', endTime: null, initialDuration: 300, remainingOnPause: 300 },
    title: args.title.trim(),
    team: args.team.trim() || 'Squad Geral',
    createdAt: now.toISOString(),
    participantIds: [args.userId],
    columns,
    templateKey: args.template,
    ...(args.healthCheckQuestion.trim() ? { healthCheckQuestion: args.healthCheckQuestion.trim() } : {}),
    ...(args.squadId ? { squadId: args.squadId } : {}),
    ...(args.sprintId ? { sprintId: args.sprintId } : {}),
  };
}
