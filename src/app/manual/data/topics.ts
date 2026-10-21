import { Compass, Handshake, Plug, TestTube, type LucideIcon } from 'lucide-react';
import { moduleIcon, moduleLabel, type ModuleKey } from '@/lib/modules-registry';

export type ManualCategoryId = 'ceremonies' | 'team' | 'knowledge' | 'tools' | 'account';

export interface ManualCategory {
  id: ManualCategoryId;
  label: string;
  description: string;
  /** Módulo cujo ícone representa a categoria na barra lateral (registro único de ícones). */
  iconModule: ModuleKey;
}

/** As cinco categorias do Manual, na ordem em que aparecem no índice e na barra lateral. */
export const MANUAL_CATEGORIES: ManualCategory[] = [
  { id: 'ceremonies', label: 'Cerimônias', description: 'Os encontros da squad, do início ao fim da sprint.', iconModule: 'poker' },
  { id: 'team', label: 'Time e acompanhamento', description: 'Como ver e acompanhar o andamento do time.', iconModule: 'painel' },
  { id: 'knowledge', label: 'Conhecimento e IA', description: 'Onde o time guarda o que sabe e usa IA no trabalho.', iconModule: 'knowledge' },
  { id: 'tools', label: 'Ferramentas', description: 'Utilitários para o trabalho técnico e integrações.', iconModule: 'devtools' },
  { id: 'account', label: 'Conta e ajuda', description: 'Entrar, proteger seus dados e pedir ajuda.', iconModule: 'support' },
];

export interface ManualTopic {
  id: string;
  /** Nome do tópico. Para módulo, é o mesmo nome do registro (o que a pessoa vê no menu), salvo `title` explícito. */
  title: string;
  /** A frase do cartão do índice e do cabeçalho do tópico. */
  summary: string;
  category: ManualCategoryId;
  /** Ícone do tópico: o do módulo, vindo do registro único. Só 3 tópicos sem módulo têm ícone próprio. */
  icon: LucideIcon;
  /** Módulo do registro que o tópico explica (de onde saem o ícone e, em geral, o nome). */
  module?: ModuleKey;
  /** "Atualizado em vX": mantido à mão. Quem muda o texto de um tópico atualiza este campo. */
  updatedIn: string;
  /** Etiqueta "Novo" no cartão e no menu lateral. */
  isNew?: boolean;
  /** Botão do cabeçalho do tópico: rota que existe em `src/app` e o rótulo ("Abrir o Scrum Poker"). */
  actionUrl?: string;
  actionLabel?: string;
  /** Outros nomes que a pessoa pode digitar na busca (nome antigo, sigla, termo técnico). */
  keywords: string[];
  /** Ids dos tópicos de "Veja também". */
  related: string[];
}

interface TopicDef extends Omit<ManualTopic, 'icon' | 'title'> {
  title?: string;
  icon?: LucideIcon;
}

