import {
  Bot,
  BookOpen,
  FileText,
  Globe,
  Lock,
  MessageSquare,
  Network,
  Settings,
  Sparkles,
  Users,
  ShieldCheck,
  Wrench,
  type LucideIcon
} from 'lucide-react';
import type { PromptType, PromptVisibility, InitiativeStatus, InitiativeImpact } from './types';

/**
 * Fonte única de verdade para a taxonomia do Hub.
 *
 * Antes, cada componente (card, editor, visualização, filtros) mantinha o próprio
 * mapa de tipos. Eles saíram de sincronia — 'workflow' existia no filtro e não no
 * card, que caía num fallback e rotulava o item como "Prompt". Tudo que descreve
 * um tipo, estado, impacto ou visibilidade mora aqui.
 */

export interface TypeMeta {
  /** Rótulo curto, usado em chips e filtros. */
  label: string;
  /** Uma linha explicando o que é o tipo — aparece no seletor do editor. */
  summary: string;
  icon: LucideIcon;
  /** Cor do ícone/acento. Tons escolhidos para passar contraste em light e dark. */
  accent: string;
  /** Fundo suave do chip. Usa opacidade para funcionar nos dois modos. */
  chip: string;
  /** Rótulo do campo de conteúdo no editor. */
  contentLabel: string;
  /** Texto de apoio abaixo do rótulo, quando o formato não é óbvio. */
  contentHint?: string;
  contentPlaceholder: string;
  /** Conteúdo é código/config e deve usar fonte monoespaçada. */
  mono?: boolean;
  /** Item é essencialmente um link para uma ferramenta externa. */
  linkFirst?: boolean;
}

export const TYPE_META: Record<PromptType, TypeMeta> = {
  prompt: {
    label: 'Prompt',
    summary: 'Texto pronto para colar em qualquer chat de IA.',
    icon: MessageSquare,
    accent: 'text-sky-600 dark:text-sky-400',
    chip: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    contentLabel: 'Conteúdo do prompt',
    contentHint: 'Use {{variavel}} para marcar o que muda a cada uso — quem abrir o item preenche os valores antes de copiar.',
    contentPlaceholder: 'Atue como... Analise {{contexto}} e devolva...'
  },
  gem: {
    label: 'Gem',
    summary: 'Modelo já configurado no Gemini ou ferramenta equivalente.',
    icon: Sparkles,
    accent: 'text-amber-600 dark:text-amber-400',
    chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    contentLabel: 'Instruções do Gem',
    contentHint: 'O link é o que importa aqui. O conteúdo é opcional e serve para registrar como o Gem foi configurado.',
    contentPlaceholder: 'Como este Gem foi configurado, o que ele espera receber...',
    linkFirst: true
  },
  agent: {
    label: 'Agente',
    summary: 'Persona e regras de comportamento de um assistente.',
    icon: Bot,
    accent: 'text-rose-600 dark:text-rose-400',
    chip: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
    contentLabel: 'Instruções do sistema',
    contentHint: 'Defina persona, tom e limites. Ex: "Você é um arquiteto focado em performance; nunca sugira reescrever do zero".',
    contentPlaceholder: 'Você é...'
  },
  instruction: {
    label: 'Instrução',
    summary: 'Regras de contexto e padrões que a IA deve seguir sempre.',
    icon: FileText,
    accent: 'text-indigo-600 dark:text-indigo-400',
    chip: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    contentLabel: 'Regras de contexto (Markdown)',
    contentHint: 'Regras estritas de projeto. Ex: "Sempre usar Tailwind, nunca CSS modules".',
    contentPlaceholder: '- Sempre...\n- Nunca...'
  },
  skill: {
    label: 'Skill',
    summary: 'Capacidade empacotada no formato SKILL.md, carregada sob demanda.',
    icon: Wrench,
    accent: 'text-teal-600 dark:text-teal-400',
    chip: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
    contentLabel: 'SKILL.md',
    contentHint: 'Comece pelo frontmatter com name e description. Veja o tutorial do Hub se for sua primeira skill.',
    contentPlaceholder: '---\nname: nome-da-skill\ndescription: O que faz. Use quando...\n---\n\n# Nome da Skill\n\n## Instruções\n',
    mono: true
  },
  workflow: {
    label: 'Workflow',
    summary: 'Sequência de etapas encadeadas para concluir uma tarefa.',
    icon: Network,
    accent: 'text-violet-600 dark:text-violet-400',
    chip: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
    contentLabel: 'Definição do fluxo',
    contentHint: 'Descreva as etapas na ordem em que devem ser executadas, e o que valida cada uma.',
    contentPlaceholder: '1. ...\n2. ...\n3. ...'
  },
  mcp: {
    label: 'MCP',
    summary: 'Configuração de servidor MCP para conectar ferramentas externas.',
    icon: Settings,
    accent: 'text-cyan-600 dark:text-cyan-400',
    chip: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
    contentLabel: 'Configuração do servidor (JSON)',
    contentHint: 'Cole o bloco de configuração. Remova tokens e chaves antes de publicar.',
    contentPlaceholder: '{\n  "mcpServers": {\n    "meu-servidor": {\n      "command": "npx",\n      "args": []\n    }\n  }\n}',
    mono: true
  },
  resource: {
    label: 'Recurso',
    summary: 'Nota técnica, cheatsheet ou material de referência.',
    icon: BookOpen,
    accent: 'text-emerald-600 dark:text-emerald-400',
    chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    contentLabel: 'Conteúdo do recurso',
    contentHint: 'Conceitos, links de referência, limites de modelo, guias para a squad.',
    contentPlaceholder: 'Anotações, links, referências...'
  }
};

