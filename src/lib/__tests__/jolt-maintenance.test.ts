import { describe, it, expect } from 'vitest';
import {
  parseLayoutText,
  parseLayoutData,
  listShiftMappings,
  listInputFields,
  classifyInputFields,
  addShiftMapping,
  updateMappingTargets,
  removeMapping,
  resolveTarget,
} from '../jolt-maintenance';
import input from './fixtures/jolt-clientes/input.json';
import fullSpec from './fixtures/jolt-clientes/spec.json';
import expected from './fixtures/jolt-clientes/expected.json';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** O layout como estava ANTES de a API ganhar os dois campos de vencimento. */
const legacySpec = (() => {
  const s: any[] = clone(fullSpec);
  const shift = s.find(op => op.operation === 'shift');
  delete shift.spec.items['*'].minimumExpirationLotPercentage;
  delete shift.spec.items['*'].minimumExpirationLotDays;
  return s;
})();

const shiftOf = (spec: any[]) => spec.find((op: any) => op.operation === 'shift');

// A execução de verdade (motor Java, no servidor) é conferida no backend com este mesmo layout:
// agile-space-backend/src/test/resources/jolt-engine/clientes e JoltJavaEngineServiceTest.
describe('Layout de clientes (fixture compartilhada com o teste do motor Java)', () => {
  it('a fixture traz o resultado esperado com os tipos que o layout produz', () => {
    const item: any = (expected as any).items[0];
    expect(item.pessoaFisica).toBe('1');
    expect(item.UtilizaPrecoAtacado).toBe('False');
  });
});

describe('Manutenção: layout antigo sem os dois campos', () => {
  it('o layout antigo não mapeia vencimentoDias nem vencimentoPercentual', () => {
    const itemSpec = shiftOf(legacySpec).spec.items['*'];
    expect(Object.values(itemSpec)).not.toContain('items.[&1].vencimentoDias');
    expect(Object.values(itemSpec)).not.toContain('items.[&1].vencimentoPercentual');
  });

  it('acusa os dois campos novos como "sem uso" e reconhece os já tratados', () => {
    const byLabel = Object.fromEntries(classifyInputFields(input, legacySpec).map(f => [f.label, f]));
    expect(byLabel['items.*.minimumExpirationLotDays'].usage).toBe('unused');
    expect(byLabel['items.*.minimumExpirationLotPercentage'].usage).toBe('unused');
    expect(byLabel['items.*.name'].usage).toBe('mapped');
    expect(byLabel['items.*.name'].targets).toEqual(['items.[&1].nome']);
    // usado só pelo modify (@(1,personIdentificationNumber)), não vai direto para a saída
    expect(byLabel['items.*.personIdentificationNumber'].usage).toBe('indirect');
    // campo condicional (corporate → #0/#1) conta como mapeado
    expect(byLabel['items.*.corporate'].usage).toBe('mapped');
  });

  it('acrescenta os dois campos e a spec fica igual ao layout completo', () => {
    let spec: any[] = legacySpec;
    const r1 = addShiftMapping(spec, ['items', '*', 'minimumExpirationLotPercentage'], 'vencimentoPercentual');
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const r2 = addShiftMapping(r1.spec, ['items', '*', 'minimumExpirationLotDays'], 'vencimentoDias');
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    spec = r2.spec;

    expect(spec).toEqual(fullSpec);
  });

  it('usa o padrão dos vizinhos para o destino (items.[&1].) e o texto digitado quando é caminho completo', () => {
    const r = addShiftMapping(legacySpec, ['items', '*', 'minimumExpirationLotDays'], 'vencimentoDias');
    expect(r.ok && (r.spec.find((o: any) => o.operation === 'shift').spec.items['*'].minimumExpirationLotDays)).toBe('items.[&1].vencimentoDias');

    const full = addShiftMapping(legacySpec, ['items', '*', 'minimumExpirationLotDays'], 'items.[&1].dias.vencimento');
    expect(full.ok && (full.spec.find((o: any) => o.operation === 'shift').spec.items['*'].minimumExpirationLotDays)).toBe('items.[&1].dias.vencimento');
  });

  it('não mexe em nada além da shift e não altera a spec original', () => {
    const before = clone(legacySpec);
    const r = addShiftMapping(legacySpec, ['items', '*', 'minimumExpirationLotDays'], 'vencimentoDias');
    expect(legacySpec).toEqual(before);
    if (!r.ok) throw new Error(r.reason);
    r.spec.forEach((op: any, i: number) => {
      if (op.operation !== 'shift') expect(op).toEqual(before[i]);
    });
    const oldShift = before.find(o => o.operation === 'shift').spec.items['*'];
    const newShift = r.spec.find((o: any) => o.operation === 'shift').spec.items['*'];
    expect(Object.keys(newShift)).toEqual([...Object.keys(oldShift), 'minimumExpirationLotDays']);
  });

  it('recusa campo que já está mapeado, sem alterar a spec', () => {
    const r = addShiftMapping(legacySpec, ['items', '*', 'name'], 'outroNome');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/já está mapeado/);
  });

  it('recusa entradas vazias e layout sem shift', () => {
    expect(addShiftMapping(legacySpec, [], 'x').ok).toBe(false);
    expect(addShiftMapping(legacySpec, ['items', '*', 'x'], '  ').ok).toBe(false);
    const semShift = [{ operation: 'default', spec: { a: 1 } }];
    const r = addShiftMapping(semShift, ['a'], 'b');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/shift/);
  });

  it('cria o caminho quando a shift ainda não conhece aquele trecho da entrada', () => {
    const spec = [{ operation: 'shift', spec: { cliente: { '*': { nome: 'nome' } } } }];
    const r = addShiftMapping(spec, ['pedidos', '*', 'valor'], 'pedidos.[&1].total');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect((r.spec[0] as any).spec.pedidos['*'].valor).toBe('pedidos.[&1].total');
    }
  });

  it('escapa nomes de campo com caracteres especiais', () => {
    const spec = [{ operation: 'shift', spec: { '*': { a: 'a' } } }];
    const r = addShiftMapping(spec, ['*', 'preço*final'], 'precoFinal');
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys((r.spec[0] as any).spec['*'])).toContain('preço\\*final');
  });
});

