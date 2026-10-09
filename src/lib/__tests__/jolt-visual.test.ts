import { describe, expect, it } from 'vitest';
import {
  addShiftTarget,
  DEFAULT_ENVELOPE_TEMPLATE,
  flattenJsonToPaths,
  generateJoltSpec,
  injectSpecIntoEnvelope,
  type Mapping,
} from '../jolt-visual';
import { applyJoltLocal } from '../jolt-lite';

const m = (source: string, target: string): Mapping => ({ id: `${source}-${target}`, source, target, type: 'direct' });

describe('flattenJsonToPaths', () => {
  it('desce em objetos e usa só o primeiro item de listas de objetos', () => {
    const paths = flattenJsonToPaths({ cliente: { nome: 'A' }, itens: [{ id: 1 }, { id: 2 }], tags: ['a'] });
    expect(paths.map(p => p.path)).toEqual(['cliente.nome', 'itens[*].id', 'tags[*]']);
  });

  it('JSON que não é objeto não gera campos', () => {
    expect(flattenJsonToPaths(null)).toEqual([]);
    expect(flattenJsonToPaths('x')).toEqual([]);
  });
});

describe('addShiftTarget', () => {
  it('mesmo campo de origem ligado a dois destinos vira lista de destinos', () => {
    const items: Record<string, any> = {};
    const origins = new Map<string, string>();
    addShiftTarget(items, origins, 'id', 'items[*].id', '[&1].codigo');
    addShiftTarget(items, origins, 'id', 'items[*].id', '[&1].idExterno');
    addShiftTarget(items, origins, 'id', 'items[*].id', '[&1].idExterno');
    expect(items.id).toEqual(['[&1].codigo', '[&1].idExterno']);
  });

  it('origens diferentes com a mesma folha mantêm o comportamento antigo (a última vence)', () => {
    const items: Record<string, any> = {};
    const origins = new Map<string, string>();
    addShiftTarget(items, origins, 'id', 'a.id', '[&1].x');
    addShiftTarget(items, origins, 'id', 'b.id', '[&1].y');
    expect(items.id).toBe('[&1].y');
  });
});

describe('generateJoltSpec (modo direto)', () => {
  const input = JSON.stringify({ items: [{ id: '7', nome: 'Ana' }] });

  it('um campo de origem para dois destinos entrega os dois na saída', () => {
    const spec = generateJoltSpec([m('items[*].id', 'items[*].codigo'), m('items[*].id', 'items[*].idExterno')], {
      mode: 'direct',
      inputJson: input,
      targetJson: '{}',
    });
    const { outputData } = applyJoltLocal(JSON.parse(input), spec);
    const out = (outputData as any).items ?? outputData;
    const first = Array.isArray(out) ? out[0] : out;
    expect(first.codigo).toBe('7');
    expect(first.idExterno).toBe('7');
  });

  it('ligação simples continua gerando destino em texto (sem lista)', () => {
    const spec = generateJoltSpec([m('items[*].nome', 'items[*].nomeCliente')], {
      mode: 'direct',
      inputJson: input,
      targetJson: '{}',
    });
    const shift = spec.find((op: any) => op.operation === 'shift');
    expect(JSON.stringify(shift)).toContain('"nome":"[&1].nomeCliente"');
  });
});

describe('injectSpecIntoEnvelope', () => {
  it('coloca a spec no lugar do marcador', () => {
    const out = JSON.parse(injectSpecIntoEnvelope([{ operation: 'sort' }], DEFAULT_ENVELOPE_TEMPLATE));
    const campo = out.tabela.campos.find((c: any) => c.nome === 'LAYOUTTRANSFORMACAO');
    expect(campo.valor).toEqual([{ operation: 'sort' }]);
  });

  it("não corrompe a spec quando ela tem '$' seguido de aspas simples ou '&' (padrões do String.replace)", () => {
    const spec = [{ operation: 'modify-overwrite-beta', spec: { preco: "=concat('$',@(1,valor))", marca: "=concat('$&',@(1,x))" } }];
    const out = JSON.parse(injectSpecIntoEnvelope(spec, DEFAULT_ENVELOPE_TEMPLATE));
    const campo = out.tabela.campos.find((c: any) => c.nome === 'LAYOUTTRANSFORMACAO');
    expect(campo.valor).toEqual(spec);
  });

  it('sem template devolve só a spec formatada', () => {
    expect(JSON.parse(injectSpecIntoEnvelope([{ operation: 'sort' }], ''))).toEqual([{ operation: 'sort' }]);
  });
});