export const TYPE_ORDER: PromptType[] = [
  'prompt',
  'skill',
  'agent',
  'gem',
  'instruction',
  'workflow',
  'mcp',
  'resource'
];

export const getTypeMeta = (type?: string): TypeMeta =>
  TYPE_META[(type as PromptType)] ?? TYPE_META.prompt;

export interface StatusMeta {
  label: string;
  chip: string;
}

export const STATUS_META: Record<InitiativeStatus, StatusMeta> = {
  ideacao: { label: 'Ideação', chip: 'bg-muted text-muted-foreground' },
  planejamento: { label: 'Planejamento', chip: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' },
  desenvolvimento: { label: 'Em desenvolvimento', chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  producao: { label: 'Em produção', chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  arquivado: { label: 'Arquivado', chip: 'bg-muted text-muted-foreground' }
};

export const getStatusMeta = (status?: string): StatusMeta =>
  STATUS_META[(status as InitiativeStatus)] ?? STATUS_META.producao;

export const IMPACT_META: Record<InitiativeImpact, { label: string }> = {
  baixo: { label: 'Impacto baixo' },
  medio: { label: 'Impacto médio' },
  alto: { label: 'Impacto alto' }
};

export const getImpactMeta = (impact?: string) =>
  IMPACT_META[(impact as InitiativeImpact)] ?? IMPACT_META.medio;

export interface VisibilityMeta {
  label: string;
  /** Frase completa, usada na tela de detalhe e no editor. */
  description: string;
  icon: LucideIcon;
  /** Escopos ainda não implementados nas consultas do Hub. */
  available: boolean;
}

export const VISIBILITY_META: Record<PromptVisibility, VisibilityMeta> = {
  private: {
    label: 'Somente eu',
    description: 'Visível apenas para você.',
    icon: Lock,
    available: true
  },
  public: {
    label: 'Público',
    description: 'Visível para todo mundo na empresa, inclusive sem login.',
    icon: Globe,
    available: true
  },
  squad: {
    label: 'Minha squad',
    description: 'Compartilhado com a sua squad.',
    icon: Users,
    available: false
  },
  role: {
    label: 'Meu cargo',
    description: 'Compartilhado com quem tem o mesmo cargo.',
    icon: ShieldCheck,
    available: false
  }
};

export const getVisibilityMeta = (visibility?: string): VisibilityMeta =>
  VISIBILITY_META[(visibility as PromptVisibility)] ?? VISIBILITY_META.private;

export type SortKey = 'recent' | 'used' | 'forked' | 'alpha';

export const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'recent', label: 'Mais recentes' },
  { value: 'used', label: 'Mais usados' },
  { value: 'forked', label: 'Mais clonados' },
  { value: 'alpha', label: 'A-Z' }
];
