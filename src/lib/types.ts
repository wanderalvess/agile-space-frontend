'use client';

import {
  Code,
  Bug,
  BrainCircuit,
  Eye,
  Users,
  Zap,
  Target,
  Palette,
  User,
  Clock,
  ListChecks
} from 'lucide-react';

export type GlobalRole =
  | 'Agile Master'
  | 'Scrum Master'
  | 'Product Owner'
  | 'Tech Lead'
  | 'People Lead'
  | 'Tribe Lead'
  | 'Agile Coach'
  | 'Developer'
  | 'QA'
  | 'Designer'
  | 'UX'
  | 'SME'
  | 'Stakeholder / Observador'
  // Variantes/rótulos em PT usados nos modais de perfil e nos switches de
  // mapeamento legado (room/retro). Fazem parte do vocabulário de papéis.
  | 'Desenvolvedor(a)'
  | 'Analista de QA'
  | 'Designer / UI-UX'
  | 'Product Owner (PO)'
  | 'Scrum Master / Agile Coach'
  | 'Arquiteto(a) / Tech Lead'
  | 'admin'
  | 'user';

export const ROLES: GlobalRole[] = [
  'Product Owner',
  'People Lead',
  'Agile Master',
  'Tech Lead',
  'Tribe Lead',
  'Agile Coach',
  'Developer',
  'QA',
  'Designer',
  'UX',
  'SME'
];

export const SQUADS = ['Varejo', 'MISSI', 'Sem Time'];

export const PREDEFINED_AVATARS: Record<string, any> = {
  Felix: {
  "sex": "woman",
  "faceColor": "#AC6651",
  "earSize": "small",
  "eyeStyle": "circle",
  "noseStyle": "short",
  "mouthStyle": "laugh",
  "shirtStyle": "short",
  "glassesStyle": "none",
  "hairColor": "#F48150",
  "hairStyle": "womanLong",
  "hatStyle": "none",
  "hatColor": "#F48150",
  "eyeBrowStyle": "upWoman",
  "shirtColor": "#FC909F",
  "bgColor": "linear-gradient(45deg, #178bff 0%, #ff6868 100%)"
  },
  Aneka: {
  "sex": "woman",
  "faceColor": "#AC6651",
  "earSize": "big",
  "eyeStyle": "oval",
  "noseStyle": "round",
  "mouthStyle": "laugh",
  "shirtStyle": "polo",
  "glassesStyle": "round",
  "hairColor": "#000",
  "hairStyle": "womanLong",
  "hatStyle": "none",
  "hatColor": "#F48150",
  "eyeBrowStyle": "upWoman",
  "shirtColor": "#F4D150",
  "bgColor": "linear-gradient(45deg, #3e1ccd 0%, #ff6871 100%)"
  },
  Loki: {
  "sex": "woman",
  "faceColor": "#F9C9B6",
  "earSize": "big",
  "eyeStyle": "oval",
  "noseStyle": "short",
  "mouthStyle": "laugh",
  "shirtStyle": "polo",
  "glassesStyle": "round",
  "hairColor": "#F48150",
  "hairStyle": "womanShort",
  "hatStyle": "none",
  "hatColor": "#000",
  "eyeBrowStyle": "up",
  "shirtColor": "#FC909F",
  "bgColor": "#74D153"
  },
  Milo: {
  "sex": "man",
  "faceColor": "#AC6651",
  "earSize": "small",
  "eyeStyle": "smile",
  "noseStyle": "short",
  "mouthStyle": "laugh",
  "shirtStyle": "polo",
  "glassesStyle": "none",
  "hairColor": "#000",
  "hairStyle": "thick",
  "hatStyle": "none",
  "hatColor": "#F48150",
  "eyeBrowStyle": "up",
  "shirtColor": "#77311D",
  "bgColor": "linear-gradient(90deg, #36cd1c 0%, #68deff 100%)"
  },
  Jude: {
  "sex": "woman",
  "faceColor": "#F9C9B6",
  "earSize": "small",
  "eyeStyle": "oval",
  "noseStyle": "round",
  "mouthStyle": "smile",
  "shirtStyle": "polo",
  "glassesStyle": "none",
  "hairColor": "#F48150",
  "hairStyle": "womanLong",
  "hatStyle": "none",
  "hatColor": "#F48150",
  "eyeBrowStyle": "up",
  "shirtColor": "#77311D",
  "bgColor": "linear-gradient(45deg, #3e1ccd 0%, #ff6871 100%)"
  },
  Callie: {
  "sex": "man",
  "faceColor": "#F9C9B6",
  "earSize": "small",
  "eyeStyle": "smile",
  "noseStyle": "round",
  "mouthStyle": "laugh",
  "shirtStyle": "short",
  "glassesStyle": "none",
  "hairColor": "#000",
  "hairStyle": "thick",
  "hatStyle": "none",
  "hatColor": "#D2EFF3",
  "eyeBrowStyle": "up",
  "shirtColor": "#FC909F",
  "bgColor": "#74D153"
  },
  Garfield: {
  "sex": "man",
  "faceColor": "#F9C9B6",
  "earSize": "small",
  "eyeStyle": "smile",
  "noseStyle": "short",
  "mouthStyle": "laugh",
  "shirtStyle": "short",
  "glassesStyle": "round",
  "hairColor": "#000",
  "hairStyle": "thick",
  "hatStyle": "none",
  "hatColor": "#506AF4",
  "eyeBrowStyle": "up",
  "shirtColor": "#77311D",
  "bgColor": "linear-gradient(45deg, #ff1717 0%, #ffd368 100%)"
  },
  Ginger: {
  "sex": "man",
  "faceColor": "#F9C9B6",
  "earSize": "big",
  "eyeStyle": "circle",
  "noseStyle": "short",
  "mouthStyle": "smile",
  "shirtStyle": "hoody",
  "glassesStyle": "none",
  "hairColor": "#000",
  "hairStyle": "normal",
  "hatStyle": "beanie",
  "hatColor": "#FC909F",
  "eyeBrowStyle": "up",
  "shirtColor": "#6BD9E9",
  "bgColor": "#F4D150"
  },
  Midnight: {
  "sex": "woman",
  "faceColor": "#F9C9B6",
  "earSize": "small",
  "eyeStyle": "oval",
  "noseStyle": "long",
  "mouthStyle": "smile",
  "shirtStyle": "hoody",
  "glassesStyle": "none",
  "hairColor": "#F48150",
  "hairStyle": "normal",
  "hatStyle": "none",
  "hatColor": "#F48150",
  "eyeBrowStyle": "up",
  "shirtColor": "#F4D150",
  "bgColor": "#D2EFF3"
  },
  Mia: {
  "sex": "man",
  "faceColor": "#F9C9B6",
  "earSize": "small",
  "eyeStyle": "smile",
  "noseStyle": "long",
  "mouthStyle": "smile",
  "shirtStyle": "polo",
  "glassesStyle": "none",
  "hairColor": "#000",
  "hairStyle": "mohawk",
  "hatStyle": "none",
  "hatColor": "#F48150",
  "eyeBrowStyle": "up",
  "shirtColor": "#FC909F",
  "bgColor": "linear-gradient(45deg, #ff1717 0%, #ffd368 100%)"
  }
};

