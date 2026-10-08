import { describe, it, expect } from 'vitest';
import { applyJoltLocal } from '../jolt-lite';
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

const run = (spec: any[]) => applyJoltLocal(clone(input), spec).outputData;

describe('Motor local (jolt-lite) igual ao Jolt oficial', () => {
  it('layout de clientes: saída idêntica ao resultado esperado, inclusive os tipos', () => {
    expect(run(fullSpec as any[])).toEqual(expected);
  });

  it('literal "#" é sempre texto: "#1" vira "1" e "#False" vira "False"', () => {
    const out: any = run(fullSpec as any[]);
    expect(out.items[0].pessoaFisica).toBe('1');
    expect(out.items[0].UtilizaPrecoAtacado).toBe('False');
  });

  it('para virar número é preciso um modify depois, como o próprio layout faz com sexo', () => {
    const spec = [
      { operation: 'shift', spec: { a: { M: { '#1': 'sexo' } } } },
      { operation: 'modify-overwrite-beta', spec: { sexo: '=toInteger' } },
    ];
    expect(applyJoltLocal({ a: 'M' }, spec).outputData).toEqual({ sexo: 1 });
  });
});

describe('Manutenção: layout antigo sem os dois campos', () => {
  it('o layout antigo não entrega vencimentoDias nem vencimentoPercentual', () => {
    const item: any = (run(legacySpec) as any).items[0];
    expect(item.vencimentoDias).toBeUndefined();
    expect(item.vencimentoPercentual).toBeUndefined();
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

  it('acrescenta os dois campos e o resultado é exatamente o esperado', () => {
    let spec: any[] = legacySpec;
    const r1 = addShiftMapping(spec, ['items', '*', 'minimumExpirationLotPercentage'], 'vencimentoPercentual');
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const r2 = addShiftMapping(r1.spec, ['items', '*', 'minimumExpirationLotDays'], 'vencimentoDias');
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    spec = r2.spec;

    expect(run(spec)).toEqual(expected);
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
      expect(applyJoltLocal({ pedidos: [{ valor: 10 }] }, r.spec).outputData).toEqual({ pedidos: [{ total: 10 }] });
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

  it('troca o destino de um campo e a saída acompanha', () => {
    const m = listShiftMappings(legacySpec).find(x => x.source === 'items.*.name')!;
    const r = updateMappingTargets(legacySpec, m, ['items.[&1].razaoSocial']);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const item: any = (run(r.spec) as any).items[0];
      expect(item.razaoSocial).toBe('ISAC 2');
      expect(item.nome).toBeUndefined();
    }
  });

  it('aceita mais de um destino para o mesmo campo', () => {
    const m = listShiftMappings(legacySpec).find(x => x.source === 'items.*.name')!;
    const r = updateMappingTargets(legacySpec, m, ['items.[&1].nome', 'items.[&1].nomeFantasia']);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const item: any = (run(r.spec) as any).items[0];
      expect(item.nome).toBe('ISAC 2');
      expect(item.nomeFantasia).toBe('ISAC 2');
    }
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

import {
  nodePathToKeys,
  keysToNodePath,
  targetStringToNodePath,
  nodePathToTargetString,
  layoutToCanvas,
  buildJsonFromNodePaths,
  applyMapperChanges,
} from '../jolt-maintenance';

describe('Mapeador: caminhos do mapa x chaves da spec', () => {
  it('converte nos dois sentidos', () => {
    expect(nodePathToKeys('items[*].name')).toEqual(['items', '*', 'name']);
    expect(nodePathToKeys('idExterno[*]')).toEqual(['idExterno', '*']);
    expect(nodePathToKeys('[*].x')).toEqual(['*', 'x']);
    expect(nodePathToKeys('a[*][*].b')).toEqual(['a', '*', '*', 'b']);
    expect(keysToNodePath(['items', '*', 'name'])).toBe('items[*].name');
    expect(keysToNodePath(['*', 'x'])).toBe('[*].x');
    expect(keysToNodePath(nodePathToKeys('a.b[*].c'))).toBe('a.b[*].c');
  });

  it('destino da spec vira caminho do mapa; avançado devolve null', () => {
    expect(targetStringToNodePath('items.[&1].nome')).toBe('items[*].nome');
    expect(targetStringToNodePath('idExterno[]')).toBe('idExterno[*]');
    expect(targetStringToNodePath('idInterno')).toBe('idInterno');
    expect(targetStringToNodePath('a.[&3].b.[&1].c')).toBe('a[*].b[*].c');
    expect(targetStringToNodePath('items.&(1,0).nome')).toBeNull();
    expect(targetStringToNodePath('items.@(1,x)')).toBeNull();
  });

  it('caminho do mapa vira destino da spec, contando os níveis até cada lista', () => {
    expect(nodePathToTargetString('items[*].vencimentoDias', ['items', '*', 'x'])).toBe('items.[&1].vencimentoDias');
    expect(nodePathToTargetString('flat', ['items', '*', 'x'])).toBe('flat');
    expect(nodePathToTargetString('a[*].b[*].c', ['a', '*', 'b', '*', 'z'])).toBe('a.[&3].b.[&1].c');
    expect(nodePathToTargetString('ids[*]', ['ids', '*'])).toBe('ids[]');
    expect(nodePathToTargetString('items[*].x', ['soUmaCoisa'])).toBeNull();
  });
});

describe('Mapeador: layout existente no canvas', () => {
  const inputPaths = new Set(listInputFields(input).map(f => keysToNodePath(f.path)));

  it('desenha os mapeamentos simples e separa condicionais e órfãos', () => {
    const c = layoutToCanvas(legacySpec, inputPaths);
    const byTarget = new Map(c.edges.map(e => [e.target, e.source]));
    expect(byTarget.get('items[*].nome')).toBe('items[*].name');
    expect(byTarget.get('items[*].dataNascimento')).toBe('items[*].dataNascimento');
    // idExterno, cep_entrega... nascem no modify e não existem na entrada: ficam como órfãos
    expect(byTarget.has('idExterno[*]')).toBe(false);
    expect(c.orphans.some(m => m.source === 'items.*.idExterno')).toBe(true);
    expect(c.orphans.some(m => m.source === 'items.*.cep_entrega')).toBe(true);
    // sexo e corporate são condicionais (#), wholesalePriceUses também
    expect(c.advanced.some(m => m.source.startsWith('items.*.corporate'))).toBe(true);
    expect(c.advanced.some(m => m.source.startsWith('items.*.wholesalePriceUses'))).toBe(true);
    // campos que só existem depois do modify (idExterno, cpf_cnpj...) não estão na entrada: órfãos
    expect(c.orphans.some(m => m.source === 'items.*.cpf_cnpj')).toBe(true);
  });

  it('monta um JSON de saída com os campos do layout', () => {
    const c = layoutToCanvas(legacySpec, inputPaths);
    const json: any = buildJsonFromNodePaths(c.edges.map(e => e.target));
    expect(Object.keys(json.items[0])).toEqual(expect.arrayContaining(['idRetaguarda', 'nome', 'endereco', 'email']));
    expect(listInputFields(json).map(f => keysToNodePath(f.path))).toEqual(expect.arrayContaining(['items[*].nome', 'items[*].email']));
  });
});

describe('Mapeador: aplicar só o que mudou no mapa', () => {
  const inputPaths = new Set(listInputFields(input).map(f => keysToNodePath(f.path)));
  const base = layoutToCanvas(legacySpec, inputPaths).edges;
  const same = base.map(e => ({ source: e.source, target: e.target }));

  it('sem mudança no mapa a spec volta idêntica', () => {
    const r = applyMapperChanges(legacySpec, base, same);
    expect(r.spec).toEqual(legacySpec);
    expect(r.added).toEqual([]);
    expect(r.removed).toEqual([]);
    expect(r.errors).toEqual([]);
  });

  it('duas ligações novas no mapa viram as duas linhas na shift e a saída esperada', () => {
    const r = applyMapperChanges(legacySpec, base, [
      ...same,
      { source: 'items[*].minimumExpirationLotPercentage', target: 'items[*].vencimentoPercentual' },
      { source: 'items[*].minimumExpirationLotDays', target: 'items[*].vencimentoDias' },
    ]);
    expect(r.errors).toEqual([]);
    expect(r.added).toHaveLength(2);
    expect(run(r.spec)).toEqual(expected);
  });

  it('ligação apagada no mapa sai da spec; o resto fica', () => {
    const r = applyMapperChanges(legacySpec, base, same.filter(e => e.source !== 'items[*].email'));
    expect(r.removed).toEqual(['items[*].email → items[*].email']);
    const item: any = (run(r.spec) as any).items[0];
    expect(item.email).toBeUndefined();
    expect(item.nome).toBe('ISAC 2');
    expect(item.pessoaFisica).toBe('1'); // condicional preservado
  });

  it('avisa sem quebrar quando a ligação não pode ser aplicada', () => {
    const dup = applyMapperChanges(legacySpec, base, [...same, { source: 'items[*].name', target: 'items[*].outro' }]);
    expect(dup.errors[0]).toMatch(/já está mapeado/);
    expect(dup.spec).toEqual(legacySpec);

    const semLista = applyMapperChanges(legacySpec, base, [...same, { source: 'items[*].minimumExpirationLotDays', target: 'dias' }]);
    expect(semLista.errors).toEqual([]); // destino sem lista é válido (campo solto)

    const listaDemais = applyMapperChanges(legacySpec, base, [...same, { source: 'items[*].minimumExpirationLotDays', target: 'a[*].b[*].c' }]);
    expect(listaDemais.errors[0]).toMatch(/não foi possível montar o destino/);
  });
});
