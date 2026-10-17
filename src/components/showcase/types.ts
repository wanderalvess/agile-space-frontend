import React from 'react';
import { Clock, CheckCircle2, AlertTriangle, Ban } from 'lucide-react';
import { TONES } from '@/components/room-kit/tokens';

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
  // Links de apoio (não viram a evidência exibida no Teatro): inferidos na
  // importação do Jira, editáveis no card.
  techDocUrl?: string;
  tdnUrl?: string;
  timeSpent?: number;
  timeEstimate?: number;
  planned?: { dev?: string; qa?: string; tu?: string } | null;
}

/** Arquivo anexado a um card (PNG, JPEG ou PDF) — evidência que ainda não está no Jira. */
export interface TaskFile {
  id: string;
  taskId: string;
  name: string;
  contentType: string;
  size: number;
  uploadedBy?: string;
  createdAt?: string;
}

export const TASK_FILE_MAX_COUNT = 5;
export const TASK_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const TASK_FILE_ACCEPT = 'image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf';

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
  // Só leitura: vem do backend (arquivos enviados no card). Entra e sai pelos endpoints de arquivo.
  attachments?: TaskFile[];
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
  // Edição por card (backend com a V81). Ausente = backend antigo: a sala grava a Review inteira, como antes.
  /** Começa em 1 e sobe a cada mudança de conteúdo do card; o PATCH do card exige a versão lida. */
  version?: number;
  /** Só leitura: última mudança do card (nulo em card anterior à V81). */
  updatedAt?: string | null;
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
  /** Última gravação (vem do servidor); base para tratar "Ao vivo" abandonado. */
  updatedAt?: string | null;
  status: string;
  presentationBackground?: string;
  presentationTheme?: 'cinematic' | 'minimalist' | 'corporate' | 'glass';
  defaultSort?: 'key' | 'type' | 'dev' | 'qa';
  // Checklist de prontidão ("Guia de Elite") — no doc da sessão (não
  // localStorage) pra refletir o preparo real do squad, visível pra quem
  // entrar, não só de quem marcou no próprio navegador.
  readinessChecklist?: boolean[];
  /** Quem criou a Review (login). Usado na trava de decisão de uma Review sem squad. */
  createdBy?: string | null;
  // Backend com a V81 (todos opcionais e só leitura):
  /** Quem esteve na sala quando a Review foi finalizada; vazio ou ausente se não houver o registro. */
  participants?: ShowcaseParticipant[];
  /** Quem está apresentando agora; ausente ou nulo = ninguém. */
  presenter?: ShowcasePresenter | null;
  /** Só na resposta do POST: cards em que o servidor manteve a versão dele (a nossa estava velha). */
  staleCardIds?: string[];
}

/** Pessoa presente na sala quando a Review foi finalizada. */
export interface ShowcaseParticipant {
  userId: string;
  displayName: string;
}

/** Quem está apresentando agora e o que mostra. `cardId` nulo = só abriu o Teatro (capa). */
export interface ShowcasePresenter {
  userId: string;
  displayName: string;
  cardId: string | null;
  step: string | null;
  presentingAt: string;
}

/** Consulta JQL guardada no servidor para a squad (o servidor só guarda o texto; a busca roda no navegador). */
export interface ShowcaseJqlQuery {
  id: string;
  squadId: string;
  name: string;
  jql: string;
  visibility: 'SQUAD' | 'PRIVATE';
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
  /** Fui eu que criei. */
  mine: boolean;
  /** Posso apagar (criador, liderança da squad em consulta da squad, ou administrador). */
  canDelete: boolean;
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

/**
 * Decisão do PO: rótulo, ícone e classes do selo (tokens do kit: valem nos 7 temas, claro e escuro).
 * `cls` serve às telas com o tema do portal; o Modo Teatro usa `stageCls`, que lê bem sobre o fundo
 * escolhido para a apresentação (claro ou escuro), seja qual for o tema do portal.
 */
export const DECISION = {
  open:             { label: 'Aguardando', cls: TONES.neutral.chip, stageCls: { dark: 'bg-white/10 text-white/70', light: 'bg-slate-100 text-slate-600' }, icon: React.createElement(Clock, { className: 'h-3 w-3', strokeWidth: 1.5 }) },
  approved:         { label: 'Aprovado',   cls: TONES.success.chip, stageCls: { dark: 'bg-emerald-500/15 text-emerald-300', light: 'bg-emerald-100 text-emerald-800' }, icon: React.createElement(CheckCircle2, { className: 'h-3 w-3', strokeWidth: 1.5 }) },
  needs_adjustment: { label: 'Ajuste',     cls: TONES.warn.chip, stageCls: { dark: 'bg-amber-500/15 text-amber-300', light: 'bg-amber-100 text-amber-800' }, icon: React.createElement(AlertTriangle, { className: 'h-3 w-3', strokeWidth: 1.5 }) },
  rejected:         { label: 'Rejeitado',  cls: TONES.danger.chip, stageCls: { dark: 'bg-red-500/15 text-red-300', light: 'bg-red-100 text-red-800' }, icon: React.createElement(Ban, { className: 'h-3 w-3', strokeWidth: 1.5 }) },
} as const;

/** Status de preparação do card: texto do selo, classes do selo e da borda. */
export const PREPARATION_STATUS = {
  todo:   { label: 'Aguardando',     cls: TONES.neutral.chip, border: 'border-border' },
  doing:  { label: 'Em preparação',  cls: TONES.brand.chip,   border: 'border-primary/30' },
  review: { label: 'Em revisão',     cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-300', border: 'border-blue-500/30' },
  done:   { label: 'Pronta',         cls: TONES.success.chip, border: 'border-emerald-500/30' },
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

/** Imagem padrão da empresa: capa e fundo de toda Review nova. Arquivo em `public/`. */
export const DEFAULT_SHOWCASE_IMAGE = '/showcase/fundo-totvs.webp';

export const PRESENTATION_PRESETS: PresentationPreset[] = [
  {
    id: 'totvs',
    name: 'TOTVS (padrão)',
    category: 'dark',
    value: DEFAULT_SHOWCASE_IMAGE,
    preview: 'url',
    description: 'Foto da sede TOTVS, padrão de toda Review nova',
    isLight: false,
  },
  // --- TONS ESCUROS (CINEMATOGRÁFICO) ---
  {
    id: 'totvs-azul',
    name: 'Azul TOTVS',
    category: 'dark',
    value: 'linear-gradient(135deg, #001824 0%, #002233 50%, #0A3048 100%)',
    preview: '#002233',
    description: 'Azul institucional escuro, sóbrio e fiel à marca',
    isLight: false,
  },
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


/**
 * Capas prontas: arquivos do próprio app em `public/showcase/` (sem imagens de terceiros e sem logo de produto).
 * A primeira é o padrão da empresa; as outras são fundos abstratos na paleta TOTVS.
 */
export const PRESETS = [
  { id: 'totvs-padrao', name: 'TOTVS', url: DEFAULT_SHOWCASE_IMAGE, description: 'Padrão da empresa' },
  { id: 'azul-profundo', name: 'Azul profundo', url: '/showcase/fundo-azul.svg', description: 'Azul escuro com halos de luz' },
  { id: 'grade-clara', name: 'Grade clara', url: '/showcase/fundo-grade.svg', description: 'Fundo claro com grade suave' },
  { id: 'ondas', name: 'Ondas', url: '/showcase/fundo-ondas.svg', description: 'Linhas fluidas em azul e verde' },
  { id: 'pontos', name: 'Pontos', url: '/showcase/fundo-pontos.svg', description: 'Malha de pontos em tom petróleo' },
];