const DEFS: TopicDef[] = [
  // Cerimônias
  {
    id: 'poker', module: 'poker', category: 'ceremonies', updatedIn: 'v4.24.0',
    summary: 'Estime issues em horas por papel e copie o resultado para o Jira.',
    actionUrl: '/room', actionLabel: 'Abrir o Scrum Poker',
    keywords: ['planning poker', 'estimativa', 'horas', 'dev', 'qa', 'baralho'],
    related: ['retro', 'planner', 'action-plan'],
  },
  {
    id: 'retro', module: 'retro', category: 'ceremonies', updatedIn: 'v4.23.0',
    summary: 'Colete o que foi bem e o que melhorar, com votação, chat e plano de ação.',
    actionUrl: '/retro', actionLabel: 'Abrir a Retrospectiva',
    keywords: ['retro', 'retrospectiva', 'kaizen', 'start stop continue'],
    related: ['action-plan', 'brainstorming', 'painel'],
  },
  {
    id: 'showcase', module: 'showcase', category: 'ceremonies', updatedIn: 'v4.22.0',
    summary: 'Apresente a entrega da sprint sem montar slides.',
    actionUrl: '/showcase', actionLabel: 'Abrir a Review',
    keywords: ['showcase', 'sprint review', 'demo', 'modo teatro'],
    related: ['planner', 'poker'],
  },
  {
    id: 'health', module: 'health', category: 'ceremonies', updatedIn: 'v4.24.0',
    summary: 'Meça o clima da squad com uma pesquisa rápida e anônima.',
    actionUrl: '/health-check', actionLabel: 'Abrir o Radar de clima',
    keywords: ['health check', 'clima', 'radar', 'pesquisa', 'anônimo'],
    related: ['retro', 'action-plan'],
  },
  {
    id: 'brainstorming', module: 'brainstorming', category: 'ceremonies', updatedIn: 'v4.24.0',
    summary: 'Gere ideias em grupo, agrupe por tema e transforme as melhores em plano.',
    actionUrl: '/brainstorming', actionLabel: 'Abrir o Brainstorming',
    keywords: ['ideias', 'mural', 'matriz', 'teia'],
    related: ['action-plan', 'retro'],
  },
  {
    id: 'planner', module: 'sprint-planner', title: 'Planejamento da sprint', category: 'ceremonies', updatedIn: 'v4.24.0',
    summary: 'Planeje a sprint pela capacidade real da squad.',
    actionUrl: '/sprint-planner', actionLabel: 'Abrir o Planejamento',
    keywords: ['planejamento', 'sprint planner', 'planning', 'capacidade', 'escopo', 'distribuição'],
    related: ['poker', 'showcase', 'painel'],
  },
  {
    id: 'action-plan', module: 'action-plan', category: 'ceremonies', updatedIn: 'v4.24.0', isNew: true,
    summary: 'Acompanhe as ações das cerimônias até o fim.',
    actionUrl: '/action-plan', actionLabel: 'Abrir o Plano de ação',
    keywords: ['5w2h', 'ações', 'responsável', 'prazo'],
    related: ['retro', 'brainstorming', 'health'],
  },

  // Time e acompanhamento
  {
    id: 'painel', module: 'painel', title: 'Painel e Squad', category: 'team', updatedIn: 'v4.24.0', isNew: true,
    summary: 'Resumo, quadro, cronograma, métricas e painéis por papel da squad.',
    actionUrl: '/squad', actionLabel: 'Abrir a página da squad',
    keywords: ['squad', 'resumo', 'quadro', 'board', 'cronograma', 'métricas', 'painel do time', 'jira', 'sincronizar'],
    related: ['workspace', 'planner', 'integracoes'],
  },
  {
    id: 'workspace', module: 'workspace', category: 'team', updatedIn: 'v4.24.0',
    summary: 'Suas tarefas, notas, atalhos e conexões, só seus.',
    actionUrl: '/workspace', actionLabel: 'Abrir o Meu espaço',
    keywords: ['meu espaço', 'kanban', 'notas', 'atalhos', 'snippets', 'conectividade', 'perfil'],
    related: ['painel', 'prompt-hub', 'integracoes'],
  },

  // Conhecimento e IA
  {
    id: 'knowledge', module: 'knowledge', category: 'knowledge', updatedIn: 'v4.24.0',
    summary: 'Artigos da empresa, com busca e assistente de IA.',
    actionUrl: '/knowledge/kb', actionLabel: 'Abrir a Base de conhecimento',
    keywords: ['kb', 'wiki', 'tdn', 'assistente', 'gemini', 'documentos'],
    related: ['prompt-hub', 'integracoes'],
  },
  {
    id: 'prompt-hub', module: 'prompt-hub', category: 'knowledge', updatedIn: 'v4.21.0',
    summary: 'Prompts, skills e agentes prontos para reaproveitar.',
    actionUrl: '/prompt-hub', actionLabel: 'Abrir o Prompt Hub',
    keywords: ['biblioteca de ia', 'prompts', 'skills', 'agentes', 'gems', 'coleções'],
    related: ['knowledge', 'integracoes'],
  },

  // Ferramentas
  {
    id: 'jolt', module: 'jolt', category: 'tools', updatedIn: 'v4.24.0',
    summary: 'Transforme JSON com especificações escritas à mão ou geradas de um exemplo.',
    actionUrl: '/jolt', actionLabel: 'Abrir o Jolt',
    keywords: ['json', 'layout', 'spec', 'transformação', 'sandbox', 'gerador'],
    related: ['devtools'],
  },
  {
    id: 'devtools', module: 'devtools', category: 'tools', updatedIn: 'v4.24.0', isNew: true,
    summary: 'Formatadores, conversores e geradores para o dia a dia técnico.',
    actionUrl: '/devtools', actionLabel: 'Abrir o DevTools',
    keywords: ['json', 'base64', 'jwt', 'regex', 'cep', 'uuid', 'favoritas', 'recentes'],
    related: ['qualidade', 'jolt'],
  },
  {
    id: 'qualidade', icon: TestTube, title: 'Central de qualidade', category: 'tools', updatedIn: 'v4.24.0', isNew: true,
    summary: 'Testes, massa de dados e automação, no filtro Qualidade do DevTools.',
    actionUrl: '/devtools', actionLabel: 'Abrir o DevTools',
    keywords: ['qa', 'zephyr', 'central de qualidade', 'bdd', 'massa de dados', 'junit'],
    related: ['devtools', 'painel'],
  },
  {
    id: 'integracoes', icon: Plug, title: 'Integrações e API', category: 'tools', updatedIn: 'v4.24.0',
    summary: 'Conecte programas e assistentes de IA ao portal com uma chave de API.',
    actionUrl: '/workspace?aba=conta&sub=conectividade', actionLabel: 'Gerar uma chave de API',
    keywords: ['api', 'mcp', 'chave', 'token', 'rest', 'x-api-key', 'escopos', 'claude'],
    related: ['governance', 'prompt-hub', 'suporte'],
  },

  // Conta e ajuda
  {
    id: 'primeiros-passos', icon: Compass, title: 'Primeiros passos e papéis', category: 'account', updatedIn: 'v4.18.1',
    summary: 'Entre na squad certa e entenda o que cada papel pode fazer.',
    actionUrl: '/onboarding', actionLabel: 'Abrir o primeiro acesso',
    keywords: ['convite', 'vínculo', 'papéis', 'onboarding', 'squad', 'liderança'],
    related: ['governance', 'painel'],
  },
  {
    id: 'governance', module: 'governance', category: 'account', updatedIn: 'v4.24.0',
    summary: 'Como o login, a sessão e as chaves são protegidos.',
    actionUrl: '/governance', actionLabel: 'Abrir Segurança e dados',
    keywords: ['governança', 'segurança', 'lgpd', 'senha', 'sessão', 'privacidade', 'dados', 'login'],
    related: ['integracoes', 'admin', 'suporte'],
  },
  {
    id: 'suporte', module: 'support', category: 'account', updatedIn: 'v4.24.0', isNew: true,
    summary: 'Abra um chamado e acompanhe a resposta.',
    actionUrl: '/support', actionLabel: 'Abrir o Suporte',
    keywords: ['chamado', 'ajuda', 'bug', 'erro', 'sugestão', 'ticket'],
    related: ['versoes', 'admin'],
  },
  {
    id: 'versoes', module: 'changelog', category: 'account', updatedIn: 'v4.24.0', isNew: true,
    summary: 'Veja o que mudou em cada atualização do portal.',
    actionUrl: '/changelog', actionLabel: 'Abrir as Versões',
    keywords: ['changelog', 'novidades', 'release', 'nova versão'],
    related: ['suporte'],
  },
  {
    id: 'admin', module: 'admin', category: 'account', updatedIn: 'v4.24.0', isNew: true,
    summary: 'Pessoas, aprovações, chamados, avisos, integrações e configurações.',
    actionUrl: '/admin', actionLabel: 'Abrir a Administração',
    keywords: ['administração', 'admin', 'usuários', 'aprovações', 'api keys', 'auditoria'],
    related: ['governance', 'suporte'],
  },
  {
    id: 'manifesto', icon: Handshake, title: 'Manifesto', category: 'account', updatedIn: 'v4.24.0',
    summary: 'Os princípios que guiam o portal.',
    keywords: ['princípios', 'valores'],
    related: ['governance'],
  },
];

