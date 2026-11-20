import { describe, expect, it } from 'vitest';
import { TOPIC_CONTENT } from '../content';
import type { ManualBlock } from '../content/types';
import { parseInline, plainText } from '../data/inline';
import { blockPlainText, bodyText, buildIndex, fold, headingsOf, queryTokens, readingMinutes, searchTopics, snippetAround } from '../data/search';
import { MANUAL_TOPICS } from '../data/topics';

const INDEX = buildIndex(MANUAL_TOPICS, TOPIC_CONTENT);
const ids = (q: string, cat?: Parameters<typeof searchTopics>[2]) => searchTopics(INDEX, q, cat).map((h) => h.topic.id);

describe('marcação simples dos textos', () => {
  it('lê negrito, código e link', () => {
    expect(parseInline('Use **Salvar** e `X-Api-Key` em [Suporte](/support).')).toEqual([
      { type: 'text', text: 'Use ' },
      { type: 'bold', text: 'Salvar' },
      { type: 'text', text: ' e ' },
      { type: 'code', text: 'X-Api-Key' },
      { type: 'text', text: ' em ' },
      { type: 'link', text: 'Suporte', href: '/support' },
      { type: 'text', text: '.' },
    ]);
  });

  it('o texto puro não leva a marcação', () => {
    expect(plainText('**Quem vota:** [Poker](/manual/poker) em `horas`')).toBe('Quem vota: Poker em horas');
  });
});

describe('busca no Manual', () => {
  it('fold tira acento e caixa sem mudar o tamanho', () => {
    const s = 'Configuração do Cálculo, AÇÃO e não';
    expect(fold(s)).toBe('configuracao do calculo, acao e nao');
    expect(fold(s)).toHaveLength(s.length);
  });

  it('busca vazia devolve todos os tópicos, sem trecho', () => {
    const hits = searchTopics(INDEX, '   ');
    expect(hits).toHaveLength(MANUAL_TOPICS.length);
    expect(hits.every((h) => h.snippet === '')).toBe(true);
  });

  it('acha pelo título, sem depender de acento nem de caixa', () => {
    expect(ids('SEGURANCA')[0]).toBe('governance');
    expect(ids('radar de clima')[0]).toBe('health');
    expect(ids('planejamento')).toContain('planner');
  });

  it('acha pelo nome antigo (palavra-chave)', () => {
    expect(ids('biblioteca de ia')).toContain('prompt-hub');
    expect(ids('sprint planner')).toContain('planner');
  });

  it('acha pelo texto do corpo e mostra o trecho "No texto"', () => {
    const hit = searchTopics(INDEX, 'assinatura').find((h) => h.topic.id === 'devtools');
    expect(hit).toBeTruthy();
    expect(hit!.inBody).toBe(true);
    expect(hit!.inTitle).toBe(false);
    expect(hit!.snippet.toLowerCase()).toContain('assinatura');
  });

  it('acha o que só está dentro de um passo ou de uma pergunta do tópico', () => {
    expect(ids('jira').length).toBeGreaterThan(3);
    expect(ids('rotacione')).toContain('integracoes');
    expect(ids('cadeado')).toContain('brainstorming');
    expect(ids('copiar estimativa')).toContain('poker');
  });

  it('acha pelo nome real de uma ferramenta MCP e de um endereço da API', () => {
    expect(ids('batchImportSkills')).toContain('integracoes');
    expect(ids('/api/v1/poker/rounds')).toContain('integracoes');
    expect(ids('getSquadStatus')).toContain('painel');
  });

  it('quem tem o termo no título vem antes de quem só o tem no texto', () => {
    const r = searchTopics(INDEX, 'poker');
    expect(r[0].topic.id).toBe('poker');
    expect(r[0].inTitle).toBe(true);
    const firstBodyOnly = r.findIndex((h) => !h.inTitle);
    expect(firstBodyOnly).toBeGreaterThan(0);
    expect(r.slice(firstBodyOnly).every((h) => !h.inTitle)).toBe(true);
  });

  it('todas as palavras da busca precisam estar no tópico', () => {
    expect(ids('poker jira').length).toBeGreaterThan(0);
    expect(ids('poker xyzxyzxyz')).toEqual([]);
  });

  it('busca sem resultado devolve vazio (estado "Nada encontrado")', () => {
    expect(ids('reembolso')).toEqual([]);
  });

  it('filtra por categoria junto com a busca', () => {
    expect(ids('jira', 'tools').every((id) => MANUAL_TOPICS.find((t) => t.id === id)!.category === 'tools')).toBe(true);
    expect(ids('', 'account')).toEqual(MANUAL_TOPICS.filter((t) => t.category === 'account').map((t) => t.id));
  });

  it('todo tópico é achado pelo próprio título', () => {
    for (const t of MANUAL_TOPICS) expect(ids(t.title), t.title).toContain(t.id);
  });

  it('o trecho é cortado do texto original, com reticências nas pontas', () => {
    const body = 'Um texto longo que fala de muitas coisas diferentes, entre elas o que a squad combinou na última cerimônia, e no meio dele aparece a palavra Cadeado para a busca encontrar, seguida de mais frases que vão até o fim do parágrafo e ainda continuam por um bom tempo.';
    const s = snippetAround(body, fold(body), queryTokens('cadeado'));
    expect(s.startsWith('…')).toBe(true);
    expect(s.endsWith('…')).toBe(true);
    expect(s).toContain('Cadeado');
    expect(snippetAround(body, fold(body), queryTokens('inexistente'))).toBe('');
  });
});

describe('texto dos blocos', () => {
  it('cada tipo de bloco entra no texto de busca', () => {
    const blocks: ManualBlock[] = [
      { kind: 'idea', text: 'ideia **central**' },
      { kind: 'step', title: 'Passo', text: 'faça' },
      { kind: 'faq', q: 'Pergunta?', a: 'Resposta' },
      { kind: 'code', lang: 'json', code: '{"a":1}' },
      { kind: 'api', label: 'GET', path: '/x', text: 'lê' },
    ];
    const text = bodyText(blocks);
    for (const parte of ['ideia central', 'Passo', 'faça', 'Pergunta?', 'Resposta', '{"a":1}', 'GET', '/x', 'lê']) expect(text).toContain(parte);
    expect(blockPlainText({ kind: 'module-api', moduleId: 'poker' })).toContain('createPokerSession');
    expect(blockPlainText({ kind: 'module-api', moduleId: 'nao-existe' })).toBe('');
  });

  it('tempo de leitura: no mínimo 1 minuto e cresce com o texto', () => {
    expect(readingMinutes([{ kind: 'p', text: 'curto' }])).toBe(1);
    const longo: ManualBlock[] = [{ kind: 'p', text: Array.from({ length: 900 }, () => 'palavra').join(' ') }];
    expect(readingMinutes(longo)).toBe(5);
  });

  it('o sumário lista as seções e a seção de API', () => {
    const h = headingsOf(TOPIC_CONTENT.poker);
    expect(h[0]).toEqual({ id: 'secao-1', text: 'Como uma rodada funciona' });
    expect(h.some((x) => x.text.startsWith('API REST'))).toBe(true);
    expect(new Set(h.map((x) => x.id)).size).toBe(h.length);
  });
});
