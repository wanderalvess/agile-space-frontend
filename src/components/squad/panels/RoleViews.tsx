'use client';

// Os seis painéis por papel que moram dentro do painel único: Execução, Product Owner, Agile Master, People Lead,
// Tech Lead e (em TriboView) a Tribo. Cada um recebe os dados já carregados e só desenha.
import * as React from 'react';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, ArrowRight, Bug, CalendarClock, ListTodo, ShieldAlert, Users2 } from 'lucide-react';
import { BRAND_TEXT, StatusChip } from '@/components/room-kit';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import type { SquadDashboardData } from '@/hooks/useSquadDashboardData';
import { CEREMONY_DAY_LABEL } from '@/lib/ceremony-schedule';
import { cn } from '@/lib/utils';
import type { CeremonyDayOfWeek, SquadConfig } from '@/lib/types';
import {
  BarsCard,
  DonutCard,
  EstimateTag,
  GaugeCard,
  INK,
  IssueRow,
  IssueStatusPill,
  KpiTile,
  NoDataCard,
  PanelCard,
} from './PanelWidgets';
import { WorkloadChart } from './WorkloadChart';
import {
  buildExecution,
  buildProductOwner,
  buildStatusSegments,
  buildTechLead,
  buildWorkload,
  openBugsHint,
  SHORT_LIST,
  type SprintCore,
} from './panel-model';

const GRID_3 = 'grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3';
const GRID_2 = 'grid grid-cols-1 items-stretch gap-5 md:grid-cols-2';
const NO_DATA = 'Sem dados desta squad ainda.';

export interface RoleViewProps {
  data: SquadDashboardData;
  core: SprintCore;
  /** Nome da unidade de estimativa da squad, ou null quando ainda não foi definida. */
  unitLabel: string | null;
  /** Configuração da squad (rituais cadastrados). null = ainda não existe ou não carregou. */
  config: SquadConfig | null;
  configLoading: boolean;
}

const ORDER: CeremonyDayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function describeDays(days: CeremonyDayOfWeek[]): string {
  if (days.length === 5 && ORDER.slice(0, 5).every((d) => days.includes(d))) return 'Seg a Sex';
  if (days.length === 7) return 'Todos os dias';
  return ORDER.filter((d) => days.includes(d)).map((d) => CEREMONY_DAY_LABEL[d]).join(', ');
}

/**
 * Rituais da squad: o que a squad cadastrou (Painel > Próxima cerimônia). Nada de horário inventado: sem cadastro,
 * mostra como configurar.
 */
export function RituaisCard({ config, loading }: { config: SquadConfig | null; loading: boolean }) {
  const ceremonies = config?.ceremonies ?? [];

  let body: React.ReactNode;
  if (loading) {
    body = <p className="text-[13px] text-muted-foreground">Carregando…</p>;
  } else if (config?.ceremonyMode === 'manual' && ceremonies.length > 0) {
    body = (
      <ul className="flex flex-col gap-2.5">
        {ceremonies.map((c) => (
          <li key={c.id} className="flex flex-col rounded-xl border border-border bg-muted/40 px-3 py-2.5">
            <span className="truncate text-[13px] font-bold text-foreground">{c.title}</span>
            <span className="text-xs text-muted-foreground">
              {describeDays(c.daysOfWeek)} às {c.startTime} · {c.durationMinutes} min
            </span>
          </li>
        ))}
      </ul>
    );
  } else {
    const fromGoogle = config?.ceremonyMode !== 'manual' && !!config;
    body = (
      <div className="flex flex-col items-center gap-2 py-3 text-center">
        <CalendarClock className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        <p className="text-[13px] text-muted-foreground">
          {fromGoogle ? 'Os rituais desta squad vêm da agenda do Google de cada pessoa.' : 'Nenhum ritual cadastrado para esta squad.'}
        </p>
        <Link href="/painel" className={cn('text-[13px] font-bold hover:underline', BRAND_TEXT)}>
          {fromGoogle ? 'Ver próxima cerimônia no Painel' : 'Configurar rituais no Painel'}
        </Link>
      </div>
    );
  }
  return <PanelCard title="Rituais da squad">{body}</PanelCard>;
}

