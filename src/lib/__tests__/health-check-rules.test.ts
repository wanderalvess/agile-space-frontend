import { describe, expect, it } from 'vitest';
import {
  attentionLevel,
  climateBand,
  dimensionStat,
  focusSentence,
  formatScore,
  headline,
  normalizeScore,
  planItems,
  resultsFromVotes,
  scaleOptions,
  summarizeResults,
  toneGroups,
  groupLabels,
  worstVotesText,
} from '../health-check-rules';
import type { HealthCheckDimension } from '../types';

const dims = (...titles: string[]): HealthCheckDimension[] => titles.map((t, i) => ({ key: `d${i}`, title: t, description: '' }));

describe('nota de clima (0 a 10)', () => {
  it('a pior resposta vale 0 e a melhor 10 nas três escalas', () => {
    expect(normalizeScore(1, 'traffic_light')).toBe(0);
    expect(normalizeScore(3, 'traffic_light')).toBe(10);
    expect(normalizeScore(1, 'emojis')).toBe(0);
    expect(normalizeScore(3, 'emojis')).toBe(10);
    expect(normalizeScore(1, 'numbers_5')).toBe(0);
    expect(normalizeScore(5, 'numbers_5')).toBe(10);
  });

  it('é linear: média 2 no semáforo é 5 e média 3 na escala de 1 a 5 também', () => {
    expect(normalizeScore(2, 'traffic_light')).toBe(5);
    expect(normalizeScore(3, 'numbers_5')).toBe(5);
  });

  it('limita valores fora do intervalo', () => {
    expect(normalizeScore(0, 'traffic_light')).toBe(0);
    expect(normalizeScore(9, 'numbers_5')).toBe(10);
  });

  it('formata com vírgula e uma casa', () => {
    expect(formatScore(7.45)).toMatch(/^7,[45]$/);
    expect(formatScore(10)).toBe('10,0');
    expect(formatScore(null)).toBe('—');
  });
});

describe('situação da dimensão (regra única)', () => {
  it('crítico: 30% ou mais dos votos no pior valor, mesmo com nota alta', () => {
    expect(attentionLevel(7, 0.3)).toBe('critical');
    expect(attentionLevel(7, 0.29)).toBe('ok');
  });

  it('crítico: nota abaixo de 4', () => {
    expect(attentionLevel(3.9, 0)).toBe('critical');
    expect(attentionLevel(4, 0)).toBe('alert');
  });

  it('alerta: nota abaixo de 6; forte: 7,5 ou mais', () => {
    expect(attentionLevel(5.9, 0.1)).toBe('alert');
    expect(attentionLevel(6, 0.1)).toBe('ok');
    expect(attentionLevel(7.4, 0.1)).toBe('ok');
    expect(attentionLevel(7.5, 0.1)).toBe('strong');
    expect(attentionLevel(null, 0)).toBe('empty');
  });

  it('semáforo do exemplo do board: 6/3/1 é forte, 3/5/2 é alerta, 2/5/3 é crítico', () => {
    const d = { key: 'k', title: 'T' };
    expect(dimensionStat(d, { green: 6, yellow: 3, red: 1 }, 'traffic_light').level).toBe('strong');
    expect(dimensionStat(d, { green: 3, yellow: 5, red: 2 }, 'traffic_light').level).toBe('alert');
    expect(dimensionStat(d, { green: 2, yellow: 5, red: 3 }, 'traffic_light').level).toBe('critical');
  });

  it('nota por dimensão: 6/3/1 vale 7,5; 2/5/3 vale 4,5', () => {
    const d = { key: 'k', title: 'T' };
    expect(dimensionStat(d, { green: 6, yellow: 3, red: 1 }, 'traffic_light').score).toBeCloseTo(7.5, 5);
    expect(dimensionStat(d, { green: 2, yellow: 5, red: 3 }, 'traffic_light').score).toBeCloseTo(4.5, 5);
  });

  it('escala de 1 a 5: só o valor 1 conta como "pior" para a regra dos 30%', () => {
    const d = { key: 'k', title: 'T' };
    const s = dimensionStat(d, { '1': 1, '2': 4, '3': 5 }, 'numbers_5');
    expect(s.worstCount).toBe(1);
    expect(s.worstShare).toBeCloseTo(0.1, 5);
    const c = dimensionStat(d, { '1': 3, '5': 7 }, 'numbers_5');
    expect(c.level).toBe('critical');
  });

  it('escala emocional usa sad como pior valor', () => {
    const d = { key: 'k', title: 'T' };
    expect(dimensionStat(d, { happy: 5, neutral: 2, sad: 3 }, 'emojis').level).toBe('critical');
  });

  it('sem votos não é forte nem crítica', () => {
    const s = dimensionStat({ key: 'k', title: 'T' }, {}, 'traffic_light');
    expect(s.level).toBe('empty');
    expect(s.score).toBeNull();
    expect(s.total).toBe(0);
  });

  it('as contagens vêm de todos os valores da escala, inclusive os zerados', () => {
    const s = dimensionStat({ key: 'k', title: 'T' }, { green: 2 }, 'traffic_light');
    expect(s.counts.map((c) => [c.option.value, c.count])).toEqual([['green', 2], ['yellow', 0], ['red', 0]]);
    expect(scaleOptions('numbers_5').map((o) => o.value)).toEqual(['5', '4', '3', '2', '1']);
  });

  it('ignora contagens inválidas (negativas, texto) em vez de quebrar', () => {
    const s = dimensionStat({ key: 'k', title: 'T' }, { green: -3, yellow: Number.NaN, red: 2 } as Record<string, number>, 'traffic_light');
    expect(s.total).toBe(2);
  });
});

