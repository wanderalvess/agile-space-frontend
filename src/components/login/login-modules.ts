import { HeartPulse, Layers, Lightbulb, MonitorPlay, RefreshCw, type LucideIcon } from 'lucide-react';

/** Módulos mostrados na vitrine do login. Só ilustração: nada aqui vem do servidor. */
export type ModuleKey = 'poker' | 'retro' | 'health' | 'showcase' | 'brainstorming';

export interface LoginModule {
  key: ModuleKey;
  name: string;
  caption: string;
  icon: LucideIcon;
}

export const LOGIN_MODULES: LoginModule[] = [
  { key: 'poker', name: 'Planning Poker', caption: 'Votando em horas, às cegas', icon: Layers },
  { key: 'retro', name: 'Retrospectiva', caption: 'Correu bem, melhorar e ações', icon: RefreshCw },
  { key: 'health', name: 'Radar de clima', caption: 'Como o time está nesta sprint', icon: HeartPulse },
  { key: 'showcase', name: 'Showcase', caption: 'Review com evidências e decisão', icon: MonitorPlay },
  { key: 'brainstorming', name: 'Brainstorming', caption: 'Do mural ao plano de ação', icon: Lightbulb },
];

export const ROTATION_INTERVAL_MS = 5000;
