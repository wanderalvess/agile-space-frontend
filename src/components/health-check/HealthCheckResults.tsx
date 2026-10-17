'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Presentation, RefreshCw } from 'lucide-react';
import { ModalButton, PresentationBar, StageNav, TabBar, type TabBarItem } from '@/components/room-kit';
import { healthCheckApi } from '@/app/health-check/api';
import { actionPlanApi } from '@/app/action-plan/api';
import { workspaceApi } from '@/app/workspace/api';
import { buildReport } from '@/lib/health-check-export';
import { compareBoards, previousBoard, summaryOfBoard, type DimensionDiff } from '@/lib/health-check-lobby';
import { readPlanRecord, writePlanRecord, type PlanDeps, type PlanRecord } from '@/lib/health-check-plan';
import {
  formatScore,
  planItems,
  resultsFromVotes,
  scaleLabel,
  summarizeResults,
  type ResultRow,
} from '@/lib/health-check-rules';
import type { HealthCheckBoard, HealthCheckDimension, HealthCheckParticipant, HealthCheckVote } from '@/lib/types';
import { cn } from '@/lib/utils';
import { HealthCheckRadarChart, type RadarPrevious } from './HealthCheckRadarChart';
import { HealthExportDialog } from './HealthExportDialog';
import { HealthPlanDialog } from './HealthPlanDialog';
import { HealthPresentation, PRESENTATION_STAGES, type PresentationStage } from './HealthPresentation';
import { AboutCard, AttentionCard, DimensionDetail, FocusCard, FrequencyChart, ScoreHero, StrongCard } from './HealthResultParts';
import { HealthRoomShell } from './HealthRoomShell';
import type { HealthConnection } from './health-ui';

interface HealthCheckResultsProps {
  boardId: string;
  board: HealthCheckBoard;
  squadLabel: string;
  /** Nome de quem criou, quando ele está na lista de participantes. */
  creatorName?: string;
  participants: HealthCheckParticipant[];
  /** Contas com a sala aberta agora; `null`/ausente = o servidor não informa (sem ponto de online). */
  onlineIds?: ReadonlySet<string> | null;
  currentUserId?: string;
  isCreator: boolean;
  dimensions: HealthCheckDimension[];
  /** Todos os votos, sem identificação (o servidor remove o votante ao encerrar). */
  votes: HealthCheckVote[];
  /** Resumo gravado pelo servidor ao encerrar; sem ele, as contagens saem dos votos. */
  results?: ResultRow[];
  connection: HealthConnection;
  onDeleteBoard: () => Promise<void>;
  onOpenFeedback: () => void;
}

type CompareState =
  | { status: 'idle' | 'loading' | 'error' | 'none' }
  | { status: 'ready'; label: string; scores: Map<string, number>; diffs: DimensionDiff[] };

type MapTab = 'freq' | 'radar' | 'compare';

const MAP_TABS: TabBarItem<MapTab>[] = [
  { id: 'freq', label: 'Frequência de respostas' },
  { id: 'radar', label: 'Gráfico radar' },
  { id: 'compare', label: 'Comparar com o anterior' },
];

/**
 * Resultado do Radar de clima (radar encerrado): nota de 0 a 10, frequência por dimensão, gráfico radar, comparação
 * com o radar anterior da squad, fortes e em atenção pela regra única, detalhamento com os comentários anônimos,
 * plano de ação, exportação (Markdown, CSV, PDF) e o modo apresentação.
 */
