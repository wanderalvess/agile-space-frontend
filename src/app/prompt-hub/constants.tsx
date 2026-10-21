import {
  Bot,
  BookOpen,
  FileText,
  Globe,
  Lock,
  MessageSquare,
  Network,
  Plug,
  Sparkles,
  Wrench,
  type LucideIcon
} from 'lucide-react';
import type { PromptType, PromptVisibility, InitiativeStatus, InitiativeImpact, StatusFilter } from './types';

/**
 * Fonte única de verdade para a taxonomia do Hub.
 *
 * Tudo que descreve um tipo, situação, impacto ou visibilidade mora aqui: cartão,
 * página do item, editor e filtros leem os mesmos rótulos. Todos os tipos usam o
 * mesmo chip de marca (só o ícone muda), então não há cor por tipo para quebrar nos temas.
 */

export interface TypeMeta {
  /** Rótulo curto, usado em chips e filtros. */
  label: string;
  /** Uma linha explicando o que é o tipo — aparece no seletor do editor e no guia. */
  summary: string;
  icon: LucideIcon;
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
    summary: 'Texto pronto para colar em qualquer chat de IA, com campos para preencher.',
    icon: MessageSquare,
    contentLabel: 'Conteúdo do prompt',
    contentHint: 'Use {{campo}} para marcar o que muda a cada uso — quem abrir o item preenche os valores antes de copiar.',
    contentPlaceholder: 'Atue como... Analise {{contexto}} e devolva...'
  },
  gem: {
    label: 'Gem',
    summary: 'Assistente já configurado no Gemini ou ferramenta equivalente; o item guarda o link.',
    icon: Sparkles,
    contentLabel: 'Instruções de uso',
    contentHint: 'O link é o que importa aqui. O conteúdo é opcional e serve para registrar como o Gem foi configurado.',
    contentPlaceholder: 'Como este Gem foi configurado, o que ele espera receber...',
    linkFirst: true
  },
  agent: {
    label: 'Agente',
    summary: 'Papel e regras de comportamento de um assistente especializado.',
    icon: Bot,
    contentLabel: 'Instruções do sistema',
    contentHint: 'Defina persona, tom e limites. Ex: "Você é um arquiteto focado em performance; nunca sugira reescrever do zero".',
    contentPlaceholder: 'Você é...'
  },
  instruction: {
    label: 'Instrução',
    summary: 'Regras fixas de contexto que a IA deve seguir em toda conversa.',
    icon: FileText,
    contentLabel: 'Regras de contexto (Markdown)',
    contentHint: 'Regras estritas de projeto. Ex: "Sempre usar Tailwind, nunca CSS modules".',
    contentPlaceholder: '- Sempre...\n- Nunca...'
  },
  skill: {
    label: 'Skill',
    summary: 'Pasta com SKILL.md que o assistente carrega sozinho quando precisa.',
    icon: Wrench,
    contentLabel: 'SKILL.md',
    contentHint: 'Comece pelo cabeçalho com name e description. Veja o tutorial se for a sua primeira skill.',
    contentPlaceholder: '---\nname: nome-da-skill\ndescription: O que faz. Use quando...\n---\n\n# Nome da Skill\n\n## Instruções\n',
    mono: true
  },
  workflow: {
    label: 'Fluxo de trabalho',
    summary: 'Sequência de passos entre pessoas e ferramentas para concluir uma tarefa.',
    icon: Network,
    contentLabel: 'Definição do fluxo',
    contentHint: 'Descreva as etapas na ordem em que devem ser executadas, e o que valida cada uma.',
    contentPlaceholder: '1. ...\n2. ...\n3. ...'
  },
  mcp: {
    label: 'MCP',
    summary: 'Configuração para ligar o assistente a um sistema ou ferramenta externa.',
    icon: Plug,
    contentLabel: 'Configuração do servidor (JSON)',
    contentHint: 'Cole o bloco de configuração. Remova tokens e chaves antes de publicar.',
    contentPlaceholder: '{\n  "mcpServers": {\n    "meu-servidor": {\n      "command": "npx",\n      "args": []\n    }\n  }\n}',
    mono: true
  },
  resource: {
    label: 'Recurso',
    summary: 'Material de apoio: checklist, nota técnica, modelo ou exemplo.',
    icon: BookOpen,
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
  /** Tom do chip: neutro, atenção (âmbar) ou perigo suave. */
  tone: 'neutral' | 'warn' | 'success' | 'danger';
}

export const STATUS_META: Record<InitiativeStatus, StatusMeta> = {
  ideacao: { label: 'Ideação', tone: 'neutral' },
  planejamento: { label: 'Planejamento', tone: 'neutral' },
  desenvolvimento: { label: 'Desenvolvimento', tone: 'warn' },
  producao: { label: 'Produção', tone: 'success' },
  arquivado: { label: 'Arquivado', tone: 'danger' }
};

export const STATUS_ORDER: InitiativeStatus[] = ['ideacao', 'planejamento', 'desenvolvimento', 'producao', 'arquivado'];

export const getStatusMeta = (status?: string): StatusMeta =>
  STATUS_META[(status as InitiativeStatus)] ?? STATUS_META.producao;

/** Opções do filtro "Situação": o padrão esconde os arquivados. */
export const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'active', label: 'Sem arquivados' },
  { value: 'all', label: 'Todos' },
  ...STATUS_ORDER.map(value => ({ value: value as StatusFilter, label: STATUS_META[value].label }))
];

export const IMPACT_META: Record<InitiativeImpact, { label: string; filterLabel: string }> = {
  baixo: { label: 'Impacto baixo', filterLabel: 'Baixo' },
  medio: { label: 'Impacto médio', filterLabel: 'Médio' },
  alto: { label: 'Impacto alto', filterLabel: 'Alto' }
};

export const IMPACT_ORDER: InitiativeImpact[] = ['alto', 'medio', 'baixo'];

export const getImpactMeta = (impact?: string) =>
  IMPACT_META[(impact as InitiativeImpact)] ?? IMPACT_META.medio;

export interface VisibilityMeta {
  /** Rótulo do chip e do filtro. */
  label: string;
  /** Frase completa, usada no editor e no guia. */
  description: string;
  icon: LucideIcon;
}

export const VISIBILITY_META: Record<PromptVisibility, VisibilityMeta> = {
  private: {
    label: 'Privado',
    description: 'Só você vê e usa.',
    icon: Lock
  },
  public: {
    label: 'Público',
    description: 'Todos da empresa veem, copiam e duplicam, inclusive sem login.',
    icon: Globe
  }
};

export const VISIBILITY_ORDER: PromptVisibility[] = ['private', 'public'];

/** Qualquer valor que não seja "public" (inclusive os antigos de squad e cargo, que deixaram de existir) conta como privado. */
export const getVisibilityMeta = (visibility?: string): VisibilityMeta =>
  VISIBILITY_META[visibility === 'public' ? 'public' : 'private'];

/** Valores aceitos pelo servidor em `sort`. */
export type SortKey = 'recent' | 'used' | 'cloned' | 'az';

export const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'recent', label: 'Mais recentes' },
  { value: 'used', label: 'Mais usados' },
  { value: 'cloned', label: 'Mais duplicados' },
  { value: 'az', label: 'A a Z' }
];
