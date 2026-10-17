import { describe, it, expect } from 'vitest';
import {
  RELEASE_ICONS,
  SQUAD_ROLES,
  barPercent,
  canonicalIconName,
  computeGrowth,
  computeNextTag,
  computeSayDo,
  filterReleases,
  formatDecimal,
  formatDuration,
  formatInt,
  getTodayFormatted,
  isEmptySprint,
  jiraErrorInfo,
  parseBulkChanges,
  releaseStats,
  sprintNumbers,
} from '../admin-platform-utils';

describe('Versões: tag SemVer', () => {
  it('soma sobre a tag mais recente', () => {
    expect(computeNextTag('v3.119.0', 'patch')).toBe('v3.119.1');
    expect(computeNextTag('v3.119.4', 'minor')).toBe('v3.120.0');
    expect(computeNextTag('v3.119.4', 'major')).toBe('v4.0.0');
  });
  it('aceita tag sem v e incompleta', () => {
    expect(computeNextTag('3.1', 'patch')).toBe('v3.1.1');
  });
  it('sem versão anterior começa do zero (sem tag fixa inventada)', () => {
    expect(computeNextTag(undefined, 'patch')).toBe('v0.0.1');
    expect(computeNextTag(undefined, 'minor')).toBe('v0.1.0');
    expect(computeNextTag(undefined, 'major')).toBe('v1.0.0');
  });
  it('data de hoje em texto livre', () => {
    expect(getTodayFormatted(new Date(2026, 9, 16))).toBe('16 de Outubro, 2026');
  });
});

describe('Versões: lista de alterações em lote', () => {
  it('separa por linha e por ponto e vírgula e tira marcadores', () => {
    expect(parseBulkChanges('- Gerar link;\n* Revogar convite\n• Convites pendentes;;  \n\nSem marcador')).toEqual([
      'Gerar link',
      'Revogar convite',
      'Convites pendentes',
      'Sem marcador',
    ]);
    expect(parseBulkChanges('   ')).toEqual([]);
  });
});

describe('Versões: ícones e filtros', () => {
  it('as chaves gravadas no dado não mudam e os nomes são em português', () => {
    expect(RELEASE_ICONS.map((i) => i.name)).toEqual(['Zap', 'Sparkles', 'Flag', 'ShieldCheck', 'Layers', 'Code2', 'Database', 'Cpu', 'Globe', 'ListChecks']);
    expect(RELEASE_ICONS.map((i) => i.label)).toContain('Raio');
    expect(RELEASE_ICONS.map((i) => i.label).join(' ')).not.toMatch(/Zap|Sparkles|Rocket|Cpu|Code2/);
  });
  it('dado antigo com "Rocket" é tratado como bandeira', () => {
    expect(canonicalIconName('Rocket')).toBe('Flag');
    expect(canonicalIconName('Cpu')).toBe('Cpu');
    expect(canonicalIconName(undefined)).toBe('Sparkles');
  });
  const releases = [
    { tag: 'v3.119.0', title: 'feat(painel)', description: 'Próxima cerimônia', type: 'minor', changes: ['Aviso de agenda'], isPublished: true },
    { tag: 'v3.118.1', title: 'fix(poker)', description: '', type: 'patch', changes: [], isPublished: true },
    { tag: 'v3.118.0', title: 'feat(squad)', description: '', type: 'minor', changes: ['Convites'], isPublished: false },
    { tag: 'v3.0.0', title: 'Nova base', description: '', type: 'major', changes: ['PostgreSQL'], isPublished: true },
  ];
  it('busca em tag, título, descrição e alterações; filtra por tipo e rascunho', () => {
    const ids = (s: string, t = 'all') => filterReleases(releases, s, t).map((r) => r.tag);
    expect(ids('v3.118')).toEqual(['v3.118.1', 'v3.118.0']);
    expect(ids('agenda')).toEqual(['v3.119.0']);
    expect(ids('postgresql')).toEqual(['v3.0.0']);
    expect(ids('', 'patch')).toEqual(['v3.118.1']);
    expect(ids('', 'minor')).toEqual(['v3.119.0', 'v3.118.0']);
    expect(ids('', 'draft')).toEqual(['v3.118.0']);
    expect(ids('v9.9')).toEqual([]);
  });
  it('sem versões o card "mais recente" fica sem tag (a tela mostra traço)', () => {
    expect(releaseStats([])).toEqual({ latestTag: null, total: 0, majors: 0, patches: 0 });
    expect(releaseStats(releases)).toEqual({ latestTag: 'v3.119.0', total: 4, majors: 1, patches: 1 });
  });
});

describe('Sincronização Jira: erro por causa, só pelo status', () => {
  it('401, 403, 404 e 5xx dizem a causa e o que fazer', () => {
    expect(jiraErrorInfo(401).title).toBe('O Jira recusou o token (erro 401)');
    expect(jiraErrorInfo(401).hint).toBe('Gere um novo token pessoal no Jira e cole de novo.');
    expect(jiraErrorInfo(403, null, 'DDWMISSI').hint).toContain('DDWMISSI');
    expect(jiraErrorInfo(404).title).toContain('erro 404');
    expect(jiraErrorInfo(404).hint).toContain('domínio');
    expect(jiraErrorInfo(502).title).toBe('O Jira não respondeu (erro 502)');
  });
  it('sem status (rede) não finge que veio do Jira', () => {
    expect(jiraErrorInfo(null).title).toBe('Não foi possível falar com o servidor');
  });
  it('mensagem útil do servidor entra como detalhe; as genéricas não', () => {
    expect(jiraErrorInfo(400, 'Projeto XPTO não encontrado').detail).toBe('Projeto XPTO não encontrado');
    expect(jiraErrorInfo(401, 'Unauthorized').detail).toBeUndefined();
    expect(jiraErrorInfo(401, '  ').detail).toBeUndefined();
  });
  it('a lista de cargos tem os 11 de sempre', () => {
    expect(SQUAD_ROLES).toHaveLength(11);
  });
});