export const AVATAR_SEEDS = Object.keys(PREDEFINED_AVATARS);

export interface UserProfile {
  id: string;
  name: string;
  role: GlobalRole;
  squadId: string;
  team?: string; // Mantido temporariamente para compatibilidade
  isGuest: boolean;
  email?: string;
  avatarSeed?: string;
  dailyHours?: number; // Carga horária individual
  googleAccessToken?: string; // Cache de sincronização
}

export type IssueStatus = 'pending' | 'active' | 'completed';
export type IssueType = 'dev' | 'qa' | 'design' | 'other';

export interface Issue {
  id: string;
  key?: string | null;
  title: string;
  jiraLink?: string | null;
  status: IssueStatus;
  estimatedPoints: string | null;
  devPoints?: string | null;
  qaPoints?: string | null;
  rolePoints?: Record<string, string> | null;
  type?: IssueType;
  skipped?: boolean;
  note?: string | null;
  // Adiado ("park"): devolvido ao fim da fila como pendente para revisitar
  // ainda nesta sessão. Distinto de `skipped` (que finaliza como pulado). É só
  // uma dica visual enquanto o item está pending; limpo ao ser estimado.
  parked?: boolean;
  parkedNote?: string | null;
  // Quantas vezes o item foi adiado nesta sessão. Diferente de `parked`, NÃO é
  // limpo ao estimar — é o que permite o relatório final dizer "adiada 2x e
  // depois estimada" em vez de perder essa informação.
  parkCount?: number;
  // Momento em que o item entrou na mesa (virou ativo) DEPOIS que a sessão foi
  // iniciada. É o marco real de "começou a discussão deste item" — inclui o
  // debate anterior ao primeiro voto, que antes ficava de fora da conta. Não é
  // carimbado antes do início da sessão (sala criada de manhã já deixa o
  // primeiro item ativo).
  startedAt?: string | null;
  // Nota de decisão: por que o time chegou nessa estimativa (rastreabilidade).
  decisionNote?: string | null;
  // Notas de refinamento por frente (opt-in): solução técnica (dev) e cenários
  // de teste/riscos (qa), capturadas durante a discussão do item.
  devNotes?: string | null;
  qaNotes?: string | null;
  // Jira Rich Context
  description?: string;
  jiraType?: string;
  jiraStatus?: string;
  jiraPriority?: string;
  jiraAssignee?: string;
  jiraUpdated?: string;
  jiraLabels?: string[];
  acceptanceCriteria?: string;
  // Story points já existentes no Jira (referência; não é a estimativa da sala).
  jiraPoints?: string;
}

