import React from 'react';
import { Clock, CheckCircle2, AlertTriangle, Ban } from 'lucide-react';

export type Decision = 'open' | 'approved' | 'needs_adjustment' | 'rejected';
export type PreparationStatus = 'todo' | 'doing' | 'review' | 'done';

export interface Evidence { 
  problem: string;
  solution: string;
  dev: string;
  qa: string;
  screenshot: string;
  video: string;
  // Só importa quando os dois campos acima estão preenchidos (com só um,
  // esse é o que aparece, sem ambiguidade). Ausente = 'video', mesmo default
  // de antes dessa flag existir — não muda o comportamento de card já criado.
  evidencePreference?: 'video' | 'screenshot';
  timeSpent?: number;
  timeEstimate?: number;
  planned?: { dev?: string; qa?: string; tu?: string } | null;
}

export interface ImpactMetric {
  field: string; // "campo" — ex: "Economia (R$)", "Tempo Poupado (dias)"
  value: number; // "valor"
}

export type CardKind = 'story' | 'metrics';
// Nem toda entrega de dev team é código: cobertura de teste, taxa de bugs
// por severidade, tendência de throughput ao longo da sprint — cada forma
// pede um gráfico diferente. Ausente/'bar' mantém o comportamento anterior.
export type ChartType = 'bar' | 'pie' | 'line';

export interface ShowcaseTask {
  id: string;
  key: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  type: string;
  status: string;
  priority: string;
  points: number;
  // Ausente/'story' = card clássico (causa/solução). 'metrics' = entrega cujo
  // resultado é melhor contado em número (campo/valor + gráfico) do que em
  // causa/solução — troca o corpo do card por MetricsEditor + description
  // como contexto, sem mexer no fluxo de decisão/preparação em volta.
  cardKind?: CardKind;
  chartType?: ChartType;
  chartTitle?: string;
  // Só lido pro card padrão com métrica avulsa ('story' + metrics). Card
  // 'metrics' puro ignora isso e é sempre 'featured' (é o único conteúdo que
  // ele tem pra mostrar). Ausente = 'compact' (comportamento anterior).
  chartDisplay?: 'compact' | 'featured';
  metrics?: ImpactMetric[];
  assignee: string; 
  url: string;
  evidence: Evidence; 
  decision: Decision; 
  preparationStatus: PreparationStatus;
  feedback: string; 
  project?: string;
  versionSuporte?: string;
  versionMaster?: string;
  versionRelease?: string;
  versionDevelop?: string;
  approvedAt?: string;
  // Trilha de decisão — quem decidiu e quando, pra qualquer decisão (não só
  // approved). Sem isso a SummaryDialog não tinha como mostrar autoria.
  decidedBy?: string;
  decidedByName?: string;
  decidedAt?: string;
}

export interface SessionMember {
  id: string;
  name: string;
  role: string;
  avatar?: string;
}

export interface ShowcaseSession {
  id: string; 
  name: string; 
  sprintName: string; 
  description?: string; // Objetivos da Sprint
  coverImage?: string;
  squadName?: string; 
  period?: string;
  members?: SessionMember[];
  tasks: ShowcaseTask[];
  createdAt: string | null;
  status: string;
  presentationBackground?: string;
  presentationTheme?: 'cinematic' | 'minimalist' | 'corporate' | 'glass';
  defaultSort?: 'key' | 'type' | 'dev' | 'qa';
  // Checklist de prontidão ("Guia de Elite") — no doc da sessão (não
  // localStorage) pra refletir o preparo real do squad, visível pra quem
  // entrar, não só de quem marcou no próprio navegador.
  readinessChecklist?: boolean[];
}

export const ISSUE_TYPES = [
  'História',
  'Manutenção',
  'Tarefa',
  'Melhoria',
  'Novo Recurso',
  'Épico',
  'Spike',
  'Documentação',
  'Suporte',
  'Ideia / Inovação',
  'Teste Sistêmico',
  'Legislação',
  'Erro / Bug',
  'Evolução'
];

