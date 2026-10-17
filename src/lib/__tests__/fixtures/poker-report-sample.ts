import type { Issue, Participant, Vote, VotingRound } from '../../types';
import type { ReportInput } from '../../poker-report';

/**
 * Sessões de exemplo para testar o relatório e o gerador de PDF.
 * `bigSession`: 12 tarefas, 4 papéis (DEV, QA, UX, Designer), com adiada, cancelada,
 * pulada, não abordada, divergente e revotada. `smallSession`: 3 tarefas, 2 papéis.
 */

const P = (id: string, nickname: string, role: Participant['role'], globalRole: string, extra: Partial<Participant> = {}): Participant =>
  ({ id, nickname, roomId: 'r', isFacilitator: false, role, globalRole, ...extra } as Participant);

const V = (participantId: string, value: string, at: string): Vote =>
  ({ id: `${participantId}-${at}`, participantId, roomId: 'r', value, timestamp: at } as Vote);

const R = (issueId: string, at: string, votes: Array<[string, string]>): VotingRound =>
  ({
    id: `${issueId}-${at}`, roomId: 'r', topic: issueId, issueId, deckType: 'hours', timestamp: at,
    votes: votes.map(([p, v]) => V(p, v, at)), stats: { avg: '0', min: '0', max: '0', consensus: false },
  } as VotingRound);

const I = (n: number, extra: Partial<Issue>): Issue =>
  ({ id: `i${n}`, key: `PTV-${1200 + n}`, title: `Tarefa ${n}`, status: 'pending', estimatedPoints: null, ...extra } as Issue);

const people: Participant[] = [
  P('d1', 'Ana Souza', 'dev', 'Developer'),
  P('d2', 'Bruno Lima', 'dev', 'Developer'),
  P('d3', 'Carla Dias', 'dev', 'Developer'),
  P('q1', 'Diego Rocha', 'qa', 'QA'),
  P('q2', 'Elisa Mota', 'qa', 'QA'),
  P('u1', 'Fábio Reis', 'dev', 'UX'),
  P('g1', 'Gisele Alves', 'dev', 'Designer'),
  P('sm', 'Gabriela Nunes', 'organizador', 'Scrum Master', { isFacilitator: true }),
  P('po', 'Henrique Prado', 'spectator', 'Stakeholder / Observador'),
];

const issues: Issue[] = [
  I(1, { key: 'PTV-1201', title: 'Login com SSO corporativo e renovação silenciosa de sessão', status: 'completed', estimatedPoints: '19', rolePoints: { Developer: '10', QA: '5', UX: '2', Designer: '2' }, decisionNote: 'Reaproveita o provedor de identidade já usado no Painel.', jiraLink: 'https://jira.exemplo.com/browse/PTV-1201' }),
  I(2, { key: 'PTV-1202', title: 'Cadastro de squads com importação de pessoas por planilha', status: 'completed', estimatedPoints: '26', rolePoints: { Developer: '16', QA: '6', UX: '4' }, devNotes: 'Validar CSV no servidor, não no navegador.', qaNotes: 'Cobrir arquivo com acentos e linhas duplicadas.' }),
  I(3, { key: 'PTV-1203', title: 'Relatório executivo em PDF A4', status: 'completed', estimatedPoints: '14', rolePoints: { Developer: '8', QA: '4', Designer: '2' } }),
  I(4, { key: 'PTV-1204', title: 'Notificações no sino da Home', status: 'completed', estimatedPoints: '9', rolePoints: { Developer: '6', QA: '3' } }),
  I(5, { key: 'PTV-1205', title: 'Fluxo de convite por e-mail com aceite e vínculo ao time', status: 'completed', estimatedPoints: '31', rolePoints: { Developer: '20', QA: '8', UX: '3' }, decisionNote: 'Dividir em duas entregas: convite e aceite.' }),
  I(6, { key: 'PTV-1206', title: 'Timer por tópico configurável', status: 'completed', skipped: true, note: 'Falta definição de UX para o comportamento em pausa.' }),
  I(7, { key: 'PTV-1207', title: 'Atalhos de teclado na mesa', status: 'pending', cancelled: true, note: 'Duplicada com PTV-1188.' }),
  I(8, { key: 'PTV-1208', title: 'Modo anônimo de votação', status: 'pending', parkCount: 2, parked: true, parkedNote: 'Aguardando posição do PO sobre privacidade.', jiraAssignee: 'Carlos Menezes' }),
  I(9, { key: 'PTV-1209', title: 'Régua de capacidade da sprint', status: 'completed', estimatedPoints: '6', rolePoints: { Developer: '4', QA: '2' }, parkCount: 1 }),
  I(10, { key: 'PTV-1210', title: 'Exportação para o TDN com formatação preservada', status: 'completed', estimatedPoints: '12', rolePoints: { Developer: '7', QA: '3', Designer: '2' } }),
  I(11, { key: 'PTV-1211', title: 'Painel de métricas do Jira por squad', status: 'pending' }),
  I(12, { key: 'PTV-1212', title: 'Revisão da acessibilidade das salas ao vivo', status: 'completed', estimatedPoints: '8', rolePoints: { Developer: '3', QA: '3', UX: '2' } }),
];