describe('resumo do radar', () => {
  const d = dims('Apoio', 'Equipe', 'Processos', 'Velocidade');
  const results = [
    { dimensionKey: 'd0', values: { green: 6, yellow: 3, red: 1 } },
    { dimensionKey: 'd1', values: { green: 8, yellow: 2 } },
    { dimensionKey: 'd2', values: { green: 2, yellow: 5, red: 3 } },
    { dimensionKey: 'd3', values: { green: 3, yellow: 5, red: 2 } },
  ];
  const sum = summarizeResults(d, results, 'traffic_light');

  it('nota de clima é a média das notas das dimensões', () => {
    // 7,5; 9,0; 4,5; 5,5
    expect(sum.climate).toBeCloseTo((7.5 + 9 + 4.5 + 5.5) / 4, 5);
    expect(sum.band).toBe('on_track');
  });

  it('lista fortes e em atenção com críticos primeiro, depois alertas', () => {
    expect(sum.strong.map((s) => s.title)).toEqual(['Equipe', 'Apoio']);
    expect(sum.attention.map((s) => [s.title, s.level])).toEqual([['Processos', 'critical'], ['Velocidade', 'alert']]);
    expect(sum.focus?.title).toBe('Processos');
  });

  it('conta votos e respostas por dimensão', () => {
    expect(sum.totalVotes).toBe(40);
    expect(sum.respondents).toEqual({ min: 10, max: 10 });
  });

  it('dimensão que falta no resumo do servidor entra vazia', () => {
    const s = summarizeResults(d, results.slice(0, 2), 'traffic_light');
    expect(s.stats[2].level).toBe('empty');
    expect(s.respondents).toEqual({ min: 0, max: 10 });
    expect(s.climate).toBeCloseTo((7.5 + 9) / 2, 5);
  });

  it('sem nenhum voto não há nota nem faixa', () => {
    const s = summarizeResults(d, [], 'traffic_light');
    expect(s.climate).toBeNull();
    expect(s.band).toBeNull();
    expect(headline(s)).toBe('Ainda não há respostas para calcular o clima.');
  });

  it('faixas da nota geral', () => {
    expect(climateBand(7.5)).toBe('strong');
    expect(climateBand(7.4)).toBe('on_track');
    expect(climateBand(5)).toBe('on_track');
    expect(climateBand(4.9)).toBe('attention');
  });

  it('a frase do topo cita a dimensão que mais pede atenção', () => {
    expect(headline(sum)).toBe('O clima está bom, e Processos é o ponto que mais pede atenção.');
  });

  it('a frase muda quando nada pede atenção e quando o clima está baixo', () => {
    const good = summarizeResults(dims('A'), [{ dimensionKey: 'd0', values: { green: 9, yellow: 1 } }], 'traffic_light');
    expect(headline(good)).toBe('O clima está forte e nenhuma dimensão pede atenção.');
    const low = summarizeResults(dims('A'), [{ dimensionKey: 'd0', values: { red: 6, yellow: 4 } }], 'traffic_light');
    expect(headline(low)).toBe('O clima pede atenção, começando por A.');
  });

  it('a sugestão de foco aponta a dimensão real', () => {
    expect(focusSentence(sum.focus)).toContain('Processos');
    expect(focusSentence(null)).toContain('Nenhuma dimensão pede atenção');
  });

  it('escala de 1 a 5 usa a mesma régua', () => {
    const s = summarizeResults(dims('A'), [{ dimensionKey: 'd0', values: { '4': 5, '5': 5 } }], 'numbers_5');
    expect(s.climate).toBeCloseTo(8.75, 5);
    expect(s.strong).toHaveLength(1);
  });
});

