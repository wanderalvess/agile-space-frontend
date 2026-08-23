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
  timeSpent?: number;
  timeEstimate?: number;
  planned?: { dev?: string; qa?: string; tu?: string } | null;
}

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
  assignee: string; 
  url: string;
  evidence: Evidence; 
  decision: Decision; 
  preparationStatus: PreparationStatus;
  feedback: string; 
  project?: string;
  versionMaster?: string;
  versionDevelop?: string;
  versionRelease?: string;
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
 
export const PRESENTATION_PRESETS = [
  { id: 'noir', name: 'Deep Space', value: 'linear-gradient(rgba(5, 5, 16, 0.9), rgba(5, 5, 16, 0.95))', preview: '#050510' },
  { id: 'indigo', name: 'Indigo Flow', value: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', preview: '#312e81' },
  { id: 'emerald', name: 'Tech Emerald', value: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)', preview: '#065f46' },
  { id: 'sunset', name: 'Sunset Glow', value: 'linear-gradient(135deg, #31103f 0%, #721c38 50%, #962a32 100%)', preview: '#721c38' },
  { id: 'slate', name: 'Slate Minimal', value: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', preview: '#1e293b' },
  { id: 'midnight', name: 'Midnight Violet', value: 'linear-gradient(135deg, #180828 0%, #2c0c4d 100%)', preview: '#2c0c4d' },
  { id: 'ocean', name: 'Ocean Abyss', value: 'linear-gradient(135deg, #030712 0%, #0b3c5d 100%)', preview: '#0b3c5d' },
  { id: 'corporate', name: 'Modern Office', value: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop', preview: 'url' },
  { id: 'cyber', name: 'Cyber Neon', value: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop', preview: 'url' },
  { id: 'white', name: 'Clean White', value: '#ffffff', preview: '#ffffff' },
];

export const PRESETS = [
  { id: 'totvs', name: 'Corporativo Agile', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop', description: 'Ambiente profissional e moderno' },
  { id: 'abstract', name: 'Abstract Flow', url: 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2029&auto=format&fit=crop', description: 'Gradients suaves e modernos' },
  { id: 'office', name: 'Focus Office', url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=2069&auto=format&fit=crop', description: 'Ambiente de trabalho limpo' },
  { id: 'creative', name: 'Creative Dash', url: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=2070&auto=format&fit=crop', description: 'Dinâmico e inspirador' },
];
