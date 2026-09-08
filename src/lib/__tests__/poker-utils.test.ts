import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ROOM_SETTINGS,
  computeTopicTiming,
  computeSessionBreakdown,
  resolveTshirtHours,
  mapJiraTypeToIssueType,
  getParticipantCategory,
  canParticipantVote,
  calculateRoleEfforts,
  checkConsensus,
  isParticipantOnline,
  formatBaselineDisplay,
  formatRoleForCopy,
} from '../poker-utils';
import { Issue, VotingRound, Vote, Participant } from '../types';

describe('poker-utils - Regras de Negócio e Cálculos do Planning Poker', () => {

  describe('Configurações padrão de sala (DEFAULT_ROOM_SETTINGS)', () => {
    it('deve ter métricas de tempo, distribuição e velocidade ligadas por padrão', () => {
      expect(DEFAULT_ROOM_SETTINGS.perTopicTime).toBe(true);
      expect(DEFAULT_ROOM_SETTINGS.showDistribution).toBe(true);
      expect(DEFAULT_ROOM_SETTINGS.showVelocity).toBe(true);
      expect(DEFAULT_ROOM_SETTINGS.decisionNotes).toBe(true);
    });
  });

  describe('Cálculo de Horas por Camisetas (resolveTshirtHours)', () => {
    const equivalents = {
      PP: { value: 2, unit: 'h' as const },
      P: { value: 4, unit: 'h' as const },
      M: { value: 8, unit: 'h' as const },
      G: { value: 2, unit: 'd' as const }, // 2 dias = 16h (8h/dia)
      GG: { value: 3, unit: 'd' as const }, // 3 dias = 24h
    };

    it('deve converter tamanhos com unidade em horas corretamente', () => {
      expect(resolveTshirtHours('PP', equivalents)).toBe(2);
      expect(resolveTshirtHours('P', equivalents)).toBe(4);
      expect(resolveTshirtHours('M', equivalents)).toBe(8);
    });

    it('deve converter tamanhos com unidade em dias multiplicando por 8 horas', () => {
      expect(resolveTshirtHours('G', equivalents)).toBe(16);
      expect(resolveTshirtHours('GG', equivalents)).toBe(24);
    });

    it('deve retornar NaN para valores sem equivalência ou votos especiais', () => {
      expect(Number.isNaN(resolveTshirtHours('?', equivalents))).toBe(true);
      expect(Number.isNaN(resolveTshirtHours('☕', equivalents))).toBe(true);
      expect(Number.isNaN(resolveTshirtHours('XG', equivalents))).toBe(true);
    });
  });

  describe('Mapeamento de tipos Jira para IssueType interno (mapJiraTypeToIssueType)', () => {
    it('deve mapear defeitos e bugs para qa', () => {
      expect(mapJiraTypeToIssueType('Bug')).toBe('qa');
      expect(mapJiraTypeToIssueType('Defect')).toBe('qa');
    });

    it('deve mapear UI/UX e Design para design', () => {
      expect(mapJiraTypeToIssueType('UX Design')).toBe('design');
      expect(mapJiraTypeToIssueType('Interface UI')).toBe('design');
    });

    it('deve mapear Histórias, Tarefas e Sub-tarefas para dev', () => {
      expect(mapJiraTypeToIssueType('Story')).toBe('dev');
      expect(mapJiraTypeToIssueType('História')).toBe('dev');
      expect(mapJiraTypeToIssueType('Task')).toBe('dev');
      expect(mapJiraTypeToIssueType('Sub-tarefa')).toBe('dev');
    });

    it('deve retornar other para tipos não mapeados ou vazios', () => {
      expect(mapJiraTypeToIssueType(undefined)).toBe('other');
      expect(mapJiraTypeToIssueType('Documentação')).toBe('other');
    });
  });

  describe('Categorização de Participantes (getParticipantCategory)', () => {
    it('deve retornar null para espectadores', () => {
      expect(getParticipantCategory({ role: 'spectator', globalRole: 'Developer' })).toBeNull();
    });

    it('deve reconhecer funções técnicas primárias via globalRole', () => {
      expect(getParticipantCategory({ role: 'dev', globalRole: 'Developer' })).toBe('Developer');
      expect(getParticipantCategory({ role: 'dev', globalRole: 'Desenvolvedor Backend' })).toBe('Developer');
      expect(getParticipantCategory({ role: 'qa', globalRole: 'QA' })).toBe('QA');
      expect(getParticipantCategory({ role: 'qa', globalRole: 'Analista de QA Sênior' })).toBe('QA');
      expect(getParticipantCategory({ role: 'dev', globalRole: 'UI-UX Specialist' })).toBe('UX');
    });

    it('deve reconhecer papéis de gestão e observação', () => {
      expect(getParticipantCategory({ role: 'organizador', globalRole: 'Scrum Master' })).toBe('Management');
      expect(getParticipantCategory({ role: 'organizador', globalRole: 'Product Owner' })).toBe('Management');
      expect(getParticipantCategory({ role: 'organizador', globalRole: 'Tech Lead' })).toBe('Management');
    });

    it('deve usar fallback do role da sala quando globalRole não estiver preenchido', () => {
      expect(getParticipantCategory({ role: 'dev' })).toBe('Developer');
      expect(getParticipantCategory({ role: 'qa' })).toBe('QA');
      expect(getParticipantCategory({ role: 'organizador' })).toBe('Management');
    });
  });

  describe('Permissão de Voto (canParticipantVote)', () => {
    it('espectador nunca pode votar', () => {
      expect(canParticipantVote({ role: 'spectator' })).toBe(false);
    });

    it('gestão só pode votar se o facilitador explicitamente permitir', () => {
      const pm = { role: 'organizador' as const, globalRole: 'Product Owner' as const };
      expect(canParticipantVote(pm, false)).toBe(false);
      expect(canParticipantVote(pm, true)).toBe(true);
    });

    it('desenvolvedores e QAs sempre podem votar', () => {
      expect(canParticipantVote({ role: 'dev' })).toBe(true);
      expect(canParticipantVote({ role: 'qa' })).toBe(true);
    });
  });

  describe('Detecção de Consenso (checkConsensus)', () => {
    it('deve retornar falso se houver menos de 2 votos', () => {
      expect(checkConsensus([])).toBe(false);
      expect(checkConsensus([{ participantId: '1', value: '5' } as Vote])).toBe(false);
    });

    it('deve retornar verdadeiro quando todos os votos forem idênticos', () => {
      const votes: Vote[] = [
        { participantId: '1', value: '5' } as Vote,
        { participantId: '2', value: '5' } as Vote,
        { participantId: '3', value: '5' } as Vote,
      ];
      expect(checkConsensus(votes)).toBe(true);
    });

    it('deve retornar falso quando houver divergência entre os votos', () => {
      const votes: Vote[] = [
        { participantId: '1', value: '5' } as Vote,
        { participantId: '2', value: '8' } as Vote,
      ];
      expect(checkConsensus(votes)).toBe(false);
    });
  });

  describe('Cálculo de Esforço por Papel (calculateRoleEfforts)', () => {
    const participants: Participant[] = [
      { id: 'dev1', nickname: 'Dev 1', role: 'dev', globalRole: 'Developer' } as Participant,
      { id: 'dev2', nickname: 'Dev 2', role: 'dev', globalRole: 'Developer' } as Participant,
      { id: 'qa1', nickname: 'QA 1', role: 'qa', globalRole: 'QA' } as Participant,
      { id: 'sm1', nickname: 'SM 1', role: 'organizador', globalRole: 'Scrum Master' } as Participant,
    ];

    it('deve calcular médias por categoria ignorando gestão', () => {
      const votes: Vote[] = [
        { participantId: 'dev1', value: '3' } as Vote,
        { participantId: 'dev2', value: '5' } as Vote, // Média dev = ceil(8/2) = 4
        { participantId: 'qa1', value: '2' } as Vote,   // Média QA = 2
        { participantId: 'sm1', value: '13' } as Vote,  // Gestão ignorada
      ];

      const result = calculateRoleEfforts(votes, participants, 'fibonacci');

      expect(result.devPoints).toBe('4');
      expect(result.qaPoints).toBe('2');
      expect(result.totalPoints).toBe('6'); // 4 + 2
    });
  });

  describe('Verificação de Presença Online (isParticipantOnline)', () => {
    const now = 1700000000000;

    it('deve considerar online se o heartbeat ocorreu a menos de 60 segundos', () => {
      const participant = { lastSeen: new Date(now - 30_000).toISOString() };
      expect(isParticipantOnline(participant, now)).toBe(true);
    });

    it('deve considerar offline se o heartbeat ocorreu a mais de 60 segundos', () => {
      const participant = { lastSeen: new Date(now - 65_000).toISOString() };
      expect(isParticipantOnline(participant, now)).toBe(false);
    });

    it('deve tolerar participante sem lastSeen tratando como online', () => {
      expect(isParticipantOnline({}, now)).toBe(true);
    });
  });

  describe('Consolidação da Sessão (computeSessionBreakdown)', () => {
    it('deve categorizar honestamente tarefas estimadas, puladas e intocadas', () => {
      const issues: Issue[] = [
        { id: 'i1', title: 'Item 1', status: 'completed' } as Issue,
        { id: 'i2', title: 'Item 2', status: 'completed' } as Issue,
        { id: 'i3', title: 'Item 3', status: 'pending', skipped: true } as Issue,
        { id: 'i4', title: 'Item 4', status: 'pending', parked: true } as Issue,
        { id: 'i5', title: 'Item 5', status: 'pending' } as Issue,
      ];

      const rounds: VotingRound[] = [
        { id: 'r1', issueId: 'i1', votes: [{ participantId: 'p1', value: '5' } as Vote] } as VotingRound,
        { id: 'r2', issueId: 'i2', votes: [{ participantId: 'p1', value: '3' } as Vote] } as VotingRound,
      ];

      const breakdown = computeSessionBreakdown(issues, rounds);

      expect(breakdown.total).toBe(5);
      expect(breakdown.estimated).toBe(2);
      expect(breakdown.discussed).toBe(2);
      expect(breakdown.skipped).toBe(1);
      expect(breakdown.parked).toBe(1);
      expect(breakdown.untouched).toBe(2);
    });
  });

  describe('Formatação de Exibição (formatBaselineDisplay / formatRoleForCopy)', () => {
    it('deve formatar baseline com sufixos corretos', () => {
      expect(formatBaselineDisplay('5', 'fibonacci')).toBe('5 SP');
      expect(formatBaselineDisplay('8', 'hours')).toBe('8h');
      expect(formatBaselineDisplay('M', 'tshirt')).toBe('M');
      expect(formatBaselineDisplay('', 'fibonacci')).toBe('—');
    });

    it('deve formatar papel técnico para rótulo curto', () => {
      expect(formatRoleForCopy('Developer')).toBe('DEV');
      expect(formatRoleForCopy('QA')).toBe('QA');
      expect(formatRoleForCopy('UX')).toBe('UX');
    });
  });
});