describe('Manutenção: trocar destino e remover', () => {
  it('lista os mapeamentos com origem legível e marca os condicionais', () => {
    const list = listShiftMappings(legacySpec);
    const name = list.find(m => m.source === 'items.*.name')!;
    expect(name.targets).toEqual(['items.[&1].nome']);
    expect(name.conditional).toBe(false);
    const corporate = list.filter(m => m.source.startsWith('items.*.corporate'));
    expect(corporate.length).toBe(2);
    expect(corporate.every(m => m.conditional)).toBe(true);
  });

  it('troca o destino de um campo na shift', () => {
    const m = listShiftMappings(legacySpec).find(x => x.source === 'items.*.name')!;
    const r = updateMappingTargets(legacySpec, m, ['items.[&1].razaoSocial']);
    expect(r.ok).toBe(true);
    if (r.ok) expect(shiftOf(r.spec).spec.items['*'].name).toBe('items.[&1].razaoSocial');
  });

  it('aceita mais de um destino para o mesmo campo', () => {
    const m = listShiftMappings(legacySpec).find(x => x.source === 'items.*.name')!;
    const r = updateMappingTargets(legacySpec, m, ['items.[&1].nome', 'items.[&1].nomeFantasia']);
    expect(r.ok).toBe(true);
    if (r.ok) expect(shiftOf(r.spec).spec.items['*'].name).toEqual(['items.[&1].nome', 'items.[&1].nomeFantasia']);
  });

  it('remove um campo e limpa os objetos que ficaram vazios', () => {
    const spec = [{ operation: 'shift', spec: { a: { b: { c: 'x' } }, d: 'y' } }];
    const m = listShiftMappings(spec).find(x => x.source === 'a.b.c')!;
    const r = removeMapping(spec, m);
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.spec[0] as any).spec).toEqual({ d: 'y' });
  });

  it('avisa quando o mapeamento já não existe (spec mudou por fora)', () => {
    const stale = { opIndex: 1, specPath: ['items', '*', 'naoExiste'] };
    expect(removeMapping(legacySpec, stale).ok).toBe(false);
    expect(updateMappingTargets(legacySpec, stale, ['x']).ok).toBe(false);
    expect(updateMappingTargets(legacySpec, { opIndex: 1, specPath: ['items', '*', 'name'] }, ['  ']).ok).toBe(false);
  });
});