const rounds: VotingRound[] = [
  R('i1', '2026-10-14T13:40:00Z', [['d1', '10'], ['d2', '10'], ['d3', '10'], ['q1', '5'], ['q2', '5'], ['u1', '2'], ['g1', '2']]),
  R('i2', '2026-10-14T13:50:00Z', [['d1', '8'], ['d2', '24'], ['d3', '16'], ['q1', '6'], ['q2', '6'], ['u1', '4']]),
  R('i2', '2026-10-14T13:58:00Z', [['d1', '16'], ['d2', '16'], ['d3', '16'], ['q1', '6'], ['q2', '6'], ['u1', '4']]),
  R('i3', '2026-10-14T14:06:00Z', [['d1', '8'], ['d2', '8'], ['d3', '8'], ['q1', '4'], ['q2', '4'], ['g1', '2']]),
  R('i4', '2026-10-14T14:12:00Z', [['d1', '6'], ['d2', '6'], ['q1', '3'], ['q2', '3']]),
  R('i5', '2026-10-14T14:22:00Z', [['d1', '12'], ['d2', '28'], ['d3', '20'], ['q1', '8'], ['q2', '8'], ['u1', '3']]),
  R('i9', '2026-10-14T14:30:00Z', [['d1', '4'], ['d2', '4'], ['q1', '2'], ['q2', '2']]),
  R('i10', '2026-10-14T14:38:00Z', [['d1', '7'], ['d2', '7'], ['q1', '3'], ['g1', '2']]),
  R('i12', '2026-10-14T14:46:00Z', [['d1', '3'], ['d2', '3'], ['q1', '3'], ['u1', '2']]),
];

export function bigSession(): ReportInput {
  return {
    roomTitle: 'Refinamento Phoenix · Sprint 42',
    roomTeam: 'Squad Phoenix',
    deck: 'hours',
    issues,
    participants: people,
    rounds,
    sessionStartedAt: '2026-10-14T13:30:00Z',
    sessionEndedAt: '2026-10-14T15:12:00Z',
    perTopicTime: true,
    timeZone: 'America/Sao_Paulo',
  };
}

export function smallSession(): ReportInput {
  return {
    roomTitle: 'Refinamento rápido',
    roomTeam: 'Squad Atlas',
    deck: 'hours',
    issues: [
      I(1, { key: 'ATL-31', title: 'Ajuste do filtro de tarefas', status: 'completed', estimatedPoints: '5', rolePoints: { Developer: '3', QA: '2' } }),
      I(2, { key: 'ATL-32', title: 'Mensagem de erro na importação', status: 'completed', estimatedPoints: '4', rolePoints: { Developer: '3', QA: '1' } }),
      I(3, { key: 'ATL-33', title: 'Cache do painel', status: 'pending' }),
    ],
    participants: people.slice(0, 5).concat(people[7]),
    rounds: [
      R('i1', '2026-10-14T13:40:00Z', [['d1', '3'], ['d2', '3'], ['q1', '2']]),
      R('i2', '2026-10-14T13:46:00Z', [['d1', '3'], ['d2', '3'], ['q1', '1']]),
    ],
    sessionStartedAt: '2026-10-14T13:30:00Z',
    sessionEndedAt: '2026-10-14T13:58:00Z',
    perTopicTime: true,
    timeZone: 'America/Sao_Paulo',
  };
}
