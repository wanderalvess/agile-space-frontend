import { describe, expect, it } from 'vitest';
import type { BrainstormingGroup, BrainstormingIdea, TimerState } from '../../../lib/types';
import {
  BRAIN_STAGES,
  BRAIN_TIMER_PRESETS,
  GROUP_PALETTE,
  HOT_VOTES,
  INITIAL_CONNECTION,
  MATRIX_COLUMNS,
  NO_GROUP_COLOR,
  OFFLINE_AFTER_CLOSES,
  authorInfo,
  boardTotals,
  buildInviteText,
  canExportImage,
  connectionLabel,
  durationLabel,
  filterAndSortIdeas,
  firstName,
  groupColorOf,
  isHotIdea,
  isIdeaMasked,
  isStageNavLocked,
  isTimeUp,
  matrixColumnIdeas,
  nextConnection,
  nextGroupColor,
  normalizeStage,
  participantNames,
  pausedTimer,
  quadrantLabel,
  resetTimer,
  resumedTimer,
  runningTimer,
  stageLabel,
  stoppedTimer,
  totalsLine,
} from '../brainstorm-room-logic';

function idea(over: Partial<BrainstormingIdea> = {}): BrainstormingIdea {
  return {
    id: 'i1', boardId: 'b1', content: 'texto', authorId: 'u1', votes: [], position: { x: 0, y: 0 },
    parentId: null, groupId: null, createdAt: '2026-10-13T10:00:00Z', ...over,
  };
}

describe('etapas', () => {
  it('são as cinco etapas reais, na ordem (Teia incluída, sem "Votação")', () => {
    expect(BRAIN_STAGES.map((s) => s.label)).toEqual(['Mural', 'Teia', 'Grupos', 'Matriz', 'Plano']);
    expect(BRAIN_STAGES.map((s) => s.id)).toEqual(['ideation', 'diagram', 'grouping', 'prioritization', 'actions']);
  });

  it('nomeia a etapa e cai no Mural quando o valor é desconhecido', () => {
    expect(stageLabel('prioritization')).toBe('Matriz');
    expect(stageLabel('qualquer')).toBe('Mural');
    expect(normalizeStage('actions')).toBe('actions');
    expect(normalizeStage('xyz')).toBe('ideation');
    expect(normalizeStage(undefined)).toBe('ideation');
  });

  it('só o facilitador troca de etapa; os demais ficam com a navegação travada', () => {
    expect(isStageNavLocked(true)).toBe(false);
    expect(isStageNavLocked(false)).toBe(true);
  });

  it('só o Mural e a Teia geram imagem', () => {
    expect(canExportImage('ideation')).toBe(true);
    expect(canExportImage('diagram')).toBe(true);
    expect(canExportImage('grouping')).toBe(false);
    expect(canExportImage('prioritization')).toBe(false);
    expect(canExportImage('actions')).toBe(false);
  });
});

describe('quem vê o texto da ideia', () => {
  it('ideia redigida pelo servidor está sempre coberta', () => {
    expect(isIdeaMasked(idea({ hidden: true, authorId: null }), { revealed: true, isFacilitator: false })).toBe(true);
  });

  it('com as ideias reveladas (ou sem a configuração) ninguém é coberto', () => {
    expect(isIdeaMasked(idea(), { revealed: true, isFacilitator: false })).toBe(false);
    expect(isIdeaMasked(idea(), { revealed: undefined, isFacilitator: false })).toBe(false);
  });

  it('ocultas: cobre as dos outros logo que o facilitador oculta, mas não as próprias nem para o facilitador', () => {
    expect(isIdeaMasked(idea({ authorId: 'u2' }), { revealed: false, currentUserId: 'u1', isFacilitator: false })).toBe(true);
    expect(isIdeaMasked(idea({ authorId: 'u1' }), { revealed: false, currentUserId: 'u1', isFacilitator: false })).toBe(false);
    expect(isIdeaMasked(idea({ authorId: 'u2' }), { revealed: false, currentUserId: 'u1', isFacilitator: true })).toBe(false);
  });

  it('ideia sem autor conhecido (anônima) fica coberta para quem não é facilitador', () => {
    expect(isIdeaMasked(idea({ authorId: null }), { revealed: false, currentUserId: 'u1', isFacilitator: false })).toBe(true);
  });
});