export type Room = {
  id: string;
  deckType: DeckType;
  votesRevealed: boolean;
  creatorId: string;
  currentTopic?: string;
  timer?: TimerState;
  issuesQueue: Issue[];
  activeIssueId: string | null;
  title?: string;
  team?: string;
  sessionStartedAt?: string;
  sessionEndedAt?: string;
  createdAt: string;
  participantIds?: string[];
  summary?: any;
  mode?: 'sync' | 'async';
  revealedIssues?: string[];
  participantsCount?: number;
  // Categoria técnica (Developer/QA/UX/Designer) em revotação seletiva, ou
  // null. Antes era um Role de sala ('dev'/'qa'), o que não distinguia
  // UX/Designer (ambos mapeiam para role 'dev'); passou a guardar a categoria.
  selectiveRevotingRole?: string | null;
  // História de referência (baseline): âncora de comparação visível durante a
  // votação. Snapshot congelado do valor já estimado no momento em que foi
  // fixada — não muda se o item for revotado depois ("votos são fatos"). É
  // limpa ao trocar de deck, pois o `display` é relativo à escala. Ausente/null
  // = sem referência.
  referenceBaseline?: {
    issueId: string;
    key?: string | null;
    title: string;
    display: string; // rótulo pronto: "5 SP" | "8h" | "M"
    deckType: DeckType;
  } | null;
  settings?: {
    allowManagementToVote?: boolean;
    // Revela automaticamente quando todos os votantes elegíveis já votaram.
    autoReveal?: boolean;
    // Limites de divergência numérica (deck de horas) por categoria: diferença
    // (máx-mín) acima de `warn` marca aviso; acima de `high` marca crítico.
    // Ausente = padrão histórico { warn: 2, high: 5 }.
    divergenceThresholds?: { warn: number; high: number };
    // Ao revelar, destaca o maior e o menor votante de cada categoria pedindo
    // justificativa (ritual de refinamento). Default off = nada muda.
    outlierPrompt?: boolean;
    // Permite marcar confiança (baixa/média/alta) junto do voto. Default off.
    confidenceVote?: boolean;
    // Mostra o histórico/velocity do time (sessões anteriores) no dashboard
    // final. Default off.
    showVelocity?: boolean;
    // Revela apenas a distribuição/estatística, escondendo quem votou o quê
    // (reduz ancoragem por hierarquia). Default off = mostra nomes como hoje.
    anonymousReveal?: boolean;
    // Avisa o votante (toast + som, se habilitado) quando é a vez dele votar
    // numa nova rodada. Default off.
    turnNotification?: boolean;
    // Mostra um histograma da distribuição dos votos ao revelar (revela
    // bimodalidade que a média esconde). Default off.
    showDistribution?: boolean;
    // Habilita o campo de nota de decisão ("por que estimamos X") ao revelar.
    // Default off.
    decisionNotes?: boolean;
    // Mostra o tempo real gasto em cada tópico no dashboard final (derivado
    // dos timestamps das rodadas). Default off.
    perTopicTime?: boolean;
    // Inicia o timer automaticamente quando uma nova tarefa fica ativa.
    // Default off.
    autoTimer?: boolean;
    // Ao revelar, conta os votos "?" (preciso de info) e oferece enviar a
    // tarefa para grooming em vez de forçar um número. Default off.
    groomingFlag?: boolean;
    // Ao revelar com consenso pleno (todos iguais), salva a estimativa e avança
    // automaticamente. Default off.
    autoConsensus?: boolean;
    // Ao revelar com divergência crítica, sugere revotação. Default off.
    suggestRevote?: boolean;
    // Barra de reações (emoji) efêmeras durante a votação. Default off.
    reactions?: boolean;
    // Equivalência numérica por tamanho no baralho de camisetas (ex:
    // PP = 4 horas, GG = 1 semana) definida pelo facilitador na criação da
    // sala. Quando presente, o resultado passa a ser calculado de verdade
    // (média em horas, convertendo cada unidade pela tabela TSHIRT_UNIT_HOURS)
    // em vez da moda categórica. Ausente = comportamento histórico (moda).
    tshirtEquivalents?: Partial<Record<'PP' | 'P' | 'M' | 'G' | 'GG', TshirtEquivalent>>;
    // No Detalhamento de Votos, agrupa as cartas por papel (Developer/QA/UX/…)
    // com cabeçalho por cargo. Default off = grade única como hoje.
    groupVotesByRole?: boolean;
    // Permite fixar uma história já estimada como régua/âncora visível durante
    // a votação (comparação relativa). Default off.
    referenceStory?: boolean;
    // Conta as rodadas de votação do item ativo e, ao passar de `maxRounds`
    // sem consenso, sugere quebrar ou adiar a história. Default off.
    roundNudge?: boolean;
    // Teto de rodadas antes do aviso do roundNudge. Ausente = 3.
    maxRounds?: number;
    // Painel de notas de refinamento (Dev/QA) por item durante a votação.
    // Default off.
    refinementNotes?: boolean;
    // Habilita "Adiar" (park): devolve o item ao fim da fila para revisitar.
    // Default off = mantém só o botão "Pular / Adiar" original (skip), sem
    // mudar o comportamento atual dos clientes.
    parkTask?: boolean;
  };
}

export type Role = 'dev' | 'qa' | 'organizador' | 'spectator';

export type Participant = {
  id: string;
  roomId: string;
  nickname: string;
  email?: string;
  isFacilitator: boolean;
  role: Role;
  globalRole?: GlobalRole;
  // Heartbeat de presença (ISO). Atualizado periodicamente pelo próprio
  // participante; ausência/valor stale => considerado offline.
  lastSeen?: string;
};

export type Vote = {
  id: string;
  participantId: string;
  roomId: string;
  value: string;
  timestamp: string;
  issueId?: string;
  // Metadata persistido para "votos são fatos"
  participantNickname?: string;
  participantRole?: Role;
  participantGlobalRole?: GlobalRole;
  // Confiança opcional na estimativa (feature opt-in). Ausente = não informado.
  confidence?: 'low' | 'medium' | 'high';
}

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export type VotingRound = {
  id: string;
  roomId: string;
  topic: string;
  issueId?: string;
  deckType: DeckType;
  votes: Vote[];
  stats: {
    avg: string;
    min: string;
    max: string;
    consensus: boolean;
  };
  devPoints?: string | null;
  qaPoints?: string | null;
  rolePoints?: Record<string, string> | null;
  timestamp: string;
  skipped?: boolean;
  note?: string | null;
}

export type DeckType = 'fibonacci' | 'hours' | 'tshirt';

export const DECKS: Record<DeckType, readonly string[]> = {
  fibonacci: ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'],
  hours: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '12', '14', '16', '18', '20', '25', '30', '35', '40', '45', '50', '?', '☕'],
  tshirt: ['PP', 'P', 'M', 'G', 'GG', '?', '☕'],
};

// Unidades aceitas na equivalência do baralho de camisetas. Tudo converte
// pra horas (base comum) pra poder calcular média/soma de verdade.
export type TshirtUnit = 'hora' | 'dia' | 'semana' | 'sprint' | 'mes' | 'semestre';

