/**
 * Roteamento do hub da squad (`/squad`): abas por URL, atalhos antigos e o seletor de sprint do cabeçalho.
 * Só funções puras, para o teste cobrir o que a URL promete sem montar a tela.
 */

export const HUB_TABS = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'quadro', label: 'Quadro' },
  { id: 'cronograma', label: 'Cronograma' },
  { id: 'metricas', label: 'Métricas' },
  { id: 'paineis', label: 'Painéis' },
] as const;

export type HubTab = (typeof HUB_TABS)[number]['id'];
export type MetricsView = 'sprint' | 'desempenho';

export const DEFAULT_HUB_TAB: HubTab = 'resumo';

/** Destino do que antes era o /painel. */
export const SQUAD_SUMMARY_HREF = '/squad?tab=resumo';

const HUB_TAB_IDS: readonly string[] = HUB_TABS.map((t) => t.id);

/** Valores antigos de `?tab=` (hub anterior e /painel) e a aba em que cada um cai agora. */
const LEGACY_TABS: Record<string, { tab: HubTab; view?: MetricsView }> = {
  overview: { tab: 'resumo' },
  painel: { tab: 'resumo' },
  board: { tab: 'quadro' },
  plans: { tab: 'cronograma' },
  metrics: { tab: 'metricas' },
  pulse: { tab: 'metricas', view: 'sprint' },
  performance: { tab: 'metricas', view: 'desempenho' },
  dashboards: { tab: 'paineis' },
};

export interface HubLocation {
  tab: HubTab;
  /** Só vale na aba Métricas. */
  metricsView: MetricsView;
}

/**
 * Aba e visão pedidas pela URL. Valor desconhecido ou ausente cai no Resumo; atalhos antigos
 * (`overview`, `board`, `plans`, `metrics`, `pulse`, `performance`, `dashboards`) continuam valendo.
 */
export function resolveHubLocation(tab?: string | null, view?: string | null): HubLocation {
  const raw = (tab ?? '').trim().toLowerCase();
  let resolved: HubTab = DEFAULT_HUB_TAB;
  let metricsView: MetricsView = view === 'desempenho' ? 'desempenho' : 'sprint';
  if (HUB_TAB_IDS.includes(raw)) {
    resolved = raw as HubTab;
  } else if (LEGACY_TABS[raw]) {
    resolved = LEGACY_TABS[raw].tab;
    if (LEGACY_TABS[raw].view) metricsView = LEGACY_TABS[raw].view!;
  }
  return { tab: resolved, metricsView };
}

/** Endereço de uma aba do hub. A visão das Métricas só entra quando não é a padrão. */
export function hubHref(tab: HubTab, opts?: { metricsView?: MetricsView }): string {
  const params = new URLSearchParams({ tab });
  if (tab === 'metricas' && opts?.metricsView === 'desempenho') params.set('view', 'desempenho');
  return `/squad?${params.toString()}`;
}

/** As abas em que o seletor de sprint do cabeçalho faz sentido (a de Métricas só na visão da sprint). */
export function sprintSelectorVisible(loc: HubLocation): boolean {
  return loc.tab === 'resumo' || loc.tab === 'cronograma' || (loc.tab === 'metricas' && loc.metricsView === 'sprint');
}

// ── Seletor de sprint ──────────────────────────────────────────────────────────────

export const CURRENT_SPRINT = 'CURRENT';

export interface SprintChoice {
  value: string;
  label: string;
}

interface SprintHistoryItem {
  sprintId: string;
  sprintName?: string;
  closedAt?: string;
}

/**
 * Opções do seletor: o histórico gravado na configuração da squad (com a data de encerramento) e, na falta
 * dele, as sprints que aparecem nas issues. Sem nada além da atual não há o que escolher: devolve lista vazia.
 */
export function buildSprintChoices(input: {
  currentLabel: string;
  history: SprintHistoryItem[];
  formatDate: (iso: string) => string;
  /** Sprints vistas nas issues (valor `current` ou o id da sprint), usadas quando não há histórico. */
  issueSprints: SprintChoice[];
}): SprintChoice[] {
  const { currentLabel, history, formatDate, issueSprints } = input;
  if (history.length > 0) {
    return [
      { value: CURRENT_SPRINT, label: currentLabel },
      ...history.map((s) => ({
        value: s.sprintId,
        label: `${s.sprintName || `Sprint ${s.sprintId}`}${s.closedAt ? ` (${formatDate(s.closedAt)})` : ''}`,
      })),
    ];
  }
  const others = issueSprints.filter((o) => o.value !== 'current');
  if (others.length === 0) return [];
  return [{ value: CURRENT_SPRINT, label: currentLabel }, ...others];
}

/**
 * A sprint em foco é uma só para o hub inteiro: o valor do seletor vem da store (quando há histórico)
 * ou do hook do Resumo. Sempre devolve um valor que existe na lista.
 */
export function selectedSprintValue(choices: SprintChoice[], viewingSprintId: string | null, hookSelected: string): string {
  const wanted = viewingSprintId ?? (hookSelected && hookSelected !== 'current' ? hookSelected : CURRENT_SPRINT);
  return choices.some((c) => c.value === wanted) ? wanted : CURRENT_SPRINT;
}

// ── Configuração da squad ────────────────────────────────────────────────────────────

/** JQL padrão da sprint ativa do projeto. */
export function defaultSyncJql(projectKey: string): string {
  return `project = "${projectKey}" AND sprint in openSprints()`;
}

/**
 * JQL que o formulário mostra: a gravada, a não ser que ela aponte para outro projeto que não o da squad
 * (sobra de uma squad copiada de outra); aí volta ao padrão do projeto atual.
 */
export function resolveSyncJql(syncJql: string | undefined | null, projectKey: string): string {
  const stored = (syncJql ?? '').trim();
  if (!stored) return defaultSyncJql(projectKey);
  const match = stored.match(/\bproject\s*=\s*"?([A-Za-z][A-Za-z0-9_]*)"?/i);
  if (match && projectKey && match[1].toUpperCase() !== projectKey.toUpperCase()) return defaultSyncJql(projectKey);
  return stored;
}