// ---------------------------------------------------------------------------------------------------------------------
// Execução (Dev, QA e UX)
// ---------------------------------------------------------------------------------------------------------------------

export function ExecutionView({ data, core, config, configLoading }: RoleViewProps) {
  const m = buildExecution(data.myIssues);
  return (
    <div className={GRID_3}>
      {m.progress === null ? (
        <NoDataCard
          title="Meu progresso na sprint"
          message={core.hasData ? 'Nenhuma tarefa está atribuída a você nesta sprint.' : NO_DATA}
        />
      ) : (
        <GaugeCard title="Meu progresso na sprint" pct={m.progress} description={`${m.done} de ${m.total} tarefas concluídas`} />
      )}
      {m.byStatus.length > 0 ? (
        <BarsCard title="Minhas tarefas por status" items={m.byStatus} />
      ) : (
        <NoDataCard title="Minhas tarefas por status" message="Sem tarefas suas nesta sprint." />
      )}
      <KpiTile
        title="Bugs em aberto"
        value={m.openBugs ?? '—'}
        icon={Bug}
        tone="danger"
        hint={openBugsHint(m.total, m.openBugs)}
      />
      <PanelCard title="Minhas tarefas na sprint (Jira)" className="md:col-span-2">
        {m.tasks.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {m.tasks.map((t) => (
              <IssueRow
                key={t.jiraKey || t.key}
                jiraKey={t.jiraKey || t.key}
                title={t.title || 'Título ainda não sincronizado'}
                meta={`Tipo: ${t.type || 'Sem tipo'} · Responsável: ${t.assigneeName || 'Não atribuído'}`}
                status={<IssueStatusPill issue={t} />}
              />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-[13px] text-muted-foreground">
            <ListTodo className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
            <span>
              {core.hasData
                ? 'Nenhuma tarefa está atribuída a você nesta sprint. Se esperava ver tarefas, confira se o seu nome na equipe bate com o do Jira.'
                : NO_DATA}
            </span>
          </div>
        )}
      </PanelCard>
      <RituaisCard config={config} loading={configLoading} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Product Owner
// ---------------------------------------------------------------------------------------------------------------------

export function ProductOwnerView({ data, core, unitLabel }: RoleViewProps) {
  const m = buildProductOwner(data.issues);
  return (
    <div className="flex flex-col gap-5">
      {unitLabel && (
        <p className="text-sm text-muted-foreground">
          Quanto do escopo combinado foi entregue (Say/Do) e como está o backlog, em <strong className={cn('font-bold', BRAND_TEXT)}>{unitLabel}</strong>.
        </p>
      )}
      <div className={GRID_2}>
        {core.doneRate === null ? (
          <NoDataCard title="Entrega do escopo combinado (Say/Do)" message="Ainda não há itens na sprint para medir a entrega." />
        ) : (
          <GaugeCard
            title="Entrega do escopo combinado (Say/Do)"
            pct={core.doneRate}
            description={`Concluídos: ${core.done} de ${core.total} itens da sprint (inclui o que entrou depois do planejamento).`}
          />
        )}
        {m.byType.length > 0 ? (
          <BarsCard title="Escopo por tipo de issue (Jira)" items={m.byType} />
        ) : (
          <NoDataCard title="Escopo por tipo de issue (Jira)" />
        )}
        <KpiTile
          title="Itens em andamento"
          value={core.hasData ? core.inProgress : '—'}
          icon={ListTodo}
          hint={core.hasData ? `${core.toDo} a fazer e ${core.done} concluídos, de ${core.total} itens na sprint.` : NO_DATA}
        />
        <PanelCard
          title="Itens pendentes (podem passar para a próxima sprint)"
          aside={<AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={1.5} aria-hidden="true" />}
        >
          {m.pending.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {m.pending.map((iss) => (
                <IssueRow
                  key={iss.jiraKey || iss.key}
                  jiraKey={iss.jiraKey || iss.key}
                  title={iss.title || 'Título ainda não sincronizado'}
                  meta={`Tipo: ${iss.type || 'Sem tipo'} · Responsável: ${iss.assigneeName || 'Não atribuído'}`}
                  status={<IssueStatusPill issue={iss} />}
                />
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              {core.hasData ? 'Nenhum item pendente com risco de carry-over.' : NO_DATA}
            </p>
          )}
        </PanelCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Agile Master
// ---------------------------------------------------------------------------------------------------------------------

export function AgileMasterView({ core }: RoleViewProps) {
  const segments = buildStatusSegments(core);
  return (
    <div className={GRID_2}>
      {core.doneRate === null ? (
        <NoDataCard title="Itens entregues na sprint" message="Ainda não há itens na sprint." />
      ) : (
        <GaugeCard
          title="Itens entregues na sprint"
          pct={core.doneRate}
          description={`${core.done} de ${core.total} histórias/itens concluídos na sprint.`}
        />
      )}
      <DonutCard
        title="Status das histórias (Jira)"
        items={segments}
        label={`Status das histórias: ${core.done} concluídas, ${core.inProgress} em andamento, ${core.toDo} a fazer`}
        center={core.doneRate === null ? undefined : `${core.doneRate}%`}
        emptyMessage="Ainda não há itens na sprint."
      />
      <KpiTile
        title="Bugs na sprint"
        value={core.hasData ? core.bugs : '—'}
        icon={AlertCircle}
        tone="danger"
        hint={
          !core.hasData
            ? NO_DATA
            : `${core.bugs > 0 ? `${core.bugs} ${core.bugs === 1 ? 'bug reportado' : 'bugs reportados'} na sprint.` : 'Nenhum bug na sprint.'} Impedimentos não são lidos do Jira.`
        }
      />
      <PanelCard title="Plano de ação das retrospectivas">
        <p className="text-sm text-muted-foreground">
          As ações combinadas nas retrospectivas ficam no Plano de ação, cada uma com responsável e prazo.
        </p>
        <Link href="/action-plan" className={cn('inline-flex items-center gap-1.5 self-start text-sm font-bold hover:underline', BRAND_TEXT)}>
          Abrir o Plano de ação
          <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </PanelCard>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// People Lead
// ---------------------------------------------------------------------------------------------------------------------

export function PeopleLeadView({ data }: RoleViewProps) {
  const rows = buildWorkload(data.members, data.issues);
  const shown = data.members.slice(0, SHORT_LIST.roles);
  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
      <PanelCard title="Carga de trabalho e capacidade" className="lg:col-span-2">
        <p className="text-[13px] text-muted-foreground">
          Horas estimadas no Jira para as tarefas de cada pessoa, ao lado da capacidade da semana (horas por dia × 5). Tarefas sem estimativa no Jira não entram na conta, e quem não tem horas por dia cadastradas fica sem barra de capacidade.
        </p>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma pessoa no time ainda. Cadastre as pessoas em{' '}
            <Link href="/squad/roster" className={cn('font-semibold hover:underline', BRAND_TEXT)}>Pessoas do time</Link>.
          </p>
        ) : (
          <WorkloadChart rows={rows} />
        )}
      </PanelCard>
      <div className="flex flex-col gap-5">
        <KpiTile
          title="Pessoas ativas no time"
          value={data.members.length}
          icon={Users2}
          hint="Membros registrados na squad atual."
        />
        <PanelCard title="Papéis do time">
          {shown.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {shown.map((m) => (
                <li key={m.jiraAccountId || m.dbId} className="flex items-center justify-between gap-2 border-b border-border pb-2 text-[13px] last:border-b-0 last:pb-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <InitialsAvatar name={m.displayName} email={m.email} className="h-7 w-7 text-xs" />
                    <span className="truncate font-semibold text-foreground">{m.displayName || m.jiraAccountId}</span>
                  </span>
                  <StatusChip className="shrink-0">{m.role || 'Membro'}</StatusChip>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-3 text-center text-[13px] text-muted-foreground">Nenhuma pessoa no time ainda.</p>
          )}
          {data.members.length > shown.length && (
            <Link href="/squad/roster" className={cn('inline-flex items-center gap-1.5 self-start text-[13px] font-bold hover:underline', BRAND_TEXT)}>
              Ver as {data.members.length} pessoas
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          )}
        </PanelCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Tech Lead
// ---------------------------------------------------------------------------------------------------------------------

const DEBT_HINT = 'Contado pelas palavras debt, refactor ou débito no título da issue. A contagem exata depende de um campo do Jira que ainda não é sincronizado.';
const QUEUE_HINT = 'Contado pelo texto do status (review, qa, test), entre as tarefas que ainda não foram concluídas.';

export function TechLeadView({ data, core }: RoleViewProps) {
  const m = buildTechLead(data.issues, core.bugs, core.total);
  return (
    <div className={GRID_3}>
      <DonutCard
        title="Onde o esforço está"
        items={m.effort.map((s) => (s.label === 'Débito técnico' ? { ...s, label: 'Débito técnico (pelo título)', hint: DEBT_HINT } : s))}
        label={`Esforço: ${m.features} funcionalidades, ${core.bugs} bugs, ${m.techDebt} de débito técnico`}
        footer={
          <div className="flex justify-center">
            <EstimateTag hint={DEBT_HINT}>Débito técnico estimado pelo título</EstimateTag>
          </div>
        }
      />
      <PanelCard title="Onde as entregas estão travando" className="md:col-span-1 xl:col-span-2" aside={<EstimateTag hint={QUEUE_HINT} />}>
        <div className="flex flex-col items-stretch gap-3.5 sm:flex-row">
          <QueueTile label="Esperando Code Review" count={m.waitingReview} pct={m.reviewPct} />
          <QueueTile label="Em QA ou homologação" count={m.inQa} pct={m.qaPct} />
        </div>
      </PanelCard>
      <KpiTile
        title="Bugs na sprint"
        value={core.hasData ? core.bugs : '—'}
        icon={ShieldAlert}
        tone="danger"
        hint={
          !core.hasData
            ? NO_DATA
            : core.bugs > 0
              ? `${core.bugs} ${core.bugs === 1 ? 'bug reportado' : 'bugs reportados'} na sprint.`
              : 'Nenhum bug na sprint.'
        }
      />
      <PanelCard title="Carga de cada pessoa" className="md:col-span-1 xl:col-span-2">
        {m.people.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {m.people.map((p) => (
              <li key={p.name} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 text-[13px] font-semibold">
                  <span className="flex min-w-0 items-center gap-2">
                    <InitialsAvatar name={p.name} className="h-6 w-6 text-xs" />
                    <span className="truncate text-foreground">{p.name}</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {p.count} {p.count === 1 ? 'tarefa' : 'tarefas'}
                  </span>
                </div>
                <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-md bg-border">
                  <span className={cn('block h-full rounded-md bg-current', INK.brand)} style={{ width: `${p.pct}%` }} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-[13px] text-muted-foreground">Nenhum membro com tarefas atribuídas na sprint atual.</p>
        )}
      </PanelCard>
    </div>
  );
}

function QueueTile({ label, count, pct }: { label: string; count: number; pct: number }) {
  return (
    <div className="flex flex-1 flex-col gap-1.5 rounded-[14px] border border-border bg-muted/40 p-4">
      <span className="text-[13px] font-bold text-muted-foreground">{label}</span>
      <b className="text-[22px] text-foreground">
        {count} {count === 1 ? 'tarefa' : 'tarefas'}
      </b>
      <span aria-hidden="true" title="Parte das tarefas da sprint" className="h-2.5 overflow-hidden rounded-md bg-border">
        <span className={cn('block h-full rounded-md bg-current', INK.brand)} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

