import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GUEST_KEY,
  HANDOFF_GERADOR_PARA_SANDBOX,
  HANDOFF_SANDBOX_PARA_GERADOR,
  MAX_VALUE_CHARS,
  adoptGuestDrafts,
  clearGeradorHandoff,
  formatRecent,
  layoutsKey,
  peekFromSandbox,
  readGeradorDraft,
  readLayouts,
  readSandboxDraft,
  recentLayouts,
  sendToGerador,
  sendToSandbox,
  storeFailureMessage,
  takeFromGerador,
  userKey,
  writeGeradorDraft,
  writeLayouts,
  writeSandboxDraft,
  writeText,
  type SavedLayout,
} from '../jolt-storage';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

const layout = (over: Partial<SavedLayout>): SavedLayout => ({ id: 'a', name: 'A', apiUrl: '', joltSpec: '[]', lastInput: '{}', updatedAt: '2026-10-19T10:00:00', ...over });
const quota = () => {
  throw new DOMException('quota', 'QuotaExceededError');
};

describe('writeText: falhas viram resultado, nunca exceção', () => {
  it('valor grande demais nem é tentado', () => {
    expect(writeText('k', 'x'.repeat(MAX_VALUE_CHARS + 1))).toEqual({ ok: false, reason: 'grande' });
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('cota estourada vira "cheio"', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(quota);
    expect(writeText('k', 'abc')).toEqual({ ok: false, reason: 'cheio' });
  });

  it('armazenamento bloqueado vira "indisponivel"', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(writeText('k', 'abc')).toEqual({ ok: false, reason: 'indisponivel' });
  });

  it('cada falha tem um aviso em português que manda copiar o conteúdo', () => {
    for (const reason of ['grande', 'cheio', 'indisponivel'] as const) {
      expect(storeFailureMessage(reason, 'o rascunho')).toMatch(/[Cc]opie/);
    }
  });
});

describe('layouts salvos por usuário', () => {
  it('cada usuário tem a sua chave e a lista volta como foi gravada', () => {
    expect(layoutsKey('u1')).toBe('agileSpace_jolt_layouts_u1');
    expect(layoutsKey(null)).toBe(`agileSpace_jolt_layouts_${GUEST_KEY}`);
    expect(writeLayouts('u1', [layout({ id: '1' })]).ok).toBe(true);
    expect(readLayouts('u1').map((l) => l.id)).toEqual(['1']);
    expect(readLayouts('u2')).toEqual([]);
  });

  it('conteúdo estragado no armazenamento não derruba a leitura', () => {
    localStorage.setItem(layoutsKey('u1'), '{nao é json');
    expect(readLayouts('u1')).toEqual([]);
    localStorage.setItem(layoutsKey('u1'), '{"a":1}');
    expect(readLayouts('u1')).toEqual([]);
  });

  it('os recentes vêm do mais novo para o mais velho, no máximo 4', () => {
    const list = ['01', '02', '03', '04', '05', '06', '07'].map((d) => layout({ id: d, updatedAt: `2026-10-${d}T10:00:00` }));
    expect(recentLayouts(list).map((l) => l.id)).toEqual(['07', '06', '05', '04']);
  });

  it('formatRecent: hoje, ontem e data', () => {
    const now = new Date(2026, 9, 20, 15, 0);
    expect(formatRecent(new Date(2026, 9, 20, 9, 12).toISOString(), now)).toBe('hoje, 09:12');
    expect(formatRecent(new Date(2026, 9, 19, 17, 40).toISOString(), now)).toBe('ontem, 17:40');
    expect(formatRecent(new Date(2026, 9, 16, 11, 5).toISOString(), now)).toBe('16/10, 11:05');
    expect(formatRecent(new Date(2025, 11, 1, 8, 0).toISOString(), now)).toBe('01/12/2025, 08:00');
    expect(formatRecent('lixo', now)).toBe('');
  });
});