export const TSHIRT_UNIT_HOURS: Record<TshirtUnit, number> = {
  hora: 1,
  dia: 8,       // 1 dia de trabalho
  semana: 40,   // 5 dias
  sprint: 80,   // assume sprint de 2 semanas — ajustável pelo facilitador trocando a unidade
  mes: 160,     // 4 semanas
  semestre: 960, // 6 meses
};

export const TSHIRT_UNIT_LABELS: Record<TshirtUnit, string> = {
  hora: 'hora(s)',
  dia: 'dia(s)',
  semana: 'semana(s)',
  sprint: 'sprint(s)',
  mes: 'mês(es)',
  semestre: 'semestre(s)',
};

export type TshirtEquivalent = { value: number; unit: TshirtUnit };

export type TimerStatus = 'stopped' | 'running' | 'paused';

export type TimerState = {
  status: TimerStatus;
  endTime: number | null; // JS timestamp (ms)
  initialDuration: number; // seconds
  remainingOnPause: number; // seconds
};

export type RetroColumnKey = string;

export type RetroColumnTheme = 'success' | 'warning' | 'action' | 'neutral' | 'purple' | 'pink' | 'cyan';

export type RetroColumnDef = {
  id: string;
  title: string;
  theme: RetroColumnTheme;
  order: number;
};

/** Templates pré-configurados para retrospectivas */
export type RetroTemplateKey = 'classic' | 'start_stop_continue' | 'mad_sad_glad' | 'starfish' | 'four_ls' | 'daki' | 'sailboat' | 'three_little_pigs' | 'speed_car' | 'custom';

export const RETRO_TEMPLATES: Record<Exclude<RetroTemplateKey, 'custom'>, RetroColumnDef[]> = {
  classic: [
    { id: 'wentWell', title: 'O que funcionou?', theme: 'success', order: 0 },
    { id: 'toImprove', title: 'O que melhorar?', theme: 'warning', order: 1 },
    { id: 'actionItems', title: 'Plano de Ação', theme: 'action', order: 2 },
  ],
  start_stop_continue: [
    { id: 'start', title: 'Começar (Start)', theme: 'purple', order: 0 },
    { id: 'stop', title: 'Parar (Stop)', theme: 'warning', order: 1 },
    { id: 'continue', title: 'Continuar (Continue)', theme: 'success', order: 2 },
  ],
  mad_sad_glad: [
    { id: 'glad', title: 'Feliz (Glad)', theme: 'success', order: 0 },
    { id: 'sad', title: 'Triste (Sad)', theme: 'cyan', order: 1 },
    { id: 'mad', title: 'Irritado (Mad)', theme: 'warning', order: 2 },
  ],
  starfish: [
    { id: 'keep', title: 'Manter (Keep)', theme: 'success', order: 0 },
    { id: 'less', title: 'Menos de... (Less)', theme: 'warning', order: 1 },
    { id: 'more', title: 'Mais de... (More)', theme: 'cyan', order: 2 },
    { id: 'start', title: 'Começar (Start)', theme: 'purple', order: 3 },
    { id: 'stop', title: 'Parar (Stop)', theme: 'pink', order: 4 },
  ],
  four_ls: [
    { id: 'liked', title: 'Curti (Liked)', theme: 'success', order: 0 },
    { id: 'learned', title: 'Aprendi (Learned)', theme: 'purple', order: 1 },
    { id: 'lacked', title: 'Faltou (Lacked)', theme: 'warning', order: 2 },
    { id: 'longed_for', title: 'Desejei (Longed For)', theme: 'cyan', order: 3 },
    { id: 'actionItems', title: 'Plano de Ação', theme: 'action', order: 4 },
  ],
  daki: [
    { id: 'drop', title: 'Remover (Drop)', theme: 'pink', order: 0 },
    { id: 'add', title: 'Adicionar (Add)', theme: 'purple', order: 1 },
    { id: 'keep', title: 'Manter (Keep)', theme: 'success', order: 2 },
    { id: 'improve', title: 'Melhorar (Improve)', theme: 'warning', order: 3 },
    { id: 'actionItems', title: 'Plano de Ação', theme: 'action', order: 4 },
  ],
  sailboat: [
    { id: 'wind', title: 'Vento (O que nos empurra?)', theme: 'success', order: 0 },
    { id: 'sun', title: 'Sol (O que nos faz feliz?)', theme: 'cyan', order: 1 },
    { id: 'anchor', title: 'Âncora (O que nos trava?)', theme: 'warning', order: 2 },
    { id: 'rocks', title: 'Pedras (Riscos adiante)', theme: 'pink', order: 3 },
    { id: 'actionItems', title: 'Plano de Ação', theme: 'action', order: 4 },
  ],
  three_little_pigs: [
    { id: 'straw', title: 'Palha (Frágil - Mudar já)', theme: 'pink', order: 0 },
    { id: 'wood', title: 'Madeira (Pode melhorar)', theme: 'warning', order: 1 },
    { id: 'brick', title: 'Tijolo (Sólido - Manter)', theme: 'success', order: 2 },
    { id: 'actionItems', title: 'Plano de Ação', theme: 'action', order: 3 },
  ],
  speed_car: [
    { id: 'engine', title: 'Motor (Aceleradores)', theme: 'success', order: 0 },
    { id: 'parachute', title: 'Paraquedas (Freadores)', theme: 'warning', order: 1 },
    { id: 'actionItems', title: 'Plano de Ação', theme: 'action', order: 2 },
  ],
};

