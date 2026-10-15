'use client';

import { useState } from 'react';
import { DeckType, DECKS, TSHIRT_UNIT_LABELS, type TshirtUnit, type TshirtEquivalent } from '@/lib/types';
import { Search, Save } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { FIELD, FOCUS_RING, Segmented } from '@/components/room-kit';

type DivergenceThresholds = { warn: number; high: number };
type TshirtSize = 'PP' | 'P' | 'M' | 'G' | 'GG';
type FacilitatorSettings = {
  allowManagementToVote?: boolean; autoReveal?: boolean; divergenceThresholds?: DivergenceThresholds; outlierPrompt?: boolean;
  confidenceVote?: boolean; showVelocity?: boolean; anonymousReveal?: boolean; turnNotification?: boolean; showDistribution?: boolean;
  decisionNotes?: boolean; perTopicTime?: boolean; autoTimer?: boolean; groomingFlag?: boolean; autoConsensus?: boolean;
  suggestRevote?: boolean; reactions?: boolean; roundingMode?: 'up' | 'nearest' | 'down' | 'deck'; blindVotes?: boolean;
  groupVotesByRole?: boolean; referenceStory?: boolean; roundNudge?: boolean; maxRounds?: number; refinementNotes?: boolean;
  parkTask?: boolean; cancelTask?: boolean; tshirtEquivalents?: Partial<Record<TshirtSize, TshirtEquivalent>>;
};

interface FacilitatorPanelProps {
  deck: DeckType;
  allowManagementToVote?: boolean;
  autoReveal?: boolean;
  outlierPrompt?: boolean;
  confidenceVote?: boolean;
  showVelocity?: boolean;
  anonymousReveal?: boolean;
  turnNotification?: boolean;
  showDistribution?: boolean;
  decisionNotes?: boolean;
  perTopicTime?: boolean;
  autoTimer?: boolean;
  groomingFlag?: boolean;
  autoConsensus?: boolean;
  suggestRevote?: boolean;
  reactions?: boolean;
  roundingMode?: 'up' | 'nearest' | 'down' | 'deck';
  blindVotes?: boolean;
  groupVotesByRole?: boolean;
  referenceStory?: boolean;
  roundNudge?: boolean;
  maxRounds?: number;
  refinementNotes?: boolean;
  parkTask?: boolean;
  cancelTask?: boolean;
  divergenceThresholds?: DivergenceThresholds;
  tshirtEquivalents?: Partial<Record<TshirtSize, TshirtEquivalent>>;
  onUpdateSettings: (settings: Partial<FacilitatorSettings>) => void;
  onSetDeck?: (deck: DeckType) => void;
  onSaveTemplate?: () => void;
  // Auto-reveal/auto-timer só fazem sentido no modo síncrono; escondidos no async.
  showAutoReveal?: boolean;
  // Limites de divergência só são aplicados no cálculo síncrono; escondidos no async.
  showDivergence?: boolean;
  // Referência e aviso de rodadas só estão implementados no síncrono por
  // enquanto; escondidos no async pra não expor toggle inerte.
  showRoundFeatures?: boolean;
  isEmbeddedInSheet?: boolean;
}

const SCALE_OPTIONS = [
  { id: 'fibonacci', label: 'Fibonacci' },
  { id: 'hours', label: 'Horas reais' },
  { id: 'tshirt', label: 'Camisetas' },
] as const;

const TSHIRT_SIZES: readonly TshirtSize[] = ['PP', 'P', 'M', 'G', 'GG'];

/** Linha de ajuste: título, descrição curta e interruptor. */
function SettingRow({ id, title, desc, checked, onChange }: {
  id: string; title: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <label htmlFor={id} className="flex min-w-0 cursor-pointer flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{desc}</span>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="shrink-0" />
    </div>
  );
}

/** Linha com um controle à direita (número, seleção). */
function ControlRow({ htmlFor, title, desc, children }: { htmlFor: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <label htmlFor={htmlFor} className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{desc}</span>
      </label>
      {children}
    </div>
  );
}