describe('nome do autor no cartão', () => {
  const names = participantNames([
    { id: 'u1', nickname: 'Wanderson Silva' },
    { id: 'u2', nickname: 'Ana Ribeiro' },
    { id: 'u3', nickname: '' },
  ]);

  it('primeiro nome', () => {
    expect(firstName('Ana Ribeiro Lima')).toBe('Ana');
    expect(firstName('  Diego ')).toBe('Diego');
    expect(firstName('')).toBe('');
    expect(firstName(null)).toBe('');
  });

  it('as próprias ideias são "Você", mesmo com os autores anônimos', () => {
    expect(authorInfo(idea({ authorId: 'u1' }), { currentUserId: 'u1', anonymous: false, names })).toEqual({ kind: 'you', label: 'Você' });
    expect(authorInfo(idea({ authorId: 'u1' }), { currentUserId: 'u1', anonymous: true, names })).toEqual({ kind: 'you', label: 'Você' });
  });

  it('com autores abertos mostra o primeiro nome', () => {
    expect(authorInfo(idea({ authorId: 'u2' }), { currentUserId: 'u1', anonymous: false, names })).toEqual({ kind: 'person', label: 'Ana' });
  });

  it('anônimo só quando os autores estão ocultos', () => {
    expect(authorInfo(idea({ authorId: null }), { currentUserId: 'u1', anonymous: true, names })).toEqual({ kind: 'anonymous', label: 'Anônimo' });
  });

  it('"Participante" quando a pessoa já saiu da sala ou o nome não veio', () => {
    expect(authorInfo(idea({ authorId: 'u9' }), { currentUserId: 'u1', anonymous: false, names })).toEqual({ kind: 'unknown', label: 'Participante' });
    expect(authorInfo(idea({ authorId: 'u3' }), { currentUserId: 'u1', anonymous: false, names })).toEqual({ kind: 'unknown', label: 'Participante' });
    expect(authorInfo(idea({ authorId: null }), { currentUserId: 'u1', anonymous: false, names }).label).toBe('Participante');
  });
});

describe('Mural: busca, ordem e destaque', () => {
  const list = [
    idea({ id: 'a', content: 'Checklist de entrada', votes: ['x'], createdAt: '2026-10-13T10:00:00Z' }),
    idea({ id: 'b', content: 'Vídeo curto', votes: ['x', 'y', 'z'], createdAt: '2026-10-13T09:00:00Z' }),
    idea({ id: 'c', content: 'Convite por link', votes: ['x', 'y', 'z'], createdAt: '2026-10-13T11:00:00Z' }),
    idea({ id: 'd', content: 'checklist da squad', votes: [], createdAt: '2026-10-13T12:00:00Z' }),
  ];

  it('recentes: do mais novo para o mais antigo', () => {
    expect(filterAndSortIdeas(list, '', 'recent').map((i) => i.id)).toEqual(['d', 'c', 'a', 'b']);
  });

  it('populares: votos, e no empate o mais novo', () => {
    expect(filterAndSortIdeas(list, '', 'popular').map((i) => i.id)).toEqual(['c', 'b', 'a', 'd']);
  });

  it('busca sem diferenciar maiúsculas e minúsculas', () => {
    expect(filterAndSortIdeas(list, 'CHECKLIST', 'recent').map((i) => i.id)).toEqual(['d', 'a']);
    expect(filterAndSortIdeas(list, 'nada disso', 'recent')).toEqual([]);
  });

  it('não altera a lista recebida', () => {
    const copy = [...list];
    filterAndSortIdeas(list, '', 'popular');
    expect(list).toEqual(copy);
  });

  it('"Em alta" a partir de 3 votos e nunca em ideia coberta', () => {
    expect(HOT_VOTES).toBe(3);
    expect(isHotIdea(idea({ votes: ['a', 'b'] }))).toBe(false);
    expect(isHotIdea(idea({ votes: ['a', 'b', 'c'] }))).toBe(true);
    expect(isHotIdea(idea({ votes: ['a', 'b', 'c'], hidden: true }))).toBe(false);
  });

  it('totais para o resumo', () => {
    const groups: BrainstormingGroup[] = [{ id: 'g1', boardId: 'b1', title: 'A', order: 0 }];
    const totals = boardTotals(list, groups);
    expect(totals).toEqual({ ideas: 4, groups: 1, votes: 7 });
    expect(totalsLine(totals)).toBe('4 ideias · 1 grupo · 7 votos');
    expect(totalsLine({ ideas: 1, groups: 0, votes: 1 })).toBe('1 ideia · 0 grupos · 1 voto');
  });
});