export type RetroBoard = {
  id: string;
  creatorId: string;
  isCardsRevealed: boolean;
  votingStatus: 'disabled' | 'active' | 'finished';
  timer?: TimerState;
  title?: string;
  team?: string;
  createdAt: string;
  participantIds?: string[];
  summary?: any;
  isAuthorsRevealed: boolean;
  columnSorts?: Record<string, boolean>;
  columns?: RetroColumnDef[];
  templateKey?: RetroTemplateKey;
  syncStageEnabled?: boolean;
  activeColumnKey?: RetroColumnKey; // só relevante quando syncStageEnabled=true
  autoRevealOnTimerEnd?: boolean;
  autoSortOnVoteEnd?: boolean;
}

export type RetroCard = {
  id: string;
  boardId: string;
  columnKey: RetroColumnKey;
  content: string;
  authorId: string;
  votes: string[]; // Array of user UIDs
  order: number;
  assignee?: string;
  dueDate?: string;
  originalTexts?: string[]; // Para histórico de agrupamento
  children?: RetroCard[];
  isDone?: boolean; // status do item de ação (rastreio entre sprints)
  carriedFromBoardId?: string; // preenchido quando importado de uma retro anterior
  carriedFromBoardTitle?: string; // denormalizado para exibir badge sem leitura extra
}

export type RetroParticipant = {
  id: string; // user UID
  boardId: string;
  nickname: string;
  role?: TeamRole;
  isCreator: boolean;
  globalRole?: GlobalRole;
};

// --- Team Health Check ---

export type TeamRole = 'AM' | 'PO' | 'PL' | 'DEV' | 'QA' | 'UX' | 'SME' | 'OUTRO';

export type HealthCheckScaleType = 'traffic_light' | 'numbers_5' | 'emojis';

export type HealthCheckVoteValue = 'green' | 'yellow' | 'red' | '1' | '2' | '3' | '4' | '5' | 'happy' | 'neutral' | 'sad';

export type HealthCheckDimension = {
  key: string;
  title: string;
  description: string;
};

export const TEAM_ROLE_DESCRIPTIONS: Record<TeamRole, { name: string; icon: React.ComponentType<any> }> = {
  AM: { name: 'Agile Master', icon: Zap },
  PO: { name: 'Product Owner', icon: Target },
  PL: { name: 'Project Lead', icon: Users },
  DEV: { name: 'Desenvolvedor', icon: Code },
  QA: { name: 'Quality Assurance', icon: Bug },
  UX: { name: 'UX/UI', icon: Palette },
  SME: { name: 'SME', icon: BrainCircuit },
  OUTRO: { name: 'Outro', icon: User },
};

export type HealthCheckBoard = {
  id: string;
  creatorId: string;
  status: 'collecting' | 'finished';
  createdAt: string;
  dimensions: HealthCheckDimension[];
  scaleType: HealthCheckScaleType;
  sprintName?: string;
  team?: string;
  participantIds?: string[];
  summary?: {
    topMetrics: string[];
    lowMetrics: string[];
    results: {
      dimensionKey: string;
      values: Record<string, number>; // Dinâmico: { 'green': 5, '1': 2, etc }
      average?: number;
    }[];
  };
}

export type HealthCheckParticipant = {
  id: string; // user UID
  boardId: string;
  nickname: string;
  role: TeamRole;
}

export type HealthCheckVote = {
  id: string;
  boardId: string;
  participantId: string;
  participantRole: TeamRole;
  dimensionKey: string;
  value: HealthCheckVoteValue;
  comment?: string;
  timestamp: string;
}

export type HealthCheckRound = {
  id: string;
  boardId: string;
  title?: string;
  timestamp: string;
  participants: HealthCheckParticipant[];
  votes: HealthCheckVote[];
  results: {
    dimensionKey: string;
    values: Record<string, number>;
    average?: number;
  }[];
}

// --- Brainstorming ---

export type BrainstormingPhase = 'ideation' | 'diagram' | 'grouping' | 'prioritization' | 'actions';

export type BrainstormingGroup = {
  id: string;
  boardId: string;
  title: string;
  order: number;
  color?: string;
};

export type BrainstormingBoard = {
  id: string;
  creatorId: string;
  title: string;
  team: string;
  createdAt: string;
  phase: BrainstormingPhase;
  settings: {
    isAnonymous: boolean;
    isPresentationMode?: boolean;
    isRevealed?: boolean;
  };
  participantIds?: string[];
  timer?: TimerState;
};

export type BrainstormingIdea = {
  id: string;
  boardId: string;
  content: string;
  authorId: string;
  votes: string[]; // Array de UIDs de usuários
  position: { x: number; y: number };
  parentId: string | null;
  groupId: string | null;
  createdAt: string;
  color?: string; // Para diferenciação visual opcional
  qualifiers?: {
    roi?: number;
    effort?: number;
  };
  // Ideias empilhadas/filhas (montadas em memória para renderização em árvore).
  children?: BrainstormingIdea[];
};

// --- Daily Flow ---
export interface DailyCheckin {
  id: string; // formato: {userId}_{date}
  userId: string;
  userName: string;
  userRole: GlobalRole;
  userAvatar?: string;
  squadId: string;
  date: string; // YYYY-MM-DD
  yesterday: string;
  today: string;
  blockers?: string;
  blockerDuration?: string | null;
  hasBlocker: boolean;
  isPrivate?: boolean | null;
  createdAt: string;
}

export type AvailabilityType = 'full' | 'partial';

export interface UserAvailability {
  id: string; // {userId}_{date}
  userId: string;
  userName: string;
  userRole: GlobalRole;
  squadId: string;
  date: string; // YYYY-MM-DD
  type: AvailabilityType;
  note?: string;
  source: 'manual' | 'google_calendar';
  updatedAt: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  status: string;
}

// --- Action Plan (5W2H) ---

export type ActionPlanBoard = {
  id: string;
  creatorId: string;
  title: string;
  team: string;
  createdAt: string;
  participantIds?: string[];
  settings?: {
    isPublic: boolean;
  };
};