describe('rascunho da Sandbox', () => {
  const draft = { entrada: '{"a":1}', spec: '[]', saida: '{"b":2}', nome: 'Pedido', url: 'https://x' };

  it('entrada, spec e última saída sobrevivem (por usuário)', () => {
    expect(writeSandboxDraft('u1', draft).ok).toBe(true);
    expect(readSandboxDraft('u1')).toMatchObject(draft);
    expect(readSandboxDraft('u2')).toBeNull();
  });

  it('rascunho vazio apaga a chave em vez de guardar lixo', () => {
    writeSandboxDraft('u1', draft);
    writeSandboxDraft('u1', { entrada: '', spec: '', saida: '', nome: '', url: '' });
    expect(readSandboxDraft('u1')).toBeNull();
  });

  it('se não couber inteiro, abre mão do layout completo e da saída antes da entrada e da spec', () => {
    const calls: string[] = [];
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((_k, v) => {
      calls.push(String(v));
      if (String(v).includes('DOCUMENTO') || String(v).includes('"saida":"SAIDA')) quota();
    });
    const r = writeSandboxDraft('u1', { ...draft, saida: 'SAIDA', documento: 'DOCUMENTO' });
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(3);
    expect(calls[2]).not.toContain('SAIDA');
    expect(calls[2]).toContain('"entrada"');
  });

  it('quando nada cabe, devolve a falha para a tela avisar', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(quota);
    expect(writeSandboxDraft('u1', draft)).toEqual({ ok: false, reason: 'cheio' });
  });
});

describe('rascunho do Gerador e visitante', () => {
  it('as duas entradas do Gerador sobrevivem', () => {
    writeGeradorDraft('u1', { entrada: '{"a":1}', saida: '{"b":1}' });
    expect(readGeradorDraft('u1')).toEqual({ entrada: '{"a":1}', saida: '{"b":1}' });
  });

  it('o rascunho de visitante passa para a conta ao entrar e some da chave de visitante', () => {
    writeGeradorDraft(null, { entrada: 'E', saida: 'S' });
    writeSandboxDraft(null, { entrada: 'x', spec: '', saida: '', nome: '', url: '' });
    adoptGuestDrafts('u1');
    expect(readGeradorDraft('u1')).toEqual({ entrada: 'E', saida: 'S' });
    expect(readSandboxDraft('u1')?.entrada).toBe('x');
    expect(readGeradorDraft(null)).toBeNull();
    expect(readSandboxDraft(null)).toBeNull();
  });

  it('quem já tem rascunho próprio não é sobrescrito pelo de visitante', () => {
    writeGeradorDraft('u1', { entrada: 'minha', saida: '' });
    writeGeradorDraft(null, { entrada: 'visitante', saida: '' });
    adoptGuestDrafts('u1');
    expect(readGeradorDraft('u1')?.entrada).toBe('minha');
    expect(readGeradorDraft(null)).toBeNull();
  });

  it('userKey usa "visitante" sem usuário', () => {
    expect(userKey(undefined)).toBe('visitante');
    expect(userKey('u9')).toBe('u9');
  });
});

describe('passagem Sandbox <-> Gerador', () => {
  it('Gerador -> Sandbox: lê uma vez e apaga', () => {
    expect(sendToSandbox({ spec: '[1]', input: '{}', deManutencao: true }).ok).toBe(true);
    expect(takeFromGerador()).toEqual({ spec: '[1]', input: '{}', deManutencao: true });
    expect(takeFromGerador()).toBeNull();
    expect(localStorage.getItem(HANDOFF_GERADOR_PARA_SANDBOX)).toBeNull();
  });

  it('ainda entende as chaves antigas jolt_visual_* (quem estava no meio do fluxo na hora do deploy)', () => {
    localStorage.setItem('jolt_visual_generated_spec', '[2]');
    localStorage.setItem('jolt_visual_input_json', '{"a":1}');
    localStorage.setItem('jolt_visual_from_maintenance', 'true');
    expect(takeFromGerador()).toEqual({ spec: '[2]', input: '{"a":1}', deManutencao: true });
    expect(localStorage.getItem('jolt_visual_generated_spec')).toBeNull();
    expect(localStorage.getItem('jolt_visual_from_maintenance')).toBeNull();
  });

  it('Sandbox -> Gerador: lê sem apagar e apaga quando mandam (também a chave antiga)', () => {
    expect(sendToGerador('{"a":1}').ok).toBe(true);
    expect(peekFromSandbox()).toBe('{"a":1}');
    expect(peekFromSandbox()).toBe('{"a":1}');
    localStorage.setItem('jolt_generator_input', 'antiga');
    clearGeradorHandoff();
    expect(peekFromSandbox()).toBeNull();
    expect(localStorage.getItem(HANDOFF_SANDBOX_PARA_GERADOR)).toBeNull();
  });

  it('cota estourada na passagem não é silenciosa: devolve a falha', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(quota);
    expect(sendToSandbox({ spec: '[1]', input: '', deManutencao: false })).toEqual({ ok: false, reason: 'cheio' });
    expect(sendToGerador('x')).toEqual({ ok: false, reason: 'cheio' });
  });
});