describe('Matriz', () => {
  it('tem as cinco colunas, com os degraus de retorno e esforço de cada uma', () => {
    expect(MATRIX_COLUMNS.map((c) => c.id)).toEqual(['unclassified', 'quick_wins', 'strategic', 'secondary', 'discard']);
    const byId = Object.fromEntries(MATRIX_COLUMNS.map((c) => [c.id, c.qualifiers]));
    expect(byId.unclassified).toEqual({ roi: 50, effort: 50 });
    expect(byId.quick_wins).toEqual({ roi: 80, effort: 20 });
    expect(byId.strategic).toEqual({ roi: 80, effort: 80 });
    expect(byId.secondary).toEqual({ roi: 20, effort: 20 });
    expect(byId.discard).toEqual({ roi: 20, effort: 80 });
  });

  it('agrupa por quadrante e ordena por votos (empate mantém a ordem)', () => {
    const list = [
      idea({ id: 'a', votes: ['x'], qualifiers: { roi: 80, effort: 20 } }),
      idea({ id: 'b', votes: ['x', 'y'], qualifiers: { roi: 80, effort: 20 } }),
      idea({ id: 'c', votes: [] }),
      idea({ id: 'd', votes: [], qualifiers: { roi: 50, effort: 50 } }),
      idea({ id: 'e', votes: [], qualifiers: { roi: 20, effort: 80 } }),
    ];
    expect(matrixColumnIdeas(list, 'quick_wins').map((i) => i.id)).toEqual(['b', 'a']);
    expect(matrixColumnIdeas(list, 'unclassified').map((i) => i.id)).toEqual(['c', 'd']);
    expect(matrixColumnIdeas(list, 'discard').map((i) => i.id)).toEqual(['e']);
    expect(matrixColumnIdeas(list, 'strategic')).toEqual([]);
  });

  it('legenda em palavras no lugar de 80% e 20%', () => {
    expect(quadrantLabel({ roi: 80, effort: 20 })).toBe('Retorno alto · esforço baixo');
    expect(quadrantLabel({ roi: 20, effort: 80 })).toBe('Retorno baixo · esforço alto');
    expect(quadrantLabel(undefined)).toBe('a classificar');
    expect(quadrantLabel({ roi: 50, effort: 50 })).toBe('a classificar');
  });
});

describe('cor dos grupos', () => {
  it('o primeiro grupo recebe a primeira cor e as seguintes não repetem', () => {
    expect(nextGroupColor([])).toBe(GROUP_PALETTE[0]);
    expect(nextGroupColor([{ color: GROUP_PALETTE[0] }])).toBe(GROUP_PALETTE[1]);
    expect(nextGroupColor([{ color: GROUP_PALETTE[0].toUpperCase() }, { color: GROUP_PALETTE[1] }])).toBe(GROUP_PALETTE[2]);
  });

  it('acabando as cores volta ao início', () => {
    const all = GROUP_PALETTE.map((color) => ({ color }));
    expect(nextGroupColor(all)).toBe(GROUP_PALETTE[all.length % GROUP_PALETTE.length]);
  });

  it('usa a cor gravada; grupo antigo sem cor ganha uma da paleta, sempre a mesma; sem grupo é neutro', () => {
    expect(groupColorOf({ id: 'g1', color: '#ff0000' })).toBe('#ff0000');
    const legacy = groupColorOf({ id: 'g-antigo' });
    expect(GROUP_PALETTE).toContain(legacy);
    expect(groupColorOf({ id: 'g-antigo' })).toBe(legacy);
    expect(groupColorOf(null)).toBe(NO_GROUP_COLOR);
    expect(groupColorOf(undefined)).toBe(NO_GROUP_COLOR);
  });

  it('descarta uma cor que não parece cor (nada de CSS arbitrário no estilo)', () => {
    expect(GROUP_PALETTE).toContain(groupColorOf({ id: 'g1', color: 'red; background:url(x)' }));
  });
});