describe('contagens a partir dos votos', () => {
  it('conta por dimensão e valor', () => {
    const d = dims('A', 'B');
    const rows = resultsFromVotes(d, [
      { dimensionKey: 'd0', value: 'green' },
      { dimensionKey: 'd0', value: 'green' },
      { dimensionKey: 'd1', value: 'red' },
    ]);
    expect(rows).toEqual([
      { dimensionKey: 'd0', values: { green: 2 } },
      { dimensionKey: 'd1', values: { red: 1 } },
    ]);
  });
});

describe('texto de votos ruins', () => {
  it('concorda no singular e no plural', () => {
    expect(worstVotesText({ worstCount: 3, total: 10 })).toBe('3 de 10 votos ruins');
    expect(worstVotesText({ worstCount: 1, total: 10 })).toBe('1 de 10 voto ruim');
    expect(worstVotesText({ worstCount: 0, total: 0 })).toBe('sem votos');
  });
});

describe('itens do plano de ação', () => {
  const d = dims('Apoio', 'Equipe', 'Processos', 'Velocidade', 'Moral');
  const results = [
    { dimensionKey: 'd0', values: { green: 6, yellow: 3, red: 1 } },
    { dimensionKey: 'd1', values: { green: 8, yellow: 2 } },
    { dimensionKey: 'd2', values: { green: 2, yellow: 5, red: 3 } },
    { dimensionKey: 'd3', values: { green: 3, yellow: 5, red: 2 } },
    { dimensionKey: 'd4', values: { green: 6, yellow: 3, red: 1 } },
  ];
  const sum = summarizeResults(d, results, 'traffic_light');
  const items = planItems(sum, 'Radar Sprint 42');

  it('propõe as dimensões em atenção, críticas primeiro, e marca só os dois primeiros', () => {
    expect(items.slice(0, 2).map((i) => [i.title, i.level, i.suggested, i.priority])).toEqual([
      ['Processos', 'critical', true, 'critica'],
      ['Velocidade', 'alert', true, 'media'],
    ]);
  });

  it('as dimensões com algum voto ruim que não estão em atenção entram como opcionais', () => {
    const rest = items.slice(2);
    expect(rest.map((i) => i.title)).toEqual(['Apoio', 'Moral']);
    expect(rest.every((i) => !i.suggested)).toBe(true);
  });

  it('texto do item: o quê e por quê', () => {
    expect(items[0].what).toBe('Melhorar: Processos');
    expect(items[0].why).toBe('Radar Sprint 42: 3 de 10 votos ruins, nota 4,5.');
  });

  it('o plano usa a mesma regra da lista de atenção (nada some do plano nem aparece só nele)', () => {
    const attentionTitles = sum.attention.map((s) => s.title);
    const planAttention = items.filter((i) => i.level !== 'ok').map((i) => i.title);
    expect(planAttention).toEqual(attentionTitles);
  });
});

describe('barra de frequência por grupo', () => {
  it('semáforo e emocional: um valor por grupo, na ordem melhor, meio, pior', () => {
    const t = dimensionStat({ key: 'k', title: 'T' }, { green: 6, yellow: 3, red: 1 }, 'traffic_light');
    expect(toneGroups(t, 'traffic_light').map((g) => [g.label, g.count])).toEqual([['Ótimo', 6], ['Atenção', 3], ['Ruim', 1]]);
    const e = dimensionStat({ key: 'k', title: 'T' }, { happy: 2, neutral: 3, sad: 5 }, 'emojis');
    expect(toneGroups(e, 'emojis').map((g) => [g.label, g.count])).toEqual([['Bom', 2], ['Médio', 3], ['Ruim', 5]]);
  });

  it('escala de 1 a 5 junta 4 e 5, 3, e 1 e 2', () => {
    const n = dimensionStat({ key: 'k', title: 'T' }, { '5': 2, '4': 3, '3': 1, '2': 1, '1': 3 }, 'numbers_5');
    expect(toneGroups(n, 'numbers_5').map((g) => [g.label, g.count])).toEqual([['4 a 5', 5], ['3', 1], ['1 a 2', 4]]);
    expect(groupLabels('numbers_5').bad).toBe('1 a 2');
  });
});