export const DECISION = {
  open:             { label: 'Aguardando',  cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',   icon: React.createElement(Clock, { className: "h-3 w-3" }) },
  approved:         { label: 'Aprovado',    cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400', icon: React.createElement(CheckCircle2, { className: "h-3 w-3" }) },
  needs_adjustment: { label: 'Ajuste',      cls: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',     icon: React.createElement(AlertTriangle, { className: "h-3 w-3" }) },
  rejected:         { label: 'Rejeitado',   cls: 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400',       icon: React.createElement(Ban, { className: "h-3 w-3" }) },
} as const;

export const PREPARATION_STATUS = {
  todo:   { label: 'Aguardando',      cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-800' },
  doing:  { label: 'Em Preparação',  cls: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',    border: 'border-blue-100 dark:border-blue-900/30' },
  review: { label: 'Em Revisão',     cls: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400', border: 'border-indigo-100 dark:border-indigo-900/30' },
  done:   { label: 'Pronta',          cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400', border: 'border-emerald-100 dark:border-emerald-900/30' },
} as const;
 
export interface PresentationPreset {
  id: string;
  name: string;
  category: 'dark' | 'light';
  value: string;
  preview: string;
  description: string;
  isLight?: boolean;
}

export const PRESENTATION_PRESETS: PresentationPreset[] = [
  // --- TONS ESCUROS (CINEMATOGRÁFICO) ---
  {
    id: 'noir',
    name: 'Deep Space',
    category: 'dark',
    value: 'linear-gradient(135deg, #050510 0%, #0d0d1f 50%, #050510 100%)',
    preview: '#050510',
    description: 'Preto cósmico profundo com sutis reflexos violeta',
    isLight: false,
  },
  {
    id: 'midnight',
    name: 'Noite Índigo',
    category: 'dark',
    value: 'linear-gradient(135deg, #0b0f19 0%, #1e1b4b 50%, #0f172a 100%)',
    preview: '#1e1b4b',
    description: 'Azul índigo noturno elegante e sóbrio',
    isLight: false,
  },
  {
    id: 'cyber',
    name: 'Cyber Violet',
    category: 'dark',
    value: 'linear-gradient(135deg, #180828 0%, #3b0764 50%, #130324 100%)',
    preview: '#3b0764',
    description: 'Violeta dinâmico para squads de tecnologia e inovação',
    isLight: false,
  },
  {
    id: 'emerald',
    name: 'Tech Emerald',
    category: 'dark',
    value: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #021a14 100%)',
    preview: '#064e3b',
    description: 'Verde esmeralda escuro focado em estabilidade e métricas',
    isLight: false,
  },
  {
    id: 'sunset',
    name: 'Sunset Wine',
    category: 'dark',
    value: 'linear-gradient(135deg, #2a0818 0%, #4a0e2e 50%, #18030f 100%)',
    preview: '#4a0e2e',
    description: 'Bordô e carmesim aveludado de alto contraste',
    isLight: false,
  },
  {
    id: 'ocean',
    name: 'Ocean Abyss',
    category: 'dark',
    value: 'linear-gradient(135deg, #020b18 0%, #0c2340 50%, #030712 100%)',
    preview: '#0c2340',
    description: 'Azul marinho profundo, técnico e limpo',
    isLight: false,
  },
  {
    id: 'slate',
    name: 'Grafite Minimal',
    category: 'dark',
    value: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    preview: '#1e293b',
    description: 'Cinza chumbo industrial discreto',
    isLight: false,
  },

  // --- TONS CLAROS (SALA ILUMINADA / PROJETOR) ---
  {
    id: 'white',
    name: 'Branco Puro',
    category: 'light',
    value: '#ffffff',
    preview: '#ffffff',
    description: 'Branco total de alto contraste para salas iluminadas e projetores',
    isLight: true,
  },
  {
    id: 'soft-snow',
    name: 'Studio Off-White',
    category: 'light',
    value: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    preview: '#f8fafc',
    description: 'Cinza claríssimo moderno com acabamento de galeria',
    isLight: true,
  },
  {
    id: 'ice-blue',
    name: 'Gelo Ártico',
    category: 'light',
    value: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
    preview: '#e0f2fe',
    description: 'Azul celeste sutil e iluminado, descansado para os olhos',
    isLight: true,
  },
  {
    id: 'warm-cream',
    name: 'Editorial Cream',
    category: 'light',
    value: 'linear-gradient(135deg, #fafaf9 0%, #f5f5f4 100%)',
    preview: '#f5f5f4',
    description: 'Tom de papel encorpado, suave e corporativo',
    isLight: true,
  },
];


export const PRESETS = [
  { id: 'totvs', name: 'Corporativo Agile', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop', description: 'Ambiente profissional e moderno' },
  { id: 'abstract', name: 'Abstract Flow', url: 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2029&auto=format&fit=crop', description: 'Gradients suaves e modernos' },
  { id: 'office', name: 'Focus Office', url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=2069&auto=format&fit=crop', description: 'Ambiente de trabalho limpo' },
  { id: 'creative', name: 'Creative Dash', url: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=2070&auto=format&fit=crop', description: 'Dinâmico e inspirador' },
];