export function HealthCheckResults({
  boardId,
  board,
  squadLabel,
  creatorName,
  participants,
  onlineIds,
  currentUserId,
  isCreator,
  dimensions,
  votes,
  results,
  connection,
  onDeleteBoard,
  onOpenFeedback,
}: HealthCheckResultsProps) {
  const router = useRouter();
  const scale = board.scaleType ?? 'traffic_light';
  const title = board.sprintName?.trim() || 'Radar de clima';

  const summary = useMemo(() => summarizeResults(dimensions, results ?? resultsFromVotes(dimensions, votes), scale), [dimensions, results, votes, scale]);
  const items = useMemo(() => planItems(summary, title), [summary, title]);
  const report = useMemo(() => buildReport({ board, dimensions, votes, squadName: squadLabel }), [board, dimensions, votes, squadLabel]);

  const [tab, setTab] = useState<MapTab>('freq');
  const [compare, setCompare] = useState<CompareState>({ status: 'idle' });
  const [exportOpen, setExportOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [record, setRecord] = useState<PlanRecord | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [stage, setStage] = useState<PresentationStage>('score');

  // A trava "plano já criado" vive no navegador: lê depois de montar (sem divergência de hidratação).
  useEffect(() => { setRecord(readPlanRecord(boardId)); }, [boardId]);

  const loadCompare = useCallback(async () => {
    if (!board.team) {
      setCompare({ status: 'none' });
      return;
    }
    setCompare({ status: 'loading' });
    try {
      const boards = await healthCheckApi.listBoards(board.team);
      const prev = previousBoard(board, boards);
      const prevSummary = prev ? summaryOfBoard(prev) : null;
      if (!prev || !prevSummary) {
        setCompare({ status: 'none' });
        return;
      }
      const diffs = compareBoards(summary, dimensions, prevSummary, prev.dimensions ?? []);
      const month = format(new Date(prev.createdAt), 'MMM', { locale: ptBR }).replace('.', '');
      setCompare({
        status: 'ready',
        label: `${prev.sprintName?.trim() || 'Radar anterior'} (${month}.)`,
        scores: new Map(diffs.map((d) => [d.key, d.before])),
        diffs,
      });
    } catch (e) {
      console.error('Erro ao buscar o radar anterior', e);
      setCompare({ status: 'error' });
    }
  }, [board, dimensions, summary]);

  useEffect(() => {
    if (tab === 'compare' && compare.status === 'idle') void loadCompare();
  }, [tab, compare.status, loadCompare]);

  // Modo apresentação: setas trocam de etapa e Esc sai (com a janela do plano aberta, as teclas são dela).
  useEffect(() => {
    if (!presenting || planOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPresenting(false);
      const i = PRESENTATION_STAGES.findIndex((s) => s.id === stage);
      if (e.key === 'ArrowRight' && i < PRESENTATION_STAGES.length - 1) setStage(PRESENTATION_STAGES[i + 1].id);
      if (e.key === 'ArrowLeft' && i > 0) setStage(PRESENTATION_STAGES[i - 1].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presenting, planOpen, stage]);

  const deps: PlanDeps = useMemo(
    () => ({
      createBoard: (b) => actionPlanApi.createBoard({ title: b.title, team: b.team, ...(b.team && b.team !== 'Squad Geral' ? { squadId: b.team } : {}) }),
      createTask: (planId, t) => actionPlanApi.createTask(planId, t),
      saveKanbanCard: (card) => {
        if (!currentUserId) return Promise.reject(new Error('Sem sessão'));
        return workspaceApi.saveKanbanCard(currentUserId, card);
      },
    }),
    [currentUserId]
  );

  const onRecord = (r: PlanRecord) => {
    setRecord(r);
    writePlanRecord(r);
  };

  const sortedDetail = useMemo(
    () => summary.stats.map((s, i) => ({ s, i })).sort((a, b) => (a.s.score ?? 99) - (b.s.score ?? 99) || a.i - b.i),
    [summary.stats]
  );

  const aboutRows = [
    ...(creatorName ? [{ label: 'Criado por', value: creatorName }] : []),
    { label: 'Escala', value: scaleLabel(scale) },
    ...(squadLabel ? [{ label: 'Squad', value: squadLabel }] : []),
    { label: 'Criado em', value: format(new Date(board.createdAt), 'dd/MM/yyyy') },
    { label: 'Situação', value: 'Encerrada' },
  ];

  const previous: RadarPrevious | undefined = compare.status === 'ready' ? { label: compare.label, scores: compare.scores } : undefined;
  const commonStats = compare.status === 'ready' ? summary.stats.filter((s) => compare.diffs.some((d) => d.key === s.key)) : [];

  const openPlan = () => setPlanOpen(true);

  return (
    <HealthRoomShell
      title={title}
      squadLabel={squadLabel}
      dimensionCount={dimensions.length}
      phase="result"
      isCreator={isCreator}
      creatorId={board.creatorId}
      participants={participants}
      onlineIds={onlineIds}
      currentUserId={currentUserId}
      connection={connection}
      onOpenFeedback={onOpenFeedback}
      onDeleteBoard={onDeleteBoard}
      onExport={votes.length > 0 ? () => setExportOpen(true) : undefined}
      primaryAction={
        <ModalButton variant="primary" className="gap-2" onClick={() => { setStage('score'); setPresenting(true); }}>
          <Presentation className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Apresentar
        </ModalButton>
      }
      presentationBar={
        presenting ? (
          <PresentationBar title={title} onExit={() => setPresenting(false)}>
            <span className="text-sm tabular-nums text-muted-foreground">Nota {formatScore(summary.climate)} de 10</span>
          </PresentationBar>
        ) : undefined
      }
    >
      {presenting ? (
        <div className="flex min-h-full flex-col">
          <div className="flex-1">
            <HealthPresentation stage={stage} summary={summary} scale={scale} votes={votes} dimensionCount={dimensions.length} planCreated={!!record} onPlan={openPlan} />
          </div>
          <div className="flex flex-col px-4 pb-4">
            <StageNav items={PRESENTATION_STAGES} value={stage} onChange={(id) => setStage(id as PresentationStage)} label="Etapas da apresentação" />
            <p className="m-0 mt-2 text-center text-xs text-muted-foreground">Use as setas para trocar de etapa. Cada pessoa navega na própria tela.</p>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-4 md:px-6 md:py-5">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="flex min-w-0 flex-col gap-4 xl:col-span-8">
              <ScoreHero summary={summary} dimensionCount={dimensions.length} />

              <section aria-label="Mapa de sentimento da squad" className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
                <header className="flex flex-wrap items-center gap-3 px-5 pt-5 sm:px-6">
                  <h2 className="m-0 text-base font-bold">Mapa de sentimento da squad</h2>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">{summary.totalVotes} {summary.totalVotes === 1 ? 'voto' : 'votos'}</span>
                </header>
                <TabBar label="Visões do resultado" idPrefix="health-map" tabs={MAP_TABS} value={tab} onChange={setTab} className="mt-3 px-5 sm:px-6" />
                <div id={`health-map-panel-${tab}`} role="tabpanel" aria-labelledby={`health-map-tab-${tab}`} className="px-5 py-5 sm:px-6">
                  {tab === 'freq' && <FrequencyChart stats={summary.stats} scale={scale} />}
                  {tab === 'radar' && <HealthCheckRadarChart stats={summary.stats} currentLabel={title} />}
                  {tab === 'compare' && (
                    <>
                      {(compare.status === 'idle' || compare.status === 'loading') && (
                        <p role="status" className="m-0 flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 motion-safe:animate-spin" strokeWidth={1.5} aria-hidden="true" /> Buscando o radar anterior da squad…
                        </p>
                      )}
                      {compare.status === 'error' && (
                        <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
                          <p className="m-0 text-sm text-muted-foreground">Não foi possível buscar o radar anterior.</p>
                          <ModalButton className="gap-2" onClick={() => void loadCompare()}><RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Tentar de novo</ModalButton>
                        </div>
                      )}
                      {compare.status === 'none' && (
                        <p className="m-0 rounded-xl border border-dashed border-border px-5 py-12 text-center text-sm text-muted-foreground">
                          {board.team ? 'Ainda não há um radar anterior da squad com perguntas em comum para comparar.' : 'Este radar não tem squad, então não há um radar anterior para comparar.'}
                        </p>
                      )}
                      {compare.status === 'ready' && (
                        <div className="flex flex-col gap-5">
                          {commonStats.length >= 3 && <HealthCheckRadarChart stats={commonStats} previous={previous} currentLabel={title} height={340} />}
                          <div className="flex flex-col gap-2">
                            <p className="m-0 text-[13px] text-muted-foreground">{title} contra {compare.label}, pelas dimensões em comum.</p>
                            <ul className="m-0 flex list-none flex-col gap-1 p-0">
                              {compare.diffs.map((d) => (
                                <li key={d.key} className="flex items-center gap-3 rounded-lg px-1 py-1 text-sm">
                                  <span className="min-w-0 flex-1 truncate font-semibold">{d.title}</span>
                                  <span className="tabular-nums text-muted-foreground">{formatScore(d.before)} → {formatScore(d.after)}</span>
                                  <span className={cn('w-12 text-right font-bold tabular-nums', d.delta > 0.049 ? 'text-emerald-700 dark:text-emerald-300' : d.delta < -0.049 ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground')}>
                                    {d.delta > 0.049 ? '+' : d.delta < -0.049 ? '−' : ''}{formatScore(Math.abs(d.delta))}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            {compare.diffs.length === 0 && <p className="m-0 text-sm text-muted-foreground">As perguntas em comum não têm respostas nos dois radares.</p>}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            </div>

            <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
              <AboutCard rows={aboutRows} />
              <StrongCard stats={summary.strong} />
              <AttentionCard stats={summary.attention} />
              <FocusCard focus={summary.focus} planCreated={!!record} onPlan={openPlan} />
            </div>
          </div>

          <section aria-label="Detalhamento por dimensão" className="flex flex-col gap-4 pb-8">
            <div className="flex items-center gap-4">
              <span className="h-px flex-1 bg-border" />
              <h2 className="m-0 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Detalhamento por dimensão</h2>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {sortedDetail.map(({ s, i }) => <DimensionDetail key={s.key} stat={s} index={i} scale={scale} votes={votes} />)}
            </div>
          </section>
        </div>
      )}

      <HealthExportDialog open={exportOpen} onOpenChange={setExportOpen} report={report} />
      <HealthPlanDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        radarId={boardId}
        radarTitle={title}
        team={board.team ?? ''}
        items={items}
        record={record}
        onRecord={onRecord}
        deps={deps}
        onOpenPlan={(id) => router.push(`/action-plan/${id}`)}
        onOpenKanban={() => router.push('/workspace?aba=kanban')}
      />
    </HealthRoomShell>
  );
}