export type ActionPlanTaskStatus = 'todo' | 'doing' | 'done' | 'blocked';

export type ActionPlanTask = {
  id: string;
  boardId: string;
  what: string;       // O que será feito
  why: string;        // Por que será feito
  where: string;      // Onde será feito
  when: string;       // Quando será feito (Prazo)
  who: string;        // Quem é o responsável
  how: string;        // Como será feito
  howMuch: string;    // Quanto custará (Tempo/Esforço/Dinheiro)
  status: ActionPlanTaskStatus;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  order: number;
};

// --- Squad Pulse (dashboard de produtividade de time via Jira) ---

// Quem edita config e dispara sync (manual, v1 e v2) — nunca muda com o
// papel de leitura, só Tech Lead/Scrum Master do PRÓPRIO squad (ver
// firestore.rules isSquadLeadership).
export const SQUAD_ADMIN_ROLES: GlobalRole[] = [
  'Tech Lead', 'Scrum Master', 'Agile Master', 'Product Owner', 'People Lead', 'Tribe Lead', 'Agile Coach', 'admin'
];

// v2: quem pode ver dado nominal — backlog por responsável, ranking,
// capacidade/alocação por pessoa. Mais amplo que SQUAD_ADMIN_ROLES (PO e
// liderança leem, mas não editam config nem disparam sync). Dev/QA nunca
// entram aqui — o objetivo explícito é não virar leaderboard visível ao time.
export const SQUAD_LEADERSHIP_VIEW_ROLES: GlobalRole[] = [
  'Product Owner', 'Tech Lead', 'Scrum Master', 'People Lead', 'Agile Master', 'Tribe Lead', 'Agile Coach', 'admin'
];

// Gestão de pessoas (roster + capacidade individual) — People Lead é quem
// pediu essa responsabilidade explicitamente, TL/SM entram também porque já
// tocam config/sync do squad e não faz sentido travar capacidade sem eles.
export const SQUAD_PEOPLE_ADMIN_ROLES: GlobalRole[] = ['Tech Lead', 'Scrum Master', 'People Lead', 'Agile Master', 'Product Owner', 'Tribe Lead', 'admin'];

export type SquadConfig = {
  squadId: string; // mesmo valor de userProfile.squadId (ex: 'MISSI', 'Varejo')
  jiraProjectKey: string;
  syncJql: string; // ex: 'project = MISSI AND sprint in openSprints()'
  // Só usado pelo sync AGENDADO (functions/src/squadSync.ts), que não tem um
  // usuário logado de quem puxar users/{uid}/config/jira. O sync manual
  // continua preferindo o domínio pessoal de quem clica em "Sincronizar" —
  // este campo é opcional e só vira obrigatório se o squad ligar o agendado.
  jiraDomain?: string;
  // v2, opt-in explícito por squad — nasce desligado. Só quando true o sync
  // busca worklog (hora por pessoa) e calcula ranking/capacidade. Ver plano
  // de riscos: ranking nunca é leaderboard público, é sinal pra liderança.
  rankingEnabled?: boolean;
  // Capacidade assumida por pessoa/dia usada no cálculo de alocação (v2) —
  // squad inteiro, não por indivíduo: users/{uid} só é legível pelo próprio
  // dono (ver firestore.rules), então o sync não consegue ler o dailyHours
  // pessoal de cada membro pra comparar contra a hora lançada dele.
  defaultDailyCapacityHours?: number;
  capacityCalculationMethod?: 'STANDARD' | 'JIRA_WORKLOG_AVERAGE' | 'CUSTOM_FORMULA' | string;
  capacityJql?: string;
  capacityFormula?: string;
  // Customfield do campo "Sprint" (Greenhopper/Jira Software) — ao contrário
  // dos campos de tempo (nativos, universais), o ID do campo Sprint varia por
  // instância Jira (ex: customfield_10005 no DDWMISSI). Sem isso configurado,
  // capacidade usa o fallback fixo de SPRINT_WORKDAYS_ASSUMED; com isso, usa
  // os dias úteis reais entre início/fim da sprint ativa.
  sprintFieldId?: string;
  lastSyncAt?: string;
  lastSyncBy?: string; // uid de quem disparou
  lastSyncStatus?: 'success' | 'error';
  lastSyncError?: string;
  lastSyncIssueCount?: number;
  updatedAt: string;

  // --- Sync incremental + cache por sprint (v3) ---
  // Sprint que o sync mais recente identificou como "a atual" — chave de
  // partição usada pra decidir full-vs-delta e pra saber que subconjunto de
  // issuesSnapshot/metricsRollup representa "agora". 'UNMAPPED' quando o
  // squad não tem sprintFieldId configurado (aí tudo cai num balde só, igual
  // ao comportamento de antes desta versão).
  activeSprintId?: string;
  // Só uma sync FULL grava isto — sync delta nunca toca. Decide quando forçar
  // uma reconciliação completa mesmo sem detectar troca de sprint (pega
  // issues que saíram de escopo silenciosamente, que um "updated >= X" não
  // consegue enxergar).
  lastFullReconcileAt?: string;
  reconcileIntervalHours?: number; // default 6 se ausente
  // Timestamp de quando rankingEnabled virou true (só na transição
  // false->true) — força uma sync FULL seguinte pra popular
  // issueWorklogCache da partição inteira, não só do que mudar dali em diante.
  rankingEnabledAt?: string;
  schemaVersion?: number; // 2 = já rodou sync com tag de sprint pelo menos uma vez
  // Denormalizado pra alimentar o seletor de sprint sem query extra —
  // upsertado a cada sync FULL.
  sprintHistory?: SquadSprintHistoryEntry[];
};