describe('Layout completo (PCINTEGRACAOROTASERVICO)', () => {
  const envelope = (valor: unknown) => ({
    tabela: {
      nome: 'PCINTEGRACAOROTASERVICO',
      campos: [
        { nome: 'ID', valor: 'WTA - Buscar Clientes' },
        { nome: 'LAYOUTCOMUNICACAO', valor: { request: { method: 'GET' } } },
        { nome: 'LAYOUTTRANSFORMACAO', valor },
        { nome: 'ATIVO', valor: 'S' },
      ],
    },
  });

  it('extrai a transformação e devolve o layout inteiro com a spec nova, sem tocar no resto', () => {
    const doc = envelope(legacySpec);
    const parsed = parseLayoutData(doc);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.parts.kind).toBe('envelope');

    const added = addShiftMapping(parsed.parts.spec, ['items', '*', 'minimumExpirationLotDays'], 'vencimentoDias');
    if (!added.ok) throw new Error(added.reason);
    const rebuilt = parsed.parts.rebuild(added.spec);

    expect(rebuilt.tabela.campos.map((c: any) => c.nome)).toEqual(['ID', 'LAYOUTCOMUNICACAO', 'LAYOUTTRANSFORMACAO', 'ATIVO']);
    expect(rebuilt.tabela.campos[1]).toEqual(doc.tabela.campos[1]);
    expect(rebuilt.tabela.campos[0]).toEqual(doc.tabela.campos[0]);
    expect(rebuilt.tabela.campos[2].valor).toEqual(added.spec);
    expect(doc.tabela.campos[2].valor).toEqual(legacySpec); // original intacto
  });

  it('mantém LAYOUTTRANSFORMACAO como texto quando veio como texto', () => {
    const parsed = parseLayoutData(envelope(JSON.stringify(legacySpec)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const rebuilt = parsed.parts.rebuild(parsed.parts.spec);
    expect(typeof rebuilt.tabela.campos[2].valor).toBe('string');
    expect(JSON.parse(rebuilt.tabela.campos[2].valor)).toEqual(legacySpec);
  });

  it('entende array de operações e uma operação solta', () => {
    expect(parseLayoutText(JSON.stringify(legacySpec))).toMatchObject({ ok: true, parts: { kind: 'array' } });
    expect(parseLayoutText(JSON.stringify(legacySpec[1]))).toMatchObject({ ok: true, parts: { kind: 'array' } });
  });

  it('explica o que está errado em vez de falhar calado', () => {
    expect(parseLayoutText('{ quebrado')).toMatchObject({ ok: false });
    expect(parseLayoutText('{"foo": 1}')).toMatchObject({ ok: false });
    expect(parseLayoutData({ tabela: { campos: [{ nome: 'ID', valor: 'x' }] } })).toMatchObject({ ok: false, error: expect.stringContaining('LAYOUTTRANSFORMACAO') });
    expect(parseLayoutData(envelope('não é json'))).toMatchObject({ ok: false });
  });
});

describe('Campos da entrada', () => {
  it('junta os elementos de listas e devolve um exemplo de valor', () => {
    const fields = listInputFields({ itens: [{ a: 1 }, { a: 2, b: null }, { b: 'x' }], total: 3, tags: ['x', 'y'] });
    const labels = fields.map(f => f.label).sort();
    expect(labels).toEqual(['itens.*.a', 'itens.*.b', 'tags', 'total']);
    expect(fields.find(f => f.label === 'itens.*.b')!.example).toBe('x');
  });
});

describe('resolveTarget', () => {
  it('sem vizinhos devolve o texto como foi digitado', () => {
    expect(resolveTarget(undefined, ' vencimentoDias ')).toBe('vencimentoDias');
    expect(resolveTarget({}, 'a')).toBe('a');
  });
});
