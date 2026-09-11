'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { 
  CalendarRange, RefreshCw, ChevronDown, ChevronRight, User, 
  Layers, CheckCircle2, Clock, PlayCircle, Filter, Search, ArrowRight,
  ShieldCheck, AlertCircle, FileText, Calendar as CalendarIcon, SlidersHorizontal,
  Bookmark, CornerDownRight, GitCommit, GitPullRequest, CheckSquare, Sparkles,
  FolderTree, ListTree, Bug, Zap, AlertTriangle, ArrowRightCircle, X,
  ZoomIn, ZoomOut, GripVertical, RotateCcw, Code2, Bot, FlaskConical, FileCheck,
  Wrench, Terminal, Cpu, CheckCheck, Flame, ShieldAlert, Percent, Activity, Scale,
  FileCode, TestTube2, Workflow
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSquadStore } from '@/store/useSquadStore';
import type { SquadIssueSnapshot, SquadWorkflowPhase } from '@/lib/types';
import { isWeekend } from '@/lib/date-utils';

export interface PlansTask {
  id: string;
  jiraKey: string;
  title: string;
  type: string;
  status: string;
  statusCategory?: 'new' | 'indeterminate' | 'done' | 'unknown';
  assigneeName: string;
  assigneeAvatar?: string;
  targetStart: string; // ISO date 'YYYY-MM-DD' or ''
  targetEnd: string;   // ISO date 'YYYY-MM-DD' or ''
  // true = targetStart/targetEnd caiu em fallback (dueDate/created/updated),
  // não é data de plano real — cascata/inferência tratam isso com mais cautela.
  datesAreInferred?: boolean;
  // Posição entre as subtarefas da mesma história, vinda da ordem de rank do
  // Jira (fields.subtasks) — desempate de ordem de fase quando duas fases
  // caem na mesma data planejada.
  orderIndex?: number;
  remainingSec?: number; // tempo restante (Jira `timeestimate`) — sinal de "sobrou mais trabalho que tempo"
  updatedAtJira?: string; // última edição no Jira (comentário, label, etc.) — usado só pra staleSinceDays
  resolutionDate?: string; // Jira `resolutiondate` — só muda 1x ao resolver/fechar; usado por inferSlip pra "concluiu atrasado"
  parentKey?: string;
  parentTitle?: string;
  parentStatus?: string;
  parentAssignee?: string;
  isParent?: boolean;
  isBug?: boolean;
  progressPercent?: number;
  estimatesDays?: number;
  sprint?: string;
}

function squadIssueToPlansTask(snapshot: SquadIssueSnapshot): PlansTask {
  const jiraKey = snapshot.jiraKey || snapshot.key;
  return {
    id: jiraKey,
    jiraKey,
    title: snapshot.title || jiraKey,
    type: snapshot.type || '',
    status: snapshot.status || '',
    statusCategory: snapshot.statusCategory,
    assigneeName: snapshot.assigneeName || '',
    targetStart: snapshot.targetStart || snapshot.dueDate || '',
    targetEnd: snapshot.targetEnd || snapshot.dueDate || '',
    datesAreInferred: snapshot.datesAreInferred,
    orderIndex: snapshot.orderIndex,
    remainingSec: snapshot.remainingSec,
    updatedAtJira: snapshot.updatedAtJira || undefined,
    resolutionDate: snapshot.resolutionDate || undefined,
    parentKey: snapshot.parentKey || undefined,
    parentTitle: snapshot.parentTitle || undefined,
    isParent: !snapshot.parentKey,
    isBug: snapshot.isBug,
    sprint: snapshot.sprintName || undefined,
  };
}