export const MANUAL_TOPICS: ManualTopic[] = DEFS.map(({ title, icon, ...rest }) => ({
  ...rest,
  title: title ?? (rest.module ? moduleLabel(rest.module) : rest.id),
  icon: icon ?? (rest.module ? moduleIcon(rest.module) : Compass),
}));

export function getTopicById(id: string): ManualTopic | undefined {
  return MANUAL_TOPICS.find((t) => t.id === id);
}

export function getCategory(id: ManualCategoryId): ManualCategory {
  return MANUAL_CATEGORIES.find((c) => c.id === id)!;
}

export function topicsInCategory(id: ManualCategoryId): ManualTopic[] {
  return MANUAL_TOPICS.filter((t) => t.category === id);
}

/** Tópico anterior e próximo na ordem do Manual (categorias na ordem do índice). Sem dar a volta. */
export function neighborsOf(id: string): { prev?: ManualTopic; next?: ManualTopic } {
  const i = MANUAL_TOPICS.findIndex((t) => t.id === id);
  if (i < 0) return {};
  return { prev: MANUAL_TOPICS[i - 1], next: MANUAL_TOPICS[i + 1] };
}

/** Ids antigos ou apelidos que ainda levam ao tópico certo (`/manual#plano`, `/manual#seguranca`...). */
export const TOPIC_ALIASES: Record<string, string> = {
  plano: 'action-plan',
  seguranca: 'governance',
  review: 'showcase',
  planejamento: 'planner',
  'sprint-planner': 'planner',
  qa: 'qualidade',
  changelog: 'versoes',
  support: 'suporte',
};

export function resolveTopicId(raw: string): string | undefined {
  const id = raw.trim().toLowerCase();
  if (getTopicById(id)) return id;
  const alias = TOPIC_ALIASES[id];
  return alias && getTopicById(alias) ? alias : undefined;
}