export type SquadSprintHistoryEntry = {
  sprintId: string; // id numérico da sprint no Jira (string), ou 'UNMAPPED'
  sprintName: string;
  sprintStart: string;
  sprintEnd: string;
  sprintWorkdays: number;
  state: 'active' | 'closed';
  lastSyncedAt: string; // última vez que essa partição foi sincronizada (full ou delta)
  closedAt?: string; // setado quando a troca pra outra sprint foi detectada
};

// Espelho leve de uma issue do Jira dentro do squad. `assigneeId`/`assigneeName`
// só existem a partir do v2 — por isso a leitura desta collection é restrita a
// SQUAD_LEADERSHIP_VIEW_ROLES nas rules (Firestore não redige campo por regra;
// dado nominal só pode ficar numa collection que já nasce leadership-only).
//
// Sem story points — o squad não usa (confirmado ao vivo: campo sempre 0).
// Rastreiam tempo estimado/restante/logado, granular por issue FILHA
// (história é só o pai; codificação/code review/teste é que carregam hora).
export type SquadIssueSnapshot = {
  key: string;
  title?: string;
  type: string;
  isBug: boolean;
  status: string;
  statusCategory: 'new' | 'indeterminate' | 'done' | 'unknown';
  estimateSec: number; // timeoriginalestimate — estimativa original
  remainingSec: number; // timeestimate — tempo restante
  loggedSec: number; // timespent — tempo já lançado
  updatedAtJira: string; // campo `updated` do Jira, usado pra calcular staleSinceDays
  staleSinceDays: number;
  dueDate: string; // campo `duedate` do Jira (YYYY-MM-DD), ou '' se não tem prazo
  targetStart?: string; // data de início estimada/target (YYYY-MM-DD)
  targetEnd?: string;   // data de término estimada/target (YYYY-MM-DD)
  assigneeId: string; // accountId/key do Jira, ou '' se não atribuída
  assigneeName: string;
  parentKey: string; // campo nativo `parent` do Jira — issue pai (história), ou '' se não tem
  parentTitle: string;
  // Sprint que essa issue pertence no momento da sync — mesma chave de
  // squads/{squadId}.activeSprintId. Subtarefa sem sprint própria herda do
  // pai (parentKey) via fallback no sync. 'UNMAPPED' quando o squad não tem
  // sprintFieldId configurado.
  sprintId: string;
  sprintName: string;
  syncedAt: string;
};

// Quebra de horas lançadas POR AUTOR de uma issue — existe só quando
// rankingEnabled. Vive numa collection separada de issuesSnapshot de
// propósito: sync incremental (delta) só re-busca issues que MUDARAM, então
// pra recalcular ranking sem perder a hora de quem não mudou, precisa de um
// cache persistente do worklog por autor. Também resolve um vazamento de
// privacidade — se isto vivesse em issuesSnapshot, a exceção de self-claim
// (isMyClaimedAssignee) deixaria um Dev/QA que reivindicou a issue ver quem
// mais logou hora nela; aqui não tem essa exceção, é sempre leadership-only.
export type SquadIssueWorklogCache = {
  key: string;
  sprintId: string;
  worklogByAuthor: Record<string, number>; // assigneeId -> horas
  worklogAuthorNames: Record<string, string>; // assigneeId -> displayName
  updatedAtJira: string;
  syncedAt: string;
};

// Rollup agregado — sem nome/hora por pessoa, visível a QUALQUER membro do
// squad (mesma regra desde o v1). Nunca adicionar campo nominal aqui; dado
// nominal vai em SquadMemberMetric, que tem regra de leitura mais restrita.
export type SquadMetricsRollup = {
  computedAt: string;
  sourceIssueCount: number;
  totalIssues: number;
  doneIssues: number;
  estimatedHours: number; // soma de estimateSec do escopo, em horas
  loggedHours: number; // soma de loggedSec do escopo, em horas
  remainingHours: number; // soma de remainingSec do escopo, em horas
  bugCount: number;
  bugRatio: number; // bugCount / totalIssues
  staleCount: number; // statusCategory != done && staleSinceDays > staleThresholdDays
  staleThresholdDays: number;
  // Prazos — dueDate setado e no passado / perto de vencer, só entre issues
  // não concluídas. "Itens parados" (acima) é sobre falta de movimento;
  // isto é sobre vencimento, são coisas diferentes.
  overdueCount: number;
  dueSoonCount: number;
  dueSoonThresholdDays: number;
  byType: Record<string, number>;
  // Quadro da sprint sem nome — contagem por status (tipo CFD simplificado).
  // Único jeito de dar a Dev/QA uma visão de "onde as issues estão" sem
  // reusar issuesSnapshot (que carrega assigneeName e é leadership-only nas
  // rules — Firestore não redige campo por regra, então não dá pra expor só
  // parte do doc pra quem não é liderança).
  byStatus: Record<string, number>;
  // Só populado quando SquadConfig.sprintFieldId está configurado — extraído
  // da sprint ACTIVE encontrada nas issues sincronizadas.
  activeSprintName?: string;
  activeSprintStart?: string;
  activeSprintEnd?: string;
  sprintWorkdays?: number; // dias úteis reais entre start/end — usado na capacidade em vez do fallback fixo
  // Doc id desta collection deixou de ser sempre 'current' — agora também
  // grava um doc por sprintId (squads/{squadId}/metricsRollup/{sprintId}),
  // que é o que o seletor de sprint lê. 'current' continua sendo escrito
  // como espelho do que está ativo agora, sem mudança pros leitores antigos.
  sprintId?: string;
  state?: 'active' | 'closed'; // marcador AUTORITATIVO — nunca inferido de campo por-issue
  closedAt?: string;
};

