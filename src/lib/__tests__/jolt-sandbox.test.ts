import { describe, expect, it } from 'vitest';
import { MODEL_MENU, MODEL_SPECS, buildFullLayout, layoutSnapshot, modelSpecText, safeFileName } from '../jolt-sandbox';

const envelope = {
  tabela: { nome: 'PCINTEGRACAOROTASERVICO', campos: [{ nome: 'ID', valor: 'x' }, { nome: 'LAYOUTTRANSFORMACAO', valor: '[]' }] },
};

describe('modelos', () => {
  it('cada modelo do menu existe, é uma lista de operações e vira texto JSON', () => {
    for (const m of MODEL_MENU) {
      expect(Array.isArray(MODEL_SPECS[m.name])).toBe(true);
      expect(JSON.parse(modelSpecText(m.name))).toEqual(MODEL_SPECS[m.name]);
    }
    expect(MODEL_MENU.map((m) => m.name)).toEqual(['shift', 'modify', 'default', 'cardinality', 'remove']);
  });
});

describe('safeFileName', () => {
  it('troca o que o sistema de arquivos recusa e nunca devolve vazio', () => {
    expect(safeFileName('Pedido: venda/Protheus?')).toBe('Pedido- venda-Protheus-');
    expect(safeFileName('')).toBe('layout');
  });
});

describe('buildFullLayout', () => {
  const ops = [{ operation: 'shift', spec: { a: 'b' } }];

  it('layout colado inteiro volta como está (formatado)', () => {
    const r = buildFullLayout(JSON.stringify(envelope), null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.parse(r.text)).toEqual(envelope);
  });

  it('spec editada + arquivo carregado do GitHub: devolve o arquivo com a spec nova no lugar', () => {
    const r = buildFullLayout(JSON.stringify(ops), envelope);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const campos = JSON.parse(r.text).tabela.campos;
    expect(campos.find((c: { nome: string }) => c.nome === 'ID').valor).toBe('x');
    const layout = campos.find((c: { nome: string }) => c.nome === 'LAYOUTTRANSFORMACAO').valor;
    expect(typeof layout === 'string' ? JSON.parse(layout) : layout).toEqual(ops);
  });

  it('sem layout completo, explica o que fazer; spec inválida também', () => {
    const none = buildFullLayout(JSON.stringify(ops), null);
    expect(none).toMatchObject({ ok: false, title: 'Sem layout completo' });
    expect(buildFullLayout('{', null)).toMatchObject({ ok: false, title: 'Spec inválida' });
  });
});

describe('layoutSnapshot', () => {
  it('muda quando nome, URL, spec ou entrada mudam, e ignora espaços nas pontas do nome', () => {
    const base = { name: 'A', url: 'u', spec: 's', input: 'i' };
    expect(layoutSnapshot(base)).toBe(layoutSnapshot({ ...base, name: ' A ' }));
    for (const k of Object.keys(base) as (keyof typeof base)[]) {
      expect(layoutSnapshot({ ...base, [k]: base[k] + 'x' })).not.toBe(layoutSnapshot(base));
    }
  });
});