describe('cronômetro', () => {
  const t0 = 1_000_000;

  it('os botões incluem os 10, 15 e 20 minutos além dos cinco primeiros', () => {
    expect([...BRAIN_TIMER_PRESETS]).toEqual([60, 120, 180, 240, 300, 600, 900, 1200]);
    expect(BRAIN_TIMER_PRESETS).toContain(600);
  });

  it('rótulo da duração', () => {
    expect(durationLabel(60)).toBe('1 minuto');
    expect(durationLabel(600)).toBe('10 minutos');
  });

  it('iniciar, pausar guardando o que sobrou, retomar e reiniciar', () => {
    const running = runningTimer(300, t0);
    expect(running).toEqual({ status: 'running', endTime: t0 + 300_000, initialDuration: 300, remainingOnPause: 300 });

    const paused = pausedTimer(running, t0 + 100_000)!;
    expect(paused.status).toBe('paused');
    expect(paused.remainingOnPause).toBe(200);

    const resumed = resumedTimer(paused, t0 + 150_000)!;
    expect(resumed.status).toBe('running');
    expect(resumed.endTime).toBe(t0 + 150_000 + 200_000);

    expect(resetTimer(resumed)).toEqual(stoppedTimer(300));
  });

  it('pausar passado o fim não deixa tempo negativo; sem endTime não há o que pausar', () => {
    expect(pausedTimer(runningTimer(10, t0), t0 + 99_000)!.remainingOnPause).toBe(0);
    expect(pausedTimer(stoppedTimer(60), t0)).toBeNull();
    expect(pausedTimer(undefined, t0)).toBeNull();
    expect(resumedTimer(undefined, t0)).toBeNull();
    expect(resetTimer(undefined)).toBeNull();
  });

  it('o aviso de tempo esgotado vale só para o cronômetro que zerou', () => {
    const timer: TimerState = runningTimer(60, t0);
    expect(isTimeUp(timer, timer.endTime)).toBe(true);
    expect(isTimeUp(timer, null)).toBe(false);
    expect(isTimeUp(runningTimer(60, t0 + 5), timer.endTime)).toBe(false);
    expect(isTimeUp({ ...timer, status: 'paused' }, timer.endTime)).toBe(false);
    expect(isTimeUp(undefined, 1)).toBe(false);
  });
});

describe('estado da conexão', () => {
  it('começa conectando, abre ao vivo e zera as quedas', () => {
    expect(INITIAL_CONNECTION.status).toBe('connecting');
    expect(nextConnection(INITIAL_CONNECTION, 'open')).toEqual({ status: 'live', closes: 0 });
  });

  it('as primeiras quedas são "reconectando" e só depois de várias vira "sem conexão"', () => {
    let state = nextConnection(INITIAL_CONNECTION, 'open');
    for (let i = 1; i < OFFLINE_AFTER_CLOSES; i += 1) {
      state = nextConnection(state, 'close');
      expect(state.status).toBe('reconnecting');
    }
    state = nextConnection(state, 'close');
    expect(state.status).toBe('offline');
    expect(nextConnection(state, 'open')).toEqual({ status: 'live', closes: 0 });
  });

  it('textos', () => {
    expect(connectionLabel('live')).toBe('Ao vivo');
    expect(connectionLabel('reconnecting')).toBe('Reconectando…');
    expect(connectionLabel('offline')).toBe('Sem conexão');
    expect(connectionLabel('connecting')).toBe('Conectando…');
  });
});

describe('convite', () => {
  it('leva o nome da sessão, a squad e o link', () => {
    expect(buildInviteText({ title: 'Redesenho', squad: 'Phoenix', url: 'https://x/brainstorming/1' })).toBe(
      'Brainstorming "Redesenho" da squad Phoenix. Vamos lançar ideias, agrupar e priorizar juntos.\nLink: https://x/brainstorming/1'
    );
  });

  it('sem squad ou sem título', () => {
    expect(buildInviteText({ title: ' ', url: 'u' })).toBe('Brainstorming "Brainstorming". Vamos lançar ideias, agrupar e priorizar juntos.\nLink: u');
  });
});