// Normaliza issuetype pra comparação: minúsculo, sem acento, sem espaço nas
// pontas. Classificação usa SÓ fields.issuetype.name (vindo em `type`) —
// NUNCA o título, que é texto livre e gera falso-positivo (ex: subtarefa de
// Codificação chamada "Ajustar rotina de notificação" tem "ti" dentro da
// palavra "notificação", não é Execução de TI).
function normalizeIssueType(type?: string): string {
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

// Match de palavra inteira — evita token curto ('ti', 'qa', 'dev') colando
// dentro de outra palavra (ex: 'automatizados' contém 'ti' em "automa-ti-zados").
function hasWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`).test(text);
}

export function getIssueTypeBadge(type?: string, isParent?: boolean, isBug?: boolean) {
  const normType = normalizeIssueType(type);

  // 1. Legislação / Fiscal
  if (normType.includes('legisla')) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[9px] font-bold shrink-0" title="Legislação">
        <Scale className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
        <span>Legislação</span>
      </span>
    );
  }

  // 2. Débito Técnico
  if (normType.includes('debito')) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-50 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-300 dark:border-orange-800 text-[9px] font-bold shrink-0" title="Débito Técnico">
        <FileCode className="w-2.5 h-2.5 text-orange-600 dark:text-orange-400" />
        <span>Débito Técnico</span>
      </span>
    );
  }

  // 3. Teste Sistêmico / Transição
  if (normType.includes('sistemico') || normType.includes('regressivo') || normType.includes('service transition')) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-300 dark:border-teal-800 text-[9px] font-bold shrink-0" title="Teste Sistêmico">
        <TestTube2 className="w-2.5 h-2.5 text-teal-600 dark:text-teal-400" />
        <span>Teste Sistêmico</span>
      </span>
    );
  }

  // 4. Manutenção / Sustentação
  if (normType.includes('manuten') || normType.includes('sustenta')) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[9px] font-bold shrink-0" title="Manutenção">
        <Wrench className="w-2.5 h-2.5 text-amber-700 dark:text-amber-400" />
        <span>Manutenção</span>
      </span>
    );
  }

  // 5. História Pai
  if (isParent || normType.includes('story') || normType.includes('historia')) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[9px] font-bold shrink-0" title="História Pai">
        <Bookmark className="w-2.5 h-2.5 fill-current text-emerald-600 dark:text-emerald-400" />
        <span>Story</span>
      </span>
    );
  }

  // 6. Bug / Defeito — prioriza o isBug já calculado no sync (mesma regra de
  // isBugType em useSquadStore.ts); só recai pro tipo se isBug não foi informado.
  if (isBug ?? (hasWord(normType, 'bug') || hasWord(normType, 'defeito') || hasWord(normType, 'erro'))) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[9px] font-bold shrink-0" title="Bug / Defeito">
        <Bug className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
        <span>Bug</span>
      </span>
    );
  }

  // 7. Testes Automatizados / Unitários — ANTES de "Execução de TI" de
  // propósito: "automatizados" contém a substring "ti" (automa-TI-zados), e
  // um match solto de TI roubaria esse tipo (bug real, achado 2026-09).
  if (normType.includes('automatiz') || normType.includes('unitario')) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[9px] font-bold shrink-0" title="Testes Automatizados">
        <Bot className="w-2.5 h-2.5 text-teal-600 dark:text-teal-400" />
        <span>Testes Auto</span>
      </span>
    );
  }

  // 8. Execução de TI — "ti" é token curto, exige palavra inteira (senão
  // casa com qualquer tipo que tenha "ti" no meio, ex: "Manutenção").
  if (hasWord(normType, 'ti') || normType.includes('execucao')) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[9px] font-bold shrink-0" title="Execução de TI">
        <Terminal className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
        <span>Execução de TI</span>
      </span>
    );
  }

  // 9. Teste QA / Homologação
  if (hasWord(normType, 'qa') || normType.includes('teste') || normType.includes('homologacao')) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[9px] font-bold shrink-0" title="Teste QA">
        <CheckCircle2 className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
        <span>Teste QA</span>
      </span>
    );
  }

  // 10. Codificação / DEV
  if (normType.includes('codifica') || normType.includes('desenvolv') || hasWord(normType, 'dev')) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[9px] font-bold shrink-0" title="Codificação (DEV)">
        <Code2 className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
        <span>Codificação</span>
      </span>
    );
  }

  // Default Sub-task
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[9px] font-bold shrink-0" title="Sub-task">
      <CornerDownRight className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
      <span>Sub-task</span>
    </span>
  );
}

function getDisciplineColorAndLabel(task: PlansTask) {
  // Tipo só — igual a getIssueTypeBadge, mesmo motivo (título é texto livre,
  // gera falso-positivo tipo "Investigação" casando com "ti" de Execução TI).
  const normType = normalizeIssueType(task.type);
  if (normType.includes('review') || normType.includes('revisao')) {
    return {
      bg: 'bg-purple-600 dark:bg-purple-500',
      label: 'Code Review',
      shortLabel: 'Review',
      matched: true,
    };
  }
  // Automatizados ANTES de QA/TI — mesma razão de getIssueTypeBadge.
  if (normType.includes('automatiz') || normType.includes('unitario')) {
    return {
      bg: 'bg-teal-600 dark:bg-teal-500',
      label: 'Testes Auto',
      shortLabel: 'Auto',
      matched: true,
    };
  }
  if (hasWord(normType, 'qa') || normType.includes('teste')) {
    return {
      bg: 'bg-amber-600 dark:bg-amber-500',
      label: 'Teste QA',
      shortLabel: 'QA',
      matched: true,
    };
  }
  if (hasWord(normType, 'ti') || normType.includes('execucao') || normType.includes('acompanhamento')) {
    return {
      bg: 'bg-indigo-600 dark:bg-indigo-500',
      label: 'Execução TI',
      shortLabel: 'TI',
      matched: true,
    };
  }
  // Default — tipo não reconhecido (ex: "Sub-task" genérico, comum em várias
  // instâncias Jira). `matched: false` avisa resolveWorkflowPhase que isto é
  // um chute visual (DEV azul), NÃO uma classificação real — sem essa
  // distinção, resolveWorkflowPhase usava DEFAULT_PHASE_ORDER['DEV']=0 pra
  // tipo desconhecido e ele ordenava PRIMEIRO na cascata, corrompendo a
  // sequência de fases de qualquer história com subtarefa de tipo genérico.
  return {
    bg: 'bg-blue-600 dark:bg-blue-500',
    label: 'Codificação',
    shortLabel: 'DEV',
    matched: false,
  };
}

// Ordem-padrão do workflow quando o squad não configurou SquadConfig.phases
// ainda — mesmas 5 disciplinas de getDisciplineColorAndLabel, na sequência
// comum (codifica -> automatizado junto -> code review -> QA -> TI).
const DEFAULT_PHASE_ORDER: Record<string, number> = { DEV: 0, Auto: 1, Review: 2, QA: 3, TI: 4 };

// Legenda pra quando o squad não configurou SquadConfig.phases — mesmas
// cores de getDisciplineColorAndLabel, na ordem do workflow padrão.
const DEFAULT_PHASE_LEGEND = [
  { label: 'Codificação', bg: 'bg-blue-600 dark:bg-blue-500' },
  { label: 'Testes Auto', bg: 'bg-teal-600 dark:bg-teal-500' },
  { label: 'Code Review', bg: 'bg-purple-600 dark:bg-purple-500' },
  { label: 'Teste QA', bg: 'bg-amber-600 dark:bg-amber-500' },
  { label: 'Execução TI', bg: 'bg-indigo-600 dark:bg-indigo-500' },
];

// Resolve fase de workflow (cor/rótulo/ordem) de uma subtarefa: prioriza o
// mapeamento configurado no squad (SquadConfig.phases, ordem do array =
// ordem da fase); cai pra heurística por tipo quando a config não cobre esse
// tipo ou o squad ainda não configurou nada.
function resolveWorkflowPhase(
  task: PlansTask,
  phases?: SquadWorkflowPhase[]
): { label: string; bg: string; shortLabel: string; order: number } {
  if (phases && phases.length > 0) {
    const normType = normalizeIssueType(task.type);
    const idx = phases.findIndex(p => p.issueTypes.some(it => normalizeIssueType(it) === normType));
    if (idx >= 0) {
      const p = phases[idx];
      return { label: p.label, bg: p.color, shortLabel: p.kind, order: idx };
    }
  }
  const disc = getDisciplineColorAndLabel(task);
  // disc.matched=false = tipo não reconhecido por nenhuma regra (não
  // necessariamente DEV de verdade) — ordena por ÚLTIMO (99), não herda a
  // ordem 0 do fallback visual "DEV". Ver comentário no default de
  // getDisciplineColorAndLabel.
  const order = disc.matched ? (DEFAULT_PHASE_ORDER[disc.shortLabel] ?? 99) : 99;
  return { ...disc, order };
}

type InferredSlip = {
  days: number; // dias úteis de atraso inferido (0 = nada detectado)
  reason: 'none' | 'overdue' | 'not-started' | 'remaining-work' | 'finished-late';
  confidence: 'observed' | 'presumed'; // observed = data/status que já aconteceu; presumed = heurística
};

// Detecta atraso de uma fase sem depender de alguém atualizar o Jira na mão
// — a dor original: "se dev atrasa e não atualiza manualmente, não
// conseguimos saber". 4 sinais, do mais forte ao mais fraco:
//  1. já devia ter fechado (status != done, fim planejado no passado)
//  2. já devia ter começado (status = new, início planejado no passado)
//  3. concluiu, mas depois do prazo (updatedAtJira como proxy de data real
//     de conclusão — snapshot não guarda uma data de "fechou em" separada)
//  4. sobrou mais trabalho (Jira "tempo restante") do que sobra tempo até o
//     prazo — mais fraco, por isso 'presumed'
// Sempre 0 quando a data-alvo é fallback fabricado (datesAreInferred) —
// declarar atraso sobre prazo inventado é pior que não declarar nada.
// `!== false` (não `if (task.datesAreInferred)`) de propósito: a coluna é
// nova e nasceu sem backfill, então todo snapshot já existente lê `null`/
// `undefined` até o próximo sync — falha-seguro trata "não sei" como
// "fabricado", não como "real".
function inferSlip(task: PlansTask, todayIso: string): InferredSlip {
  if (task.datesAreInferred !== false) return { days: 0, reason: 'none', confidence: 'presumed' };

  if (task.statusCategory === 'done') {
    // resolutionDate (Jira `resolutiondate`) só muda 1x, ao fechar —
    // updatedAtJira muda a QUALQUER edição (comentário, label, etc.), então
    // um typo corrigido semanas depois de fechado gerava atraso fantasma.
    // Sem resolutionDate (linha ainda não ressincronizada com o campo novo),
    // não arrisca: sem sinal é melhor que sinal errado.
    if (task.targetEnd && task.resolutionDate) {
      const finishedIso = task.resolutionDate.substring(0, 10);
      const days = businessDaysBetween(task.targetEnd, finishedIso);
      if (days > 0) return { days, reason: 'finished-late', confidence: 'observed' };
    }
    return { days: 0, reason: 'none', confidence: 'observed' };
  }

  if (task.targetEnd && task.targetEnd < todayIso) {
    const days = businessDaysBetween(task.targetEnd, todayIso);
    if (days > 0) return { days, reason: 'overdue', confidence: 'observed' };
  }

  if (task.statusCategory === 'new' && task.targetStart && task.targetStart < todayIso) {
    const days = businessDaysBetween(task.targetStart, todayIso);
    if (days > 0) return { days, reason: 'not-started', confidence: 'observed' };
  }

  if (task.remainingSec && task.remainingSec > 0 && task.targetEnd) {
    const daysLeft = Math.max(0, businessDaysBetween(todayIso, task.targetEnd));
    const remainingDays = task.remainingSec / (8 * 3600);
    if (remainingDays > daysLeft) {
      return { days: Math.ceil(remainingDays - daysLeft), reason: 'remaining-work', confidence: 'presumed' };
    }
  }

  return { days: 0, reason: 'none', confidence: 'observed' };
}

function computeTaskProgress(task: PlansTask): number {
  if (task.progressPercent !== undefined && task.progressPercent !== null) {
    return Math.round(task.progressPercent);
  }
  const norm = (task.status || '').toUpperCase();
  if (norm === 'CONCLUÍDO' || norm === 'DONE' || norm === 'CLOSED') return 100;
  if (norm === 'CODE REVIEW CONCLUÍDO' || norm === 'EM TESTE DE ACEITAÇÃO' || norm === 'EM CODE REVIEW') return 75;
  if (norm === 'EM ANDAMENTO' || norm === 'IN PROGRESS' || norm === 'EM DESENVOLVIMENTO') return 50;
  return 0;
}

function computeParentProgress(parent: PlansTask, children: PlansTask[]): number {
  if (parent.progressPercent !== undefined && parent.progressPercent > 0) {
    return Math.round(parent.progressPercent);
  }
  if (!children || children.length === 0) return 0;
  const total = children.reduce((acc, c) => acc + computeTaskProgress(c), 0);
  return Math.round(total / children.length);
}

function getStatusBadge(status: string) {
  const norm = (status || '').toUpperCase();
  if (norm === 'CONCLUÍDO' || norm === 'DONE' || norm === 'CLOSED') {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 text-[9px] uppercase font-bold px-1.5 py-0.5">
        Closed
      </Badge>
    );
  }
  if (norm.includes('CODE REVIEW') || norm.includes('ACEITAÇÃO') || norm.includes('REVIEW')) {
    return (
      <Badge className="bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 text-[9px] uppercase font-bold px-1.5 py-0.5 whitespace-nowrap">
        {status}
      </Badge>
    );
  }
  if (norm === 'EM ANDAMENTO' || norm === 'IN PROGRESS' || norm === 'EM DESENVOLVIMENTO') {
    return (
      <Badge className="bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 text-[9px] uppercase font-bold px-1.5 py-0.5 whitespace-nowrap">
        Em Andamento
      </Badge>
    );
  }
  if (norm === 'COMPROMETIDO') {
    return (
      <Badge className="bg-slate-900 text-white dark:bg-slate-700 dark:text-slate-100 border-none text-[9px] uppercase font-bold px-1.5 py-0.5 whitespace-nowrap">
        Comprometido
      </Badge>
    );
  }
  return (
    <Badge className="bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 text-[9px] uppercase font-bold px-1.5 py-0.5 whitespace-nowrap">
      Open
    </Badge>
  );
}

function formatDateShort(isoDate: string): string {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length < 3) return isoDate;
  const day = parts[2];
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthIdx = parseInt(parts[1], 10) - 1;
  return `${day}/${months[monthIdx] || parts[1]}`;
}

function addDaysToIso(isoDate: string, days: number): string {
  if (!isoDate || days === 0) return isoDate;
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d.getTime())) return isoDate;
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Soma dias ÚTEIS (pula sáb/dom) — cascata e inferência de atraso usam
// SEMPRE dia útil (plano seg->ter não pode virar sáb->dom só porque a conta
// foi em dia corrido). addDaysToIso continua existindo pra calendário corrido.
function addBusinessDays(isoDate: string, days: number): string {
  if (!isoDate || days === 0) return isoDate;
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d.getTime())) return isoDate;
  const step = days > 0 ? 1 : -1;
  let remaining = Math.abs(days);
  while (remaining > 0) {
    d.setDate(d.getDate() + step);
    if (!isWeekend(d)) remaining--;
  }
  // getLocalDateStr (não toISOString) — .toISOString() converte pra UTC, e
  // meia-noite local num fuso positivo (UTC+1 ou mais) vira o dia UTC
  // ANTERIOR, devolvendo a data errada pra quem não está no fuso do Brasil.
  return getLocalDateStr(d);
}

// Diferença em dias ÚTEIS entre duas datas ISO (endIso - startIso), com
// sinal: positivo quando endIso é depois de startIso. 0 se alguma data for
// inválida/vazia. Uso padrão: businessDaysBetween(prazo, hoje) > 0 = atrasado.
function businessDaysBetween(startIso: string, endIso: string): number {
  if (!startIso || !endIso) return 0;
  const start = new Date(startIso + 'T00:00:00');
  const end = new Date(endIso + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  const sign = end.getTime() >= start.getTime() ? 1 : -1;
  let count = 0;
  const cur = new Date(start);
  while (cur.getTime() !== end.getTime()) {
    cur.setDate(cur.getDate() + sign);
    if (!isWeekend(cur)) count += sign;
  }
  return count;
}

// Empacota as fases de uma história na menor quantidade de faixas horizontais
// possível: duas fases só dividem faixa quando as datas efetivas realmente se
// cruzam (ex: atraso em cascata empurrou uma por cima da outra). Sequência
// normal, sem sobreposição, fica tudo numa linha só — efeito de "linha
// contínua" por história.
function packChildrenIntoTracks(
  children: PlansTask[],
  computeEffectiveDates: (task: PlansTask) => { start: string; end: string }
): { trackOf: Map<string, number>; totalTracks: number } {
  const withDates = children
    .map(task => ({ task, ...computeEffectiveDates(task) }))
    .sort((a, b) => a.start.localeCompare(b.start));

  const trackEnds: string[] = [];
  const trackOf = new Map<string, number>();

  for (const { task, start, end } of withDates) {
    let track = trackEnds.findIndex(lastEnd => lastEnd <= start);
    if (track === -1) {
      track = trackEnds.length;
      trackEnds.push(end);
    } else {
      trackEnds[track] = end;
    }
    trackOf.set(task.id, track);
  }

  return { trackOf, totalTracks: Math.max(1, trackEnds.length) };
}

const DEFAULT_COL_WIDTHS = {
  issue: 330,
  timeline: 140, // Monday.com Timeline pill column
  progress: 110, // Monday.com Progress column
  status: 115,
  assignee: 120,
  dayWidth: 54,
};

function getLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function timeAgo(iso?: string): string {
  if (!iso) return 'nunca';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return 'nunca';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

export function SquadPlansTimeline() {
  const { toast } = useToast();
  const { issuesSnapshot, viewingSprintId, viewedIssuesSnapshot, rollup, viewedRollup, config, isSyncing } = useSquadStore();

  const activeIssues = viewingSprintId ? viewedIssuesSnapshot : issuesSnapshot;
  const activeRollup = viewingSprintId ? viewedRollup : rollup;

  const tasks = useMemo(() => activeIssues.map(squadIssueToPlansTask), [activeIssues]);

  const today = new Date();
  const todayIso = getLocalDateStr(today);

  const sprintWindow = useMemo(() => {
    const meta = activeRollup?.extraMetrics as Record<string, unknown> | undefined;
    const start = (meta?.activeSprintStart as string) || '';
    const end = (meta?.activeSprintEnd as string) || '';
    if (start && end) {
      const s = start.includes('T') ? start.substring(0, 10) : start;
      const e = end.includes('T') ? end.substring(0, 10) : end;
      return { start: s, end: e };
    }
    const fallbackEnd = new Date(today);
    fallbackEnd.setDate(fallbackEnd.getDate() + 13);
    return { start: todayIso, end: getLocalDateStr(fallbackEnd) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRollup, todayIso]);

  const [colWidths, setColWidths] = useState(DEFAULT_COL_WIDTHS);
  const [hierarchyLevel, setHierarchyLevel] = useState<'story-to-subtask' | 'subtask-only' | 'story-only'>('story-to-subtask');
  const [groupBy, setGroupBy] = useState<'assignee' | 'parent'>('parent');

  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');

  // Simulação de atraso é por tarefa: só uma fase por vez pode estar "ativa";
  // a cascata atinge apenas as fases seguintes da MESMA história, não o board inteiro.
  const [activeDelayTaskId, setActiveDelayTaskId] = useState<string | null>(null);
  const [activeDelayDays, setActiveDelayDays] = useState<number>(0);
  const [openDelayPickerFor, setOpenDelayPickerFor] = useState<string | null>(null);

  const [presetPeriod, setPresetPeriod] = useState('SPRINT_CURRENT');
  const [startDate, setStartDate] = useState(sprintWindow.start);
  const [endDate, setEndDate] = useState(sprintWindow.end);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({});

  const handlePresetChange = (preset: string) => {
    setPresetPeriod(preset);
    if (preset === 'SPRINT_CURRENT') {
      setStartDate(sprintWindow.start);
      setEndDate(sprintWindow.end);
    } else if (preset === 'NEXT_14_DAYS') {
      const end = new Date(today);
      end.setDate(end.getDate() + 14);
      setStartDate(todayIso);
      setEndDate(getLocalDateStr(end));
    } else if (preset === 'CURRENT_MONTH') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(getLocalDateStr(first));
      setEndDate(getLocalDateStr(last));
    }
  };

  const daysList = useMemo(() => {
    if (!startDate || !endDate) return [];
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

    const days = [];
    const curr = new Date(start);
    while (curr <= end && days.length <= 31) {
      const iso = curr.toISOString().split('T')[0];
      const dayName = curr.toLocaleDateString('pt-BR', { weekday: 'short' });
      const dayNum = curr.getDate();
      const monthShort = curr.toLocaleDateString('pt-BR', { month: 'short' });
      days.push({ iso, dayName, dayNum, monthShort, isWeekend: curr.getDay() === 0 || curr.getDay() === 6 });
      curr.setDate(curr.getDate() + 1);
    }
    return days;
  }, [startDate, endDate]);

  const startResizing = useCallback((colKey: keyof typeof DEFAULT_COL_WIDTHS, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[colKey];

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const minWidths: Record<string, number> = {
        issue: 160,
        timeline: 90,
        progress: 75,
        status: 75,
        assignee: 75,
        dayWidth: 32,
      };
      const newWidth = Math.max(minWidths[colKey] || 40, startWidth + delta);
      setColWidths(prev => ({ ...prev, [colKey]: newWidth }));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [colWidths]);

  const handleResetColWidths = () => {
    setColWidths(DEFAULT_COL_WIDTHS);
    toast({
      title: "📐 Larguras Restauradas",
      description: "Tamanho das colunas redefinido para o padrão ideal.",
    });
  };

  const handleDayZoom = (delta: number) => {
    setColWidths(prev => ({
      ...prev,
      dayWidth: Math.max(34, Math.min(100, prev.dayWidth + delta))
    }));
  };

  const uniqueAssignees = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => { if (t.assigneeName) set.add(t.assigneeName); });
    return Array.from(set);
  }, [tasks]);

  // Robust filtering that does NOT drop items when dates are empty (preserves all sprint items)
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchesSearch = !searchFilter || 
        t.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        t.jiraKey.toLowerCase().includes(searchFilter.toLowerCase()) ||
        t.assigneeName.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (t.parentKey && t.parentKey.toLowerCase().includes(searchFilter.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || t.status.toUpperCase() === statusFilter.toUpperCase();
      
      const typeStr = (t.type + ' ' + t.title).toLowerCase();
      const matchesType = typeFilter === 'ALL' || typeStr.includes(typeFilter.toLowerCase());

      const matchesAssignee = assigneeFilter === 'ALL' || t.assigneeName === assigneeFilter;

      return matchesSearch && matchesStatus && matchesType && matchesAssignee;
    });
  }, [tasks, searchFilter, statusFilter, typeFilter, assigneeFilter]);

  const hierarchicalStructure = useMemo(() => {
    const parentsMap = new Map<string, { parent: PlansTask; children: PlansTask[] }>();
    const orphanChildren: PlansTask[] = [];

    // 1. Populate all parents
    tasks.forEach(t => {
      if (t.isParent || !t.parentKey) {
        parentsMap.set(t.jiraKey, { parent: t, children: [] });
      }
    });

    // 2. Attach children to parents
    filteredTasks.forEach(t => {
      if (t.parentKey) {
        if (parentsMap.has(t.parentKey)) {
          parentsMap.get(t.parentKey)!.children.push(t);
        } else {
          parentsMap.set(t.parentKey, {
            parent: {
              id: `v-${t.parentKey}`,
              jiraKey: t.parentKey,
              title: t.parentTitle || `Tarefa Pai ${t.parentKey}`,
              type: 'Story',
              status: t.parentStatus || 'Comprometido',
              assigneeName: t.parentAssignee || t.assigneeName,
              targetStart: t.targetStart,
              targetEnd: t.targetEnd,
              datesAreInferred: t.datesAreInferred,
              isParent: true
            },
            children: [t]
          });
        }
      } else if (!t.isParent) {
        orphanChildren.push(t);
      }
    });

    return { parentsMap, orphanChildren };
  }, [tasks, filteredTasks]);

  const groupedData = useMemo(() => {
    const map = new Map<string, PlansTask[]>();

    if (hierarchyLevel === 'subtask-only') {
      const subtasks = filteredTasks.filter(t => !t.isParent && t.parentKey);
      subtasks.forEach(task => {
        const key = groupBy === 'assignee' 
          ? (task.assigneeName || 'Não Atribuído')
          : (task.parentKey ? `${task.parentKey} - ${task.parentTitle || 'Tarefa Pai'}` : 'Sem Tarefa Pai');
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(task);
      });
      return map;
    }

    if (hierarchyLevel === 'story-only') {
      const stories = filteredTasks.filter(t => t.isParent || !t.parentKey);
      stories.forEach(task => {
        const key = groupBy === 'assignee' ? (task.assigneeName || 'Não Atribuído') : `${task.jiraKey} - ${task.title}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(task);
      });
      return map;
    }

    // Default: Pai ➔ Sub-task
    filteredTasks.forEach(task => {
      const key = groupBy === 'assignee' 
        ? (task.assigneeName || 'Não Atribuído')
        : (task.parentKey ? `${task.parentKey}` : `${task.jiraKey}`);
      
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    });
    return map;
  }, [filteredTasks, hierarchyLevel, groupBy]);

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const toggleParent = (parentKey: string) => {
    setCollapsedParents(prev => ({ ...prev, [parentKey]: !prev[parentKey] }));
  };

  // Cascata por história, SEMPRE ativa (não só quando alguém aciona o
  // simulador manual) — resolve a dor original: dev atrasa, não atualiza o
  // Jira na mão, ninguém sabia. Cada fase roda na ordem do workflow
  // (SquadConfig.phases configurado pelo squad, com Jira rank de desempate;
  // sem config, heurística por tipo — ver resolveWorkflowPhase). Pra cada
  // fase, o atraso PRÓPRIO vem do simulador manual quando ligado nela, senão
  // de inferSlip (detecção automática). Esse atraso estica o fim da própria
  // fase e empurra o INÍCIO de todas as fases seguintes na ordem — sempre em
  // dias úteis (seg->ter não pode virar sáb->dom).
  const computeStoryCascade = (parent: PlansTask, children: PlansTask[]) => {
    const baseOf = (t: PlansTask) => ({
      start: t.targetStart || startDate,
      end: t.targetEnd || t.targetStart || endDate,
    });

    type EffectiveDates = {
      start: string; end: string; isDelayed: boolean; delayDays: number;
      isOverdueRisk: boolean; originalDeadline: string; confidence: 'observed' | 'presumed';
    };
    const idle = { isDelayed: false, delayDays: 0, isOverdueRisk: false, confidence: 'observed' as const };

    // Decora com a ORDEM de fase já resolvida (uma vez só) pra poder detectar,
    // no loop abaixo, quando dois irmãos caem no mesmo tier de fase — nesse
    // caso um não deve empurrar o outro (não são sequenciais entre si, só o
    // orderIndex do Jira desempata a exibição); o atraso do tier só propaga
    // pro PRÓXIMO tier de fase, e usa o pior caso (max) do tier, não a soma.
    const ordered = children
      .map(task => ({ task, order: resolveWorkflowPhase(task, config?.phases).order }))
      .sort((a, b) => a.order - b.order || (a.task.orderIndex ?? 0) - (b.task.orderIndex ?? 0));

    const childDates = new Map<string, EffectiveDates>();
    let pushDays = 0;
    let pendingPush = 0;
    let lastOrder: number | null = null;
    for (const { task, order } of ordered) {
      if (lastOrder !== null && order !== lastOrder) {
        pushDays += pendingPush;
        pendingPush = 0;
      }
      lastOrder = order;

      const { start: baseStart, end: baseEnd } = baseOf(task);
      const manualActive = task.id === activeDelayTaskId && activeDelayDays > 0;
      const auto = inferSlip(task, todayIso);
      const ownExtra = manualActive ? activeDelayDays : auto.days;
      const confidence: 'observed' | 'presumed' = manualActive ? 'observed' : auto.confidence;

      const start = pushDays > 0 ? addBusinessDays(baseStart, pushDays) : baseStart;
      const totalShift = pushDays + ownExtra;
      const end = totalShift > 0 ? addBusinessDays(baseEnd, totalShift) : baseEnd;
      const isOverdueRisk = end > baseEnd;
      const isDelayed = pushDays > 0 || ownExtra > 0;

      childDates.set(task.id, { start, end, isDelayed, delayDays: totalShift, isOverdueRisk, originalDeadline: baseEnd, confidence });
      pendingPush = Math.max(pendingPush, ownExtra);
    }
    pushDays += pendingPush; // último tier também propaga (ex: pro cálculo de maxEnd do pai, logo abaixo)

    const parentBase = baseOf(parent);
    let parentDates: EffectiveDates;
    if (pushDays > 0) {
      const maxEnd = [...childDates.values()].reduce((max, d) => (d.end > max ? d.end : max), parentBase.end);
      const isOverdueRisk = maxEnd > parentBase.end;
      // delayDays = gap real entre o fim ORIGINAL do próprio pai e maxEnd —
      // não pushDays (soma bruta dos filhos), que só bate com o que a pílula
      // pStart-pEnd mostra quando o targetEnd do pai coincide com o do último
      // filho (raro: história tem prazo próprio, geralmente com folga).
      const delayDays = businessDaysBetween(parentBase.end, maxEnd);
      parentDates = { start: parentBase.start, end: maxEnd, isDelayed: isOverdueRisk, delayDays, isOverdueRisk, originalDeadline: parentBase.end, confidence: 'observed' };
    } else {
      parentDates = { start: parentBase.start, end: parentBase.end, ...idle, originalDeadline: parentBase.end };
    }

    const getEffectiveDates = (task: PlansTask): EffectiveDates =>
      task.id === parent.id
        ? parentDates
        : childDates.get(task.id) ?? { ...baseOf(task), ...idle, originalDeadline: task.targetEnd || '' };

    return { childDates, parentDates, getEffectiveDates };
  };

  // computeStoryCascade faz sort + inferSlip (loop de dias por filho) — bem
  // mais caro que a conta O(1) de antes. Sem isso, cada história recalculava
  // 2x por render (painel esquerdo + Gantt direito). Uma entrada por
  // parentKey, recalculada só quando algo que afeta a cascata muda.
  const storyCascades = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeStoryCascade>>();
    hierarchicalStructure.parentsMap.forEach(({ parent, children }, parentKey) => {
      map.set(parentKey, computeStoryCascade(parent, children));
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hierarchicalStructure, config?.phases, activeDelayTaskId, activeDelayDays, todayIso, startDate, endDate]);

  const totalTableWidth = colWidths.issue + colWidths.timeline + colWidths.progress + colWidths.status + colWidths.assignee;
  const totalTimelineWidth = daysList.length * colWidths.dayWidth;

  const activeDelayTask = activeDelayTaskId ? tasks.find(t => t.id === activeDelayTaskId) : null;
  const isDelaySimActive = !!activeDelayTask && activeDelayDays > 0;

  return (
    <div className="space-y-4 font-sans">
      {/* Control & Filters Panel */}
      <div className="bg-white dark:bg-slate-900/90 p-4 md:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm backdrop-blur-md space-y-4">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200 dark:border-blue-800/80 shadow-xs">
              <CalendarRange className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 tracking-tight">
                Jira Plans / Cronograma da Sprint
                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 font-bold">
                  {tasks.length} Tarefas Mapeadas
                </Badge>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Visualização oficial completa do Jira Plans: Histórias, Legislações, Débitos Técnicos e Testes Sistêmicos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isDelaySimActive && (
              <div
                className="h-8 pl-2.5 pr-1.5 flex items-center gap-1.5 text-[10px] font-bold text-rose-700 dark:text-rose-300 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 animate-pulse"
                title={`${activeDelayTask!.title} atrasou +${activeDelayDays}d — fases seguintes da mesma história empurradas junto`}
              >
                <Flame className="w-3.5 h-3.5" />
                +{activeDelayDays}d em {activeDelayTask!.jiraKey}
                <button
                  onClick={() => { setActiveDelayTaskId(null); setActiveDelayDays(0); }}
                  className="ml-0.5 p-0.5 rounded-md hover:bg-rose-200 dark:hover:bg-rose-900"
                  title="Limpar simulação"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDayZoom(-6)}
                title="Diminuir largura dos dias (Zoom Out)"
                className="h-7 w-7 p-0 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="text-[10px] font-mono font-bold px-1.5 text-slate-500">
                {colWidths.dayWidth}px/dia
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDayZoom(+6)}
                title="Aumentar largura dos dias (Zoom In)"
                className="h-7 w-7 p-0 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleResetColWidths}
              title="Restaurar tamanho padrão das colunas"
              className="h-8 px-2.5 text-xs rounded-xl font-medium border-slate-200 dark:border-slate-800"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Resetar Colunas
            </Button>

            <div
              className="h-8 px-3 flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
              title="Este cronograma usa o mesmo dado sincronizado da aba Squad Pulse. Use o botão Sincronizar no topo do Hub para atualizar."
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
              {isSyncing ? 'Sincronizando…' : `Sincronizado ${timeAgo(config?.lastSyncAt)}`}
            </div>
          </div>
        </div>

        {/* Legenda de fase — a fita do Gantt (linha da história) identifica
            a fase só pela cor, essa legenda é a chave de leitura. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {(config?.phases && config.phases.length > 0
            ? config.phases.map(p => ({ label: p.label, bg: p.color }))
            : DEFAULT_PHASE_LEGEND
          ).map(p => (
            <div key={p.label} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.bg}`} />
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{p.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-inset ring-rose-500" />
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Além do prazo original</span>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2.5">
          {/* Hierarchy Level Selector */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Hierarquia (Níveis)</label>
            <Select value={hierarchyLevel} onValueChange={(val: any) => setHierarchyLevel(val)}>
              <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl font-medium">
                <ListTree className="w-3.5 h-3.5 mr-1.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl">
                <SelectItem value="story-to-subtask">Pai ➔ Sub-task</SelectItem>
                <SelectItem value="subtask-only">Apenas Sub-tasks</SelectItem>
                <SelectItem value="story-only">Apenas Tarefas Pai</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* GroupBy Mode */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Agrupamento</label>
            <Select value={groupBy} onValueChange={(val: any) => setGroupBy(val)}>
              <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl font-medium">
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl">
                <SelectItem value="parent">Por Tarefa Pai</SelectItem>
                <SelectItem value="assignee">Por Executor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search Filter */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Buscar</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <Input 
                placeholder="Chave ou texto..." 
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="pl-8 h-9 text-xs bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-xl"
              />
            </div>
          </div>

          {/* Issue Type / Specialty Filter */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Tipo / Disciplina</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl font-medium">
                <Bookmark className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl">
                <SelectItem value="ALL">Todos os Tipos</SelectItem>
                <SelectItem value="Story">🟢 História Pai</SelectItem>
                <SelectItem value="Legisla">📜 Legislação</SelectItem>
                <SelectItem value="Débito">🛠️ Débito Técnico</SelectItem>
                <SelectItem value="Sistêmico">🧪 Teste Sistêmico</SelectItem>
                <SelectItem value="Manuten">🔧 Manutenção</SelectItem>
                <SelectItem value="Codifica">💻 Codificação</SelectItem>
                <SelectItem value="TI">⚙️ Execução de TI</SelectItem>
                <SelectItem value="Automatiz">🤖 Testes Automatizados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl font-medium">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl">
                <SelectItem value="ALL">Todos os Status</SelectItem>
                <SelectItem value="Open">Open (Aberto)</SelectItem>
                <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                <SelectItem value="Em Desenvolvimento">Em Desenvolvimento</SelectItem>
                <SelectItem value="Comprometido">Comprometido</SelectItem>
                <SelectItem value="Closed">Closed (Concluído)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assignee Filter */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Executor</label>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl font-medium">
                <User className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <SelectValue placeholder="Executor" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl">
                <SelectItem value="ALL">Todos os Executores</SelectItem>
                {uniqueAssignees.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preset Period Selector */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Período</label>
            <Select value={presetPeriod} onValueChange={handlePresetChange}>
              <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl font-medium">
                <CalendarIcon className="w-3.5 h-3.5 mr-1.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl">
                <SelectItem value="SPRINT_CURRENT">Sprint Atual ({sprintWindow.start} a {sprintWindow.end})</SelectItem>
                <SelectItem value="NEXT_14_DAYS">Próximos 14 Dias</SelectItem>
                <SelectItem value="CURRENT_MONTH">Mês Atual</SelectItem>
                <SelectItem value="CUSTOM">Customizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ══════════ MAIN SPLIT-PANE TIMELINE CONTAINER ══════════ */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950 overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-x-auto">
          <div className="flex min-w-full" style={{ width: `${totalTableWidth + totalTimelineWidth}px` }}>
            
            {/* ══════════ LEFT PANE: RESIZABLE TREE TABLE ══════════ */}
            <div className="shrink-0 border-r-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 select-none" style={{ width: `${totalTableWidth}px` }}>
              {/* Left Header */}
              <div className="flex h-11 bg-slate-100/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 text-[11px] font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider items-stretch">
                
                {/* 1. Column: Issue / Subtarefa */}
                <div className="relative px-3 flex items-center justify-between border-r border-slate-200 dark:border-slate-800 overflow-hidden" style={{ width: `${colWidths.issue}px` }}>
                  <span className="truncate">Hierarquia: Issue / Disciplina</span>
                  <div 
                    onMouseDown={(e) => startResizing('issue', e)}
                    className="absolute right-0 top-0 bottom-0 w-2 hover:w-2.5 bg-transparent hover:bg-blue-500/50 cursor-col-resize flex items-center justify-center transition-colors group"
                    title="Arraste para redimensionar coluna"
                  >
                    <div className="w-[2px] h-4 bg-slate-300 dark:bg-slate-700 group-hover:bg-blue-500" />
                  </div>
                </div>

                {/* 2. Column: Timeline Pill (Monday.com style) */}
                <div className="relative px-2 flex items-center justify-center border-r border-slate-200 dark:border-slate-800 overflow-hidden" style={{ width: `${colWidths.timeline}px` }}>
                  <span className="truncate text-center">Timeline</span>
                  <div 
                    onMouseDown={(e) => startResizing('timeline', e)}
                    className="absolute right-0 top-0 bottom-0 w-2 hover:w-2.5 bg-transparent hover:bg-blue-500/50 cursor-col-resize flex items-center justify-center transition-colors group"
                    title="Arraste para redimensionar coluna"
                  >
                    <div className="w-[2px] h-4 bg-slate-300 dark:bg-slate-700 group-hover:bg-blue-500" />
                  </div>
                </div>

                {/* 3. Column: Progress Bar (Monday.com style) */}
                <div className="relative px-2 flex items-center justify-center border-r border-slate-200 dark:border-slate-800 overflow-hidden" style={{ width: `${colWidths.progress}px` }}>
                  <span className="truncate text-center">Progress</span>
                  <div 
                    onMouseDown={(e) => startResizing('progress', e)}
                    className="absolute right-0 top-0 bottom-0 w-2 hover:w-2.5 bg-transparent hover:bg-blue-500/50 cursor-col-resize flex items-center justify-center transition-colors group"
                    title="Arraste para redimensionar coluna"
                  >
                    <div className="w-[2px] h-4 bg-slate-300 dark:bg-slate-700 group-hover:bg-blue-500" />
                  </div>
                </div>

                {/* 4. Column: Status */}
                <div className="relative px-2 flex items-center justify-center border-r border-slate-200 dark:border-slate-800 overflow-hidden" style={{ width: `${colWidths.status}px` }}>
                  <span className="truncate text-center">Status</span>
                  <div 
                    onMouseDown={(e) => startResizing('status', e)}
                    className="absolute right-0 top-0 bottom-0 w-2 hover:w-2.5 bg-transparent hover:bg-blue-500/50 cursor-col-resize flex items-center justify-center transition-colors group"
                    title="Arraste para redimensionar coluna"
                  >
                    <div className="w-[2px] h-4 bg-slate-300 dark:bg-slate-700 group-hover:bg-blue-500" />
                  </div>
                </div>

                {/* 5. Column: Assignee */}
                <div className="relative px-2 flex items-center justify-between overflow-hidden" style={{ width: `${colWidths.assignee}px` }}>
                  <span className="truncate">Assignee</span>
                  <div 
                    onMouseDown={(e) => startResizing('assignee', e)}
                    className="absolute right-0 top-0 bottom-0 w-2 hover:w-2.5 bg-transparent hover:bg-blue-500/50 cursor-col-resize flex items-center justify-center transition-colors group"
                    title="Arraste para redimensionar coluna"
                  >
                    <div className="w-[2px] h-4 bg-slate-300 dark:bg-slate-700 group-hover:bg-blue-500" />
                  </div>
                </div>

              </div>

              {/* Left Body Rows */}
              <div className="divide-y divide-slate-200/80 dark:divide-slate-800/60 text-xs">
                {Array.from(hierarchicalStructure.parentsMap.entries()).map(([parentKey, { parent, children }]) => {
                  const isParentCollapsed = hierarchyLevel === 'story-only'
                    ? true
                    : hierarchyLevel === 'subtask-only'
                    ? false
                    : collapsedParents[parentKey];
                  const { getEffectiveDates } = storyCascades.get(parentKey)!;
                  const { start: pStart, end: pEnd, isDelayed, delayDays, isOverdueRisk } = getEffectiveDates(parent);
                  const parentProgress = computeParentProgress(parent, children);

                  return (
                    <React.Fragment key={parentKey}>
                      {/* Parent Story / Manutenção / Legislação / Débito Técnico Row */}
                      {hierarchyLevel !== 'subtask-only' && (
                      <div
                        onClick={() => { if (hierarchyLevel === 'story-to-subtask') toggleParent(parentKey); }}
                        className={`flex h-11 items-stretch border-t font-semibold transition-colors ${hierarchyLevel === 'story-to-subtask' ? 'cursor-pointer' : ''} ${
                          isOverdueRisk
                            ? 'bg-rose-500/10 hover:bg-rose-500/15 border-rose-300 dark:border-rose-900/60'
                            : 'bg-blue-50/30 dark:bg-blue-950/20 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 border-slate-200/60 dark:border-slate-800/60'
                        }`}
                      >
                        {/* 1. Hierarchy / Title */}
                        <div className="px-3 pl-4 flex items-center gap-1.5 border-r border-slate-200 dark:border-slate-800 overflow-hidden" style={{ width: `${colWidths.issue}px` }}>
                          {hierarchyLevel === 'story-to-subtask' && (isParentCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />)}
                          {getIssueTypeBadge(parent.type, true, parent.isBug)}
                          <span className="font-mono text-[11px] font-bold text-blue-700 dark:text-blue-400 shrink-0">{parent.jiraKey}</span>
                          <span className="truncate text-slate-900 dark:text-slate-100 font-bold" title={parent.title}>{parent.title}</span>
                          {isOverdueRisk && (
                            <Badge className="ml-auto text-[8px] font-black bg-rose-600 text-white uppercase border-none animate-pulse shrink-0">
                              🚨 +{delayDays}d
                            </Badge>
                          )}
                        </div>

                        {/* 2. Timeline Column (Monday.com Pill) */}
                        <div className="px-2 flex items-center justify-center border-r border-slate-200 dark:border-slate-800 overflow-hidden" style={{ width: `${colWidths.timeline}px` }}>
                          <div className={`w-full py-1 px-2 rounded-full text-center text-[10px] font-black tracking-tight shadow-xs flex items-center justify-center gap-1 ${
                            isOverdueRisk
                              ? 'bg-rose-700 text-white animate-pulse'
                              : 'bg-slate-800 text-white dark:bg-slate-800/90 dark:text-slate-200'
                          }`}>
                            <CalendarIcon className="w-2.5 h-2.5 opacity-70" />
                            <span>{formatDateShort(pStart)} - {formatDateShort(pEnd)}</span>
                          </div>
                        </div>

                        {/* 3. Progress Column (Monday.com Progress Bar) */}
                        <div className="px-2 flex items-center gap-1.5 border-r border-slate-200 dark:border-slate-800 overflow-hidden" style={{ width: `${colWidths.progress}px` }}>
                          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 relative">
                            <div
                              className={`h-full rounded-full transition-all ${
                                parentProgress === 100
                                  ? 'bg-emerald-500'
                                  : parentProgress > 0
                                  ? 'bg-blue-600 dark:bg-blue-500'
                                  : 'bg-transparent'
                              }`}
                              style={{ width: `${parentProgress}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 font-mono w-7 text-right shrink-0">
                            {parentProgress}%
                          </span>
                        </div>

                        {/* 4. Status Column */}
                        <div className="px-1 flex items-center justify-center border-r border-slate-200 dark:border-slate-800 overflow-hidden" style={{ width: `${colWidths.status}px` }}>
                          {getStatusBadge(parent.status)}
                        </div>

                        {/* 5. Assignee Column */}
                        <div className="px-2 flex items-center gap-1.5 overflow-hidden text-slate-700 dark:text-slate-300" style={{ width: `${colWidths.assignee}px` }}>
                          <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[9px] font-bold shrink-0">
                            {parent.assigneeName?.charAt(0)}
                          </div>
                          <span className="truncate text-[10.5px]">{parent.assigneeName}</span>
                        </div>
                      </div>
                      )}

                      {/* Child Subtasks Rows */}
                      {!isParentCollapsed && children.map(task => {
                        const { start, end, isDelayed, delayDays, isOverdueRisk, confidence } = getEffectiveDates(task);
                        const childProgress = computeTaskProgress(task);
                        // Ver nota de confidence na fita composta — mesmo motivo: fato
                        // observado (prazo vencido) e chute (trabalho restante) não
                        // podem parecer igualmente certos.
                        const confidenceNote = confidence === 'presumed' ? ' (estimativa, não confirmado)' : '';

                        return (
                          <div key={task.id} className={`relative flex h-10 items-stretch transition-colors ${
                            isOverdueRisk
                              ? 'bg-rose-500/5 hover:bg-rose-500/10'
                              : 'hover:bg-slate-50/90 dark:hover:bg-slate-900/40'
                          }`}>
                            {/* 1. Hierarchy / Title */}
                            <div className="px-3 pl-8 flex items-center gap-1.5 border-r border-slate-200 dark:border-slate-800 overflow-hidden" style={{ width: `${colWidths.issue}px` }}>
                              <CornerDownRight className="w-3 h-3 text-slate-400 shrink-0" />
                              {getIssueTypeBadge(task.type, false, task.isBug)}
                              <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 shrink-0">{task.jiraKey}</span>
                              <span className="truncate text-slate-800 dark:text-slate-200 font-medium" title={task.title}>{task.title}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); setOpenDelayPickerFor(openDelayPickerFor === task.id ? null : task.id); }}
                                className={`ml-auto shrink-0 p-1 rounded-md transition-colors ${task.id === activeDelayTaskId ? 'bg-rose-600 text-white' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'}`}
                                title="Simular atraso nesta fase"
                              >
                                <Clock className="w-3 h-3" />
                              </button>
                            </div>

                            {openDelayPickerFor === task.id && (
                              <div className="absolute z-40 top-9 left-8 flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg p-1">
                                {[0, 1, 2, 3].map(d => (
                                  <button
                                    key={d}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (d === 0) { setActiveDelayTaskId(null); setActiveDelayDays(0); }
                                      else { setActiveDelayTaskId(task.id); setActiveDelayDays(d); }
                                      setOpenDelayPickerFor(null);
                                    }}
                                    className={`h-6 px-2 text-[9.5px] font-bold rounded ${
                                      d === 0 ? 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                                      : d === 1 ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                                      : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                    }`}
                                  >
                                    {d === 0 ? '0d' : `+${d}d`}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* 2. Timeline Column (Monday.com Pill) */}
                            <div className="px-2 flex items-center justify-center border-r border-slate-200 dark:border-slate-800 overflow-hidden" style={{ width: `${colWidths.timeline}px` }}>
                              <div
                                className={`w-full py-0.5 px-2 rounded-full text-center text-[9.5px] font-bold tracking-tight shadow-2xs flex items-center justify-center gap-1 ${
                                  isOverdueRisk
                                    ? 'bg-rose-600 text-white animate-pulse'
                                    : isDelayed
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-slate-700 text-slate-100 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                                title={isDelayed ? `+${delayDays}d${confidenceNote}` : undefined}
                              >
                                <span>{formatDateShort(start)} - {formatDateShort(end)}</span>
                                {isDelayed && <span className="text-[8px] opacity-90">+{delayDays}d</span>}
                              </div>
                            </div>

                            {/* 3. Progress Column (Monday.com Progress Bar) */}
                            <div className="px-2 flex items-center gap-1.5 border-r border-slate-200 dark:border-slate-800 overflow-hidden" style={{ width: `${colWidths.progress}px` }}>
                              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden relative">
                                <div 
                                  className={`h-full rounded-full transition-all ${
                                    childProgress === 100 
                                      ? 'bg-emerald-500' 
                                      : childProgress >= 50 
                                      ? 'bg-blue-600' 
                                      : 'bg-transparent'
                                  }`}
                                  style={{ width: `${childProgress}%` }}
                                />
                              </div>
                              <span className="text-[9.5px] font-bold text-slate-600 dark:text-slate-400 font-mono w-7 text-right shrink-0">
                                {childProgress}%
                              </span>
                            </div>

                            {/* 4. Status Column */}
                            <div className="px-1 flex items-center justify-center border-r border-slate-200 dark:border-slate-800 overflow-hidden" style={{ width: `${colWidths.status}px` }}>
                              {getStatusBadge(task.status)}
                            </div>

                            {/* 5. Assignee Column */}
                            <div className="px-2 flex items-center gap-1.5 overflow-hidden text-slate-800 dark:text-slate-200" style={{ width: `${colWidths.assignee}px` }}>
                              <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[9px] font-bold shrink-0">
                                {task.assigneeName.charAt(0)}
                              </div>
                              <span className="truncate text-[10.5px]">{task.assigneeName}</span>
                            </div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* ══════════ RIGHT PANE: GANTT TIMELINE CALENDAR ══════════ */}
            <div className="grow overflow-hidden relative" style={{ width: `${totalTimelineWidth}px` }}>
              {/* Calendar Header */}
              <div 
                className="flex h-11 bg-slate-100/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 text-[11px] font-bold border-b border-slate-200 dark:border-slate-800 divide-x divide-slate-200 dark:divide-slate-800/80"
              >
                {daysList.map((day) => {
                  const isToday = day.iso === todayIso;
                  return (
                    <div 
                      key={day.iso} 
                      style={{ width: `${colWidths.dayWidth}px` }}
                      className={`shrink-0 flex flex-col items-center justify-center py-1 text-center select-none ${
                        day.isWeekend 
                          ? 'bg-slate-200/40 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500' 
                          : 'text-slate-700 dark:text-slate-300'
                      } ${isToday ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold border-b-2 border-amber-500' : ''}`}
                    >
                      <div className="text-[9.5px] uppercase font-bold tracking-tight">{day.dayName}</div>
                      <div className="text-[11px] font-bold">{day.dayNum}/{day.monthShort}</div>
                    </div>
                  );
                })}
              </div>

              {/* Calendar Body Rows */}
              <div className="divide-y divide-slate-200/80 dark:divide-slate-800/60 relative">
                
                {/* Continuous Vertical Yellow Ruler on "Today" matching Jira Plans */}
                {daysList.findIndex(d => d.iso === todayIso) >= 0 && (
                  <div 
                    className="absolute top-0 bottom-0 pointer-events-none z-20 flex flex-col items-center"
                    style={{ 
                      left: `${(daysList.findIndex(d => d.iso === todayIso) * colWidths.dayWidth) + (colWidths.dayWidth / 2)}px` 
                    }}
                  >
                    <div className="w-[2px] h-full bg-amber-500/80 border-r border-dashed border-amber-400" />
                  </div>
                )}

                {Array.from(hierarchicalStructure.parentsMap.entries()).map(([parentKey, { parent, children }]) => {
                  const isParentCollapsed = hierarchyLevel === 'story-only'
                    ? true
                    : hierarchyLevel === 'subtask-only'
                    ? false
                    : collapsedParents[parentKey];
                  const { getEffectiveDates } = storyCascades.get(parentKey)!;
                  const { trackOf, totalTracks } = packChildrenIntoTracks(children, getEffectiveDates);
                  const trackHeight = Math.max(8, Math.floor(36 / totalTracks));

                  return (
                    <React.Fragment key={parentKey}>
                      {/* ══════════ PARENT ROW: COMPOSITE MULTI-SEGMENT & STACKED TRACKS (Monday.com Style) ══════════ */}
                      {hierarchyLevel !== 'subtask-only' && (
                      <div className="h-11 relative bg-blue-50/20 dark:bg-blue-950/10 flex items-center">
                        {/* Grid background columns */}
                        <div className="flex absolute inset-0 divide-x divide-slate-200 dark:divide-slate-800/40 pointer-events-none">
                          {daysList.map(d => (
                            <div key={d.iso} style={{ width: `${colWidths.dayWidth}px` }} className={`h-full shrink-0 ${d.isWeekend ? 'bg-slate-100/50 dark:bg-slate-900/30' : ''}`} />
                          ))}
                        </div>

                        {/* Target Deadline Marker Line for Parent Story — some se
                            datesAreInferred: data fabricada não é compromisso real,
                            não faz sentido desenhar como se fosse (ver inferSlip). */}
                        {parent.targetEnd && !parent.datesAreInferred && daysList.findIndex(d => d.iso === parent.targetEnd) >= 0 && (
                          <div
                            className="absolute top-0 bottom-0 pointer-events-none z-10 flex flex-col items-center"
                            style={{
                              left: `${(daysList.findIndex(d => d.iso === parent.targetEnd) * colWidths.dayWidth) + colWidths.dayWidth - 1}px`
                            }}
                            title={`Prazo Limite Original da História: ${formatDateShort(parent.targetEnd)}`}
                          >
                            <div className="w-[2px] h-full bg-rose-500/70 border-r border-dotted border-rose-600" />
                          </div>
                        )}

                        {/* Fita única por história — uma linha contínua por track, cor muda por
                            fase (getDisciplineColorAndLabel/resolveWorkflowPhase); packChildrenIntoTracks
                            só abre track extra quando duas fases realmente se cruzam no mesmo dia (aí o
                            dia de handoff divide a célula ao meio). Dia além do prazo original da fase
                            ganha anel rosa mantendo a cor da fase — dá pra ver QUAL fase está atrasada e
                            QUE está atrasada no mesmo pixel (ver legenda no topo do painel). */}
                        <div className="absolute inset-0 pointer-events-auto">
                          {Array.from({ length: totalTracks }, (_, trackIdx) => {
                            const topOffset = 4 + trackIdx * trackHeight;
                            const ownersByDay = daysList.map(day => children.filter(task => {
                              if ((trackOf.get(task.id) ?? 0) !== trackIdx) return false;
                              const { start, end } = getEffectiveDates(task);
                              return !!start && !!end && day.iso >= start && day.iso <= end;
                            }));

                            return (
                              <div key={trackIdx} className="absolute left-0 right-0" style={{ top: `${topOffset}px`, height: `${trackHeight}px` }}>
                                {daysList.map((day, dayIdx) => {
                                  const owners = ownersByDay[dayIdx];
                                  if (owners.length === 0) return null;
                                  const isLeftEdge = dayIdx === 0 || ownersByDay[dayIdx - 1].length === 0;
                                  const isRightEdge = dayIdx === daysList.length - 1 || ownersByDay[dayIdx + 1].length === 0;

                                  return (
                                    <div
                                      key={day.iso}
                                      className={`absolute top-0 bottom-0 flex overflow-hidden shadow-xs ${isLeftEdge ? 'rounded-l-full' : ''} ${isRightEdge ? 'rounded-r-full' : ''}`}
                                      style={{ left: `${dayIdx * colWidths.dayWidth}px`, width: `${colWidths.dayWidth}px` }}
                                    >
                                      {owners.map(task => {
                                        const { start, end, delayDays, originalDeadline, confidence } = getEffectiveDates(task);
                                        const disc = getDisciplineColorAndLabel(task);
                                        const isOverrunDay = !!originalDeadline && day.iso > originalDeadline;
                                        // confidence qualifica o tooltip: 'observed' = já aconteceu
                                        // (prazo vencido/concluído atrasado), 'presumed' = heurística
                                        // (trabalho restante) — sem isso os dois pareciam igualmente
                                        // certos pro usuário, mesmo tratamento visual pra fato e chute.
                                        const confidenceNote = confidence === 'presumed' ? ' (estimativa, não confirmado)' : '';
                                        return (
                                          <div
                                            key={task.id}
                                            style={{ width: `${100 / owners.length}%` }}
                                            className={`h-full cursor-pointer transition-colors hover:brightness-110 hover:z-30 ${disc.bg} ${
                                              isOverrunDay ? 'ring-2 ring-inset ring-rose-500 dark:ring-rose-400' : ''
                                            }`}
                                            title={`${task.jiraKey} (${disc.label}): ${task.title} [${formatDateShort(start)} a ${formatDateShort(end)}]${
                                              isOverrunDay ? ` — além do prazo original (${formatDateShort(originalDeadline)}), +${delayDays}d${confidenceNote}` : ''
                                            }`}
                                          />
                                        );
                                      })}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      )}

                      {/* Child Subtasks Gantt Individual Bars */}
                      {!isParentCollapsed && children.map(task => {
                        const { start, end, isDelayed, delayDays, isOverdueRisk, confidence } = getEffectiveDates(task);
                        // Ver nota de confidence na fita composta — mesmo motivo.
                        const confidenceNote = confidence === 'presumed' ? ' (estimativa, não confirmado)' : '';
                        const startIndex = daysList.findIndex(d => d.iso === start);
                        const endIndex = daysList.findIndex(d => d.iso === end);
                        const startCol = startIndex >= 0 ? startIndex : 0;
                        const endColCandidate = endIndex >= 0 ? endIndex : daysList.length - 1;
                        const spanCols = Math.max(1, endColCandidate - startCol + 1);

                        const barLeft = startCol * colWidths.dayWidth + 2;
                        const barWidth = Math.max(colWidths.dayWidth - 4, spanCols * colWidths.dayWidth - 4);
                        const disc = getDisciplineColorAndLabel(task);

                        return (
                          <div key={task.id} className="h-10 relative group">
                            {/* Grid background columns */}
                            <div className="flex absolute inset-0 divide-x divide-slate-200 dark:divide-slate-800/40 pointer-events-none">
                              {daysList.map(d => (
                                <div key={d.iso} style={{ width: `${colWidths.dayWidth}px` }} className={`h-full shrink-0 ${d.isWeekend ? 'bg-slate-100/50 dark:bg-slate-900/30' : ''}`} />
                              ))}
                            </div>

                            {/* Gantt Bar Element with Discipline Color & Overdue Highlight */}
                            <div 
                              style={{ 
                                left: `${barLeft}px`,
                                width: `${barWidth}px`,
                              }}
                              className="absolute top-1.5 bottom-1.5 z-10 rounded-lg px-1 flex items-center justify-between text-[10px] font-bold text-white shadow-sm transition-transform hover:scale-[1.01] cursor-pointer"
                              title={`${task.jiraKey} (${disc.label}): ${task.title} (${start} até ${end})${isDelayed ? ` - Atraso em Cascata: +${delayDays}d${confidenceNote}` : ''}`}
                            >
                              <div className={`w-full h-full rounded-md px-2 flex items-center gap-1.5 overflow-hidden ${
                                isOverdueRisk 
                                  ? 'bg-gradient-to-r from-amber-500 via-rose-600 to-rose-700 text-white shadow-md shadow-rose-500/40 ring-2 ring-rose-400 animate-pulse'
                                  : isDelayed 
                                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/30 ring-2 ring-amber-400/60'
                                  : `${disc.bg} text-white shadow-xs`
                              }`}>
                                <span className="text-[9px] bg-black/25 px-1 py-0.2 rounded font-black uppercase shrink-0">
                                  {disc.shortLabel}
                                </span>
                                <span className="truncate">{task.title}</span>
                                {isDelayed && (
                                  <span className="text-[8.5px] bg-black/40 px-1 py-0.2 rounded font-black shrink-0">
                                    +{delayDays}d {isOverdueRisk ? '🚨' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}