export function FacilitatorPanel({
  deck,
  allowManagementToVote,
  autoReveal,
  outlierPrompt,
  confidenceVote,
  showVelocity,
  anonymousReveal,
  turnNotification,
  showDistribution,
  decisionNotes,
  perTopicTime,
  autoTimer,
  groomingFlag,
  autoConsensus,
  suggestRevote,
  reactions,
  roundingMode,
  blindVotes,
  groupVotesByRole,
  referenceStory,
  roundNudge,
  maxRounds,
  refinementNotes,
  parkTask,
  cancelTask,
  divergenceThresholds,
  tshirtEquivalents,
  onUpdateSettings,
  onSetDeck,
  onSaveTemplate,
  showAutoReveal = true,
  showDivergence = true,
  showRoundFeatures = true,
}: FacilitatorPanelProps) {
  const warn = divergenceThresholds?.warn ?? 2;
  const high = divergenceThresholds?.high ?? 5;
  const [tab, setTab] = useState('votacao');
  const [search, setSearch] = useState('');

  const TAB_DEFS = [
    { v: 'votacao', label: 'Votação' },
    { v: 'revelacao', label: 'Revelação' },
    { v: 'tempo', label: 'Tempo' },
    { v: 'relatorios', label: 'Relatórios' },
    { v: 'sessao', label: 'Sessão' },
  ];

  // Ajustes como dados: renderiza por aba E permite buscar entre todas as abas
  // sem duplicar JSX. `visible: false` esconde (ex.: auto-reveal só no síncrono).
  type ToggleDef = { id: string; title: string; desc: string; tab: string; value: boolean; key: keyof FacilitatorSettings; visible?: boolean };
  const toggleDefs: ToggleDef[] = [
    { id: 'allow-management-vote', title: 'Gestão pode votar', desc: 'Inclui papéis de gestão', tab: 'votacao', value: !!allowManagementToVote, key: 'allowManagementToVote' },
    { id: 'confidence-vote', title: 'Voto de confiança', desc: 'Baixa, média ou alta', tab: 'votacao', value: !!confidenceVote, key: 'confidenceVote' },
    { id: 'grooming-flag', title: 'Enviar para grooming', desc: 'Ação nos votos "?"', tab: 'votacao', value: !!groomingFlag, key: 'groomingFlag' },
    { id: 'auto-consensus', title: 'Auto-consenso', desc: 'Salva e avança no consenso', tab: 'votacao', value: !!autoConsensus, key: 'autoConsensus' },
    { id: 'reactions', title: 'Reações', desc: 'Barra de reações na mesa', tab: 'votacao', value: !!reactions, key: 'reactions' },
    { id: 'reference-story', title: 'História de referência', desc: 'Régua visível na votação', tab: 'votacao', value: !!referenceStory, key: 'referenceStory', visible: showRoundFeatures },
    { id: 'round-nudge', title: 'Aviso de rodadas', desc: 'Sugere quebrar ou adiar após N rodadas', tab: 'votacao', value: !!roundNudge, key: 'roundNudge', visible: showRoundFeatures },
    { id: 'cancel-task', title: 'Cancelar tarefa', desc: 'Permite cancelar itens no refinamento', tab: 'votacao', value: !!cancelTask, key: 'cancelTask', visible: showRoundFeatures },
    { id: 'park-task', title: 'Adiar tarefa', desc: 'Volta o item para o fim da fila', tab: 'votacao', value: !!parkTask, key: 'parkTask', visible: showRoundFeatures },
    { id: 'auto-reveal', title: 'Revelar automaticamente', desc: 'Quando todos votarem', tab: 'revelacao', value: !!autoReveal, key: 'autoReveal', visible: showAutoReveal },
    { id: 'blind-votes', title: 'Votos às cegas', desc: 'O servidor só entrega os votos dos outros na revelação', tab: 'revelacao', value: !!blindVotes, key: 'blindVotes' },
    { id: 'anonymous-reveal', title: 'Revelação anônima', desc: 'Esconde quem votou o quê', tab: 'revelacao', value: !!anonymousReveal, key: 'anonymousReveal' },
    { id: 'outlier-prompt', title: 'Explicar votos extremos', desc: 'Destaca o maior e o menor', tab: 'revelacao', value: !!outlierPrompt, key: 'outlierPrompt' },
    { id: 'show-distribution', title: 'Histograma de votos', desc: 'Distribuição por valor', tab: 'revelacao', value: !!showDistribution, key: 'showDistribution' },
    { id: 'suggest-revote', title: 'Sugerir revotação', desc: 'Na divergência crítica', tab: 'revelacao', value: !!suggestRevote, key: 'suggestRevote' },
    { id: 'group-votes-by-role', title: 'Agrupar votos por papel', desc: 'Detalhamento em blocos por cargo', tab: 'revelacao', value: !!groupVotesByRole, key: 'groupVotesByRole' },
    { id: 'auto-timer', title: 'Timer automático', desc: 'Inicia ao abrir cada tarefa', tab: 'tempo', value: !!autoTimer, key: 'autoTimer', visible: showAutoReveal },
    { id: 'turn-notification', title: 'Avisar "sua vez"', desc: 'Aviso e som ao abrir a rodada', tab: 'tempo', value: !!turnNotification, key: 'turnNotification' },
    { id: 'decision-notes', title: 'Nota de decisão', desc: 'Por que estimamos assim', tab: 'relatorios', value: !!decisionNotes, key: 'decisionNotes' },
    { id: 'refinement-notes', title: 'Notas de refinamento', desc: 'Painel DEV e QA por item', tab: 'relatorios', value: !!refinementNotes, key: 'refinementNotes', visible: showRoundFeatures },
    { id: 'per-topic-time', title: 'Tempo por tópico', desc: 'Tempo real de cada item', tab: 'relatorios', value: !!perTopicTime, key: 'perTopicTime' },
    { id: 'show-velocity', title: 'Histórico do time', desc: 'Velocity das últimas sessões', tab: 'relatorios', value: !!showVelocity, key: 'showVelocity' },
  ];

  const renderToggle = (d: ToggleDef) => (
    <SettingRow key={d.id} id={d.id} title={d.title} desc={d.desc} checked={d.value} onChange={(v) => onUpdateSettings({ [d.key]: v } as Partial<FacilitatorSettings>)} />
  );

  // Busca insensível a acento/caixa sobre os ajustes visíveis.
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const q = norm(search.trim());
  const visibleDefs = toggleDefs.filter((d) => d.visible !== false);
  const matched = q ? visibleDefs.filter((d) => norm(d.title).includes(q) || norm(d.desc).includes(q)) : [];
  const countOf = (v: string) => visibleDefs.filter((d) => d.tab === v).length;

  const setEquivalent = (size: TshirtSize, patch: Partial<TshirtEquivalent>) => {
    const current = tshirtEquivalents?.[size] ?? { value: 0, unit: 'hora' as TshirtUnit };
    const next = { ...(tshirtEquivalents ?? {}), [size]: { ...current, ...patch } };
    onUpdateSettings({ tshirtEquivalents: next });
  };

  const numberField = cn(FIELD, 'h-9 text-center font-medium tabular-nums');

  return (
    <div className="flex flex-col gap-4">
      {/* Escala e busca */}
      <div className="flex flex-wrap items-end justify-between gap-3.5 border-b border-border pb-3.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-foreground">
            Escala de estimativa <span className="font-normal text-muted-foreground">· trocar reinicia os votos</span>
          </span>
          {onSetDeck ? (
            <Segmented
              label="Escala de estimativa"
              options={SCALE_OPTIONS}
              value={deck}
              onChange={(id) => { if (id !== deck) onSetDeck(id as DeckType); }}
            />
          ) : (
            <span className="text-sm font-semibold text-foreground">{SCALE_OPTIONS.find((o) => o.id === deck)?.label ?? deck}</span>
          )}
          <div className="flex flex-wrap gap-1" aria-label="Cartas da escala">
            {DECKS[deck].map((v) => (
              <span key={v} className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border border-border bg-card px-1 text-[11px] font-semibold tabular-nums text-muted-foreground">{v}</span>
            ))}
          </div>
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-52">
          <label htmlFor="cf-search" className="text-[13px] font-semibold text-foreground">Buscar ajuste</label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
            <input
              id="cf-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="anônima, timer…"
              className={cn(FIELD, 'h-9 pl-9 text-[13px]')}
            />
          </div>
        </div>
      </div>

      {q ? (
        matched.length > 0 ? (
          <div className="flex flex-col">{matched.map(renderToggle)}</div>
        ) : (
          <div className="py-10 text-center text-muted-foreground">
            <Search aria-hidden="true" className="mx-auto mb-2 h-6 w-6 opacity-40" strokeWidth={1.5} />
            <p className="text-sm font-medium">Nenhum ajuste encontrado</p>
            <p className="mt-1 text-xs">para &quot;{search}&quot;</p>
          </div>
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-[148px_minmax(0,1fr)]">
          <nav aria-label="Seções" className="-mx-1 flex gap-1 overflow-x-auto px-1 sm:mx-0 sm:flex-col sm:overflow-visible sm:px-0">
            {TAB_DEFS.map((t) => {
              const on = tab === t.v;
              const n = countOf(t.v);
              return (
                <button
                  key={t.v}
                  type="button"
                  aria-current={on ? 'page' : undefined}
                  onClick={() => setTab(t.v)}
                  className={cn(
                    'flex h-9 shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 text-left text-sm transition-colors duration-[220ms]',
                    FOCUS_RING,
                    on ? 'bg-primary/10 font-semibold text-foreground dark:bg-primary/15' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  {t.label}
                  {n > 0 && <span className="text-[11px] tabular-nums opacity-70">{n}</span>}
                </button>
              );
            })}
          </nav>

          <div className="room-rise flex min-w-0 flex-col" key={tab}>
            {tab === 'votacao' && (
              <>
                {visibleDefs.filter((d) => d.tab === 'votacao').map(renderToggle)}
                {showRoundFeatures && roundNudge && (
                  <ControlRow htmlFor="max-rounds" title="Teto de rodadas" desc="Avisa ao passar disso sem consenso">
                    <input
                      id="max-rounds"
                      type="number"
                      min={1}
                      value={maxRounds ?? 3}
                      onChange={(e) => onUpdateSettings({ maxRounds: Math.max(1, Number(e.target.value) || 3) })}
                      className={cn(numberField, 'w-20')}
                    />
                  </ControlRow>
                )}
                {deck === 'tshirt' && (
                  <div className="mt-3 flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
                    <span className="text-sm font-medium text-foreground">
                      Equivalência das camisetas <span className="text-xs font-normal text-muted-foreground">· vira horas para média e soma</span>
                    </span>
                    <div className="grid grid-cols-5 gap-2">
                      {TSHIRT_SIZES.map((size) => {
                        const eq = tshirtEquivalents?.[size];
                        return (
                          <div key={size} className="flex min-w-0 flex-col gap-1">
                            <span className="text-center text-[13px] font-bold tabular-nums">{size}</span>
                            <input
                              type="number"
                              min={0}
                              step="0.5"
                              value={eq?.value ?? ''}
                              placeholder="0"
                              aria-label={`Quantidade para ${size}`}
                              onChange={(e) => setEquivalent(size, { value: Number(e.target.value) || 0 })}
                              className={cn(FIELD, 'h-8 px-1 text-center text-[13px]')}
                            />
                            <select
                              aria-label={`Unidade para ${size}`}
                              value={eq?.unit ?? 'hora'}
                              onChange={(e) => setEquivalent(size, { unit: e.target.value as TshirtUnit })}
                              className={cn(FIELD, 'h-8 px-1 text-xs')}
                            >
                              {(Object.keys(TSHIRT_UNIT_LABELS) as TshirtUnit[]).map((u) => (
                                <option key={u} value={u}>{TSHIRT_UNIT_LABELS[u]}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {tab === 'revelacao' && (
              <>
                {visibleDefs.filter((d) => d.tab === 'revelacao').map(renderToggle)}
                <ControlRow htmlFor="rounding-mode" title="Arredondamento da média" desc="Como a média dos votos vira o valor salvo">
                  <select
                    id="rounding-mode"
                    aria-label="Arredondamento da média"
                    value={roundingMode ?? 'up'}
                    onChange={(e) => onUpdateSettings({ roundingMode: e.target.value as 'up' | 'nearest' | 'down' | 'deck' })}
                    className={cn(FIELD, 'h-9 w-48 text-[13px]')}
                  >
                    <option value="up">Para cima (padrão)</option>
                    <option value="nearest">Mais próximo</option>
                    <option value="down">Para baixo</option>
                    <option value="deck">Carta mais próxima</option>
                  </select>
                </ControlRow>
                {deck === 'hours' && showDivergence && (
                  <div className="mt-3 flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
                    <span className="text-sm font-medium text-foreground">
                      Limites de divergência <span className="text-xs font-normal text-muted-foreground">· diferença de horas por papel</span>
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1 text-xs font-bold text-amber-700 dark:text-amber-300" htmlFor="div-warn">
                        Aviso acima de
                        <input
                          id="div-warn"
                          type="number"
                          min={0}
                          value={warn}
                          onChange={(e) => { const w = Math.max(0, Number(e.target.value) || 0); onUpdateSettings({ divergenceThresholds: { warn: w, high: Math.max(w, high) } }); }}
                          className={cn(FIELD, 'h-9 font-normal text-foreground')}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-bold text-red-700 dark:text-red-300" htmlFor="div-high">
                        Crítico acima de
                        <input
                          id="div-high"
                          type="number"
                          min={0}
                          value={high}
                          onChange={(e) => { const h = Math.max(0, Number(e.target.value) || 0); onUpdateSettings({ divergenceThresholds: { warn: Math.min(warn, h), high: h } }); }}
                          className={cn(FIELD, 'h-9 font-normal text-foreground')}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </>
            )}

            {tab === 'tempo' && (
              <>
                {visibleDefs.filter((d) => d.tab === 'tempo').map(renderToggle)}
                {!showAutoReveal && <p className="pt-3 text-xs text-muted-foreground">Timer automático só no modo síncrono.</p>}
              </>
            )}

            {tab === 'relatorios' && visibleDefs.filter((d) => d.tab === 'relatorios').map(renderToggle)}

            {tab === 'sessao' && (
              onSaveTemplate ? (
                <Button type="button" variant="outline" onClick={onSaveTemplate} className="h-10 w-full justify-center gap-2 rounded-[10px] text-sm font-medium">
                  <Save className="h-4 w-4" strokeWidth={1.5} /> Salvar como template
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">A escala de estimativa fica no topo.</p>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