// Um doc por dia (id = 'YYYY-MM-DD'), gravado/atualizado a cada sync daquele
// dia — várias syncs no mesmo dia atualizam o MESMO doc (merge), não criam
// duplicata. `loggedHours`/`doneIssues` aqui são CUMULATIVOS (mesma
// semântica do rollup principal, é a mesma soma no momento da sync) — pra
// ver "produtividade DAQUELE dia" a tela calcula o delta entre um dia e o
// anterior (hoje.loggedHours - ontem.loggedHours), não lê o valor direto.
export type SquadDailySnapshot = {
  date: string; // YYYY-MM-DD
  totalIssues: number;
  doneIssues: number;
  loggedHours: number;
  estimatedHours: number;
  remainingHours: number;
  bugCount: number;
  staleCount: number;
  computedAt: string;
};

// v2 — agregado POR PESSOA. Só existe/é populado quando SquadConfig.rankingEnabled
// é true; leitura restrita a SQUAD_LEADERSHIP_VIEW_ROLES. `hoursLogged` vem do
// autor de cada worklog (não do assignee da issue — pode ser gente diferente).
export type SquadMemberMetric = {
  assigneeId: string;
  assigneeName: string;
  issuesInProgress: number;
  issuesCompleted: number; // contagem, não pontos — squad não usa story points
  hoursLogged: number;
  capacityHours: number; // defaultDailyCapacityHours × dias úteis do período sincronizado
  utilizationPct: number; // hoursLogged / capacityHours, 0 se capacidade == 0
  computedAt: string;
};

// Roster do squad — id do doc é o jiraAccountId (accountId/key do Jira, o
// mesmo valor de SquadIssueSnapshot.assigneeId). Auto-semeado no sync (toda
// pessoa vista como assignee ganha uma linha com a capacidade padrão do
// squad); SQUAD_PEOPLE_ADMIN_ROLES ajusta capacidade individual depois —
// resolve "cada pessoa tem uma quantidade de horas diferente".
// `claimedByUid`: auto-claim — o próprio usuário reivindica qual linha do
// roster é ele (só pode setar pro PRÓPRIO uid, e só se ainda não tiver
// dono — ver firestore.rules), isso é o que permite a view "minhas issues"
// (issuesSnapshot lido via isMyClaimedAssignee) sem precisar de mais nenhum
// dado além do que o sync já traz.
export type SquadMember = {
  jiraAccountId: string;
  displayName: string;
  capacityHoursPerDay: number;
  claimedByUid?: string;
  updatedAt: string;
};

// --- Painéis customizados (v3) ---
// "Cada user tem sua necessidade" — qualquer membro do squad monta o próprio
// painel com JQL livre, roda com o PRÓPRIO PAT pessoal (mesma infra segura
// já usada no sync principal e no import pessoal — sem credencial nova, sem
// superfície nova). Resultado é CACHEADO no doc (resultRows/resultTotal) —
// só recalcula quando o dono clica em "Atualizar", nunca ao vivo a cada
// render (senão qualquer um com vários painéis estoura o rate limit do Jira).
export type SquadPanelChartType = 'number' | 'table' | 'bar' | 'pie';
// 'parent' agrupa issues FILHAS pela história-pai (campo nativo `parent` do
// Jira) — não precisa de plugin/issueFunction, só pedir o campo certo.
export type SquadPanelGroupBy = 'status' | 'type' | 'priority' | 'assignee' | 'parent' | 'none';
// O que cada barra/fatia soma dentro do grupo — 'count' é quantidade de
// issues (comportamento original); os outros somam a hora (em horas
// decimais) das issues daquele grupo. Ex: agrupar por 'parent' com
// 'remainingHours' = "quantas horas restam nas filhas de cada história".
export type SquadPanelAggregateMetric = 'count' | 'estimateHours' | 'remainingHours' | 'loggedHours';

export type SquadPanelResultRow = { label: string; value: number };
export type SquadPanelIssueRow = { key: string; title: string; status: string; type: string; parentKey?: string; parentTitle?: string };

export type SquadPanel = {
  id: string;
  squadId: string;
  ownerId: string;
  ownerName: string;
  title: string;
  jql: string;
  chartType: SquadPanelChartType;
  groupBy: SquadPanelGroupBy; // usado só quando chartType é 'bar'/'pie'
  aggregateMetric: SquadPanelAggregateMetric; // idem — o que cada barra soma
  // 'private': só o dono lê (mesmo sendo membro do squad). 'squad': qualquer
  // membro lê o resultado cacheado, mas só o dono roda "Atualizar" — outro
  // membro nunca precisa/consegue rodar a JQL de outra pessoa com o PAT dele.
  visibility: 'private' | 'squad';
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  lastRunError?: string;
  resultTotal?: number;
  resultRows?: SquadPanelResultRow[];
  resultIssues?: SquadPanelIssueRow[]; // só pra chartType 'table', capado (ver PANEL_TABLE_LIMIT no service)
};

export interface SquadMember {
  dbId: string;
  squadId: string;
  jiraAccountId: string;
  displayName: string;
  email?: string;
  role?: string;
  capacityHoursPerDay?: number;
  systemCalculatedCapacityHoursPerDay?: number;
  calibrationNotes?: string;
  overrideType?: 'SYSTEM' | 'MANUAL_OVERRIDE' | 'IMPORTED_EXCEL' | string;
  claimedByUid?: string;
  updatedAt?: string;
}

export interface JiraPlansItem {
  id: string;
  jiraKey: string;
  title: string;
  status: string;
  type?: string;
  assigneeName?: string;
  assigneeAvatar?: string;
  targetStart?: string;
  targetEnd?: string;
  parentKey?: string;
  parentTitle?: string;
}