describe('Crescimento: métricas e rótulos honestos', () => {
  const stats = {
    totalUsers: 164,
    totalShowcaseSessions: 21,
    totalFeedbacks: 48,
    totalPokerRooms: 168,
    totalRetroBoards: 96,
    totalSprintPlannings: 74,
    totalHealthCheckBoards: 36,
    totalBrainstormingBoards: 38,
    totalSessions: 433,
    totalParticipations: 1980,
    avgSessionDurationMinutes: 48,
    sessionDurationSampleSize: 31,
  };
  it('interações somam os seis módulos (Showcase entra) e o ranking vem do maior ao menor', () => {
    const g = computeGrowth(stats);
    expect(g.interactions).toBe(168 + 96 + 74 + 38 + 36 + 21);
    expect(g.modules.map((m) => m.label)).toEqual(['Scrum Poker', 'Retrospectivas', 'Sprint Planner', 'Brainstorming', 'Health Check', 'Showcase']);
    expect(g.modules.at(-1)?.module).toBe('showcase');
  });
  it('taxa de feedback = feedbacks ÷ usuários; média = interações ÷ usuários', () => {
    const g = computeGrowth(stats);
    expect(g.feedbackRate).toBeCloseTo((48 / 164) * 100, 5);
    expect(formatDecimal(g.feedbackRate)).toBe('29,3');
    expect(formatDecimal(g.perUser)).toBe('2,6');
  });
  it('tudo zerado não vira NaN', () => {
    const g = computeGrowth({ ...stats, totalUsers: 0, totalShowcaseSessions: 0, totalFeedbacks: 0, totalPokerRooms: 0, totalRetroBoards: 0, totalSprintPlannings: 0, totalHealthCheckBoards: 0, totalBrainstormingBoards: 0, totalSessions: 0, totalParticipations: 0, avgSessionDurationMinutes: null, sessionDurationSampleSize: 0 });
    expect(g.noActivity).toBe(true);
    expect(g.feedbackRate).toBe(0);
    expect(g.perUser).toBe(0);
    expect(g.avgDurationMinutes).toBeNull();
    expect(barPercent(0, 0)).toBe(0);
    expect(Number.isNaN(barPercent(0, 0))).toBe(false);
  });
  it('showcase ausente na resposta conta como zero', () => {
    const { totalShowcaseSessions: _omit, ...rest } = stats;
    expect(computeGrowth(rest).modules.find((m) => m.key === 'showcase')?.count).toBe(0);
  });
  it('sem amostra de duração, o tempo médio fica em "em breve"', () => {
    expect(computeGrowth({ ...stats, sessionDurationSampleSize: 0 }).avgDurationMinutes).toBeNull();
    expect(computeGrowth({ ...stats, avgSessionDurationMinutes: null }).avgDurationMinutes).toBeNull();
    expect(computeGrowth(stats).avgDurationMinutes).toBe(48);
  });
  it('barras: proporcionais ao maior, mínimo de 3% quando há valor', () => {
    expect(barPercent(168, 168)).toBe(100);
    expect(barPercent(84, 168)).toBe(50);
    expect(barPercent(1, 1000)).toBe(3);
    expect(barPercent(0, 168)).toBe(0);
  });
  it('formata em pt-BR', () => {
    expect(formatInt(1980)).toBe('1.980');
    expect(formatDuration(48)).toBe('48 min');
    expect(formatDuration(125)).toBe('2h5');
    expect(formatDuration(120)).toBe('2h');
  });
});

describe('Cerimônias: Say/Do e sprint sem dado', () => {
  it('Say/Do = entregue ÷ comprometido, em %', () => {
    expect(computeSayDo(38, 46)).toBe(83);
    expect(computeSayDo(46, 46)).toBe(100);
    expect(computeSayDo(50, 40)).toBe(125);
  });
  it('sem comprometido não há Say/Do', () => {
    expect(computeSayDo(0, 0)).toBeNull();
    expect(computeSayDo(5, 0)).toBeNull();
  });
  it('lê os números do backend (velocityReal ou entregue)', () => {
    expect(sprintNumbers({ velocityReal: 38, previsto: 46, carryOvers: 2 })).toEqual({ delivered: 38, committed: 46, carryOvers: 2, sayDo: 83 });
    expect(sprintNumbers({ entregue: 10, previsto: 20 }).delivered).toBe(10);
    expect(sprintNumbers({}).sayDo).toBeNull();
  });
  it('sprint toda zerada ou ausente é "sem dado"', () => {
    expect(isEmptySprint(null)).toBe(true);
    expect(isEmptySprint({ velocityReal: 0, previsto: 0, entregue: 0, carryOvers: 0 })).toBe(true);
    expect(isEmptySprint({ velocityReal: 0, previsto: 12, carryOvers: 0 })).toBe(false);
    expect(isEmptySprint({ carryOvers: 1 })).toBe(false);
  });
});
