import { describe, expect, it } from 'vitest';
import { buildRouteRecord, defaultRouteForm, routeFormFromRecord, routeProblems, routeVariables } from '../jolt-route-record';

const spec = [{ operation: 'default', spec: { _attr_access: 'items' } }];

const existing = {
  tabela: {
    nome: 'PCINTEGRACAOROTASERVICO',
    campos: [
      { nome: 'SOMENTEATUALIZARINTEGRACAOCORE', valor: 'N' },
      { nome: 'ID', valor: 'WTA - Buscar Clientes' },
      { nome: 'IDEMPRESAAPI', valor: 'WINTHOR-WTA' },
      { nome: 'SERVICO', valor: 'WTA - Buscar Clientes' },
      {
        nome: 'LAYOUTCOMUNICACAO',
        valor: {
          name: 'WTA -Buscar Clientes',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{TOKEN}}' }],
            url: { raw: '{{URL_BASE}}/api/wholesale/v1/customer/list', query: [{ key: 'page', value: '{{PAGE}}' }] },
          },
          response: [],
        },
      },
      { nome: 'LAYOUTTRANSFORMACAO', valor: [{ operation: 'shift', spec: {} }] },
      { nome: 'ATIVO', valor: 'S' },
      { nome: 'AUTENTICADOR', valor: 'N' },
      { nome: 'DATASINCRONISMO', valor: '14-NOV-23' },
      { nome: 'REFRESHTOKEN', valor: '' },
      { nome: 'TIPOPROCESSO', valor: 'BUSCAR' },
      { nome: 'DISPONIVELURLROTAWTA', valor: 'S' },
      { nome: 'CAMPONOVO', valor: 'X' },
    ],
  },
};

describe('jolt-route-record', () => {
  it('lê um registro existente e remonta igual, trocando só a spec', () => {
    const r = routeFormFromRecord(existing);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.form.id).toBe('WTA - Buscar Clientes');
    expect(r.form.query).toEqual([{ key: 'page', value: '{{PAGE}}' }]);
    expect(r.form.ativo).toBe(true);
    expect(r.form.autenticador).toBe(false);
    expect(r.spec).toEqual([{ operation: 'shift', spec: {} }]);

    const rebuilt = buildRouteRecord(r.form, spec);
    const campos = rebuilt.tabela.campos;
    expect(campos.find((c) => c.nome === 'LAYOUTTRANSFORMACAO')?.valor).toEqual(spec);
    expect(campos.find((c) => c.nome === 'CAMPONOVO')?.valor).toBe('X');
    const original = existing.tabela.campos.filter((c) => c.nome !== 'LAYOUTTRANSFORMACAO');
    for (const c of original) {
      expect(campos.find((x) => x.nome === c.nome)?.valor).toEqual(c.valor);
    }
  });

  it('formulário novo: serviço cai no ID, query vazia some, flags viram S/N', () => {
    const form = { ...defaultRouteForm(), id: 'WTA - Buscar Produtos', url: '{{URL_BASE}}/api/produtos' };
    const rec = buildRouteRecord(form, spec);
    const by = (n: string) => rec.tabela.campos.find((c) => c.nome === n)?.valor;
    expect(by('SERVICO')).toBe('WTA - Buscar Produtos');
    expect(by('ATIVO')).toBe('S');
    expect(by('AUTENTICADOR')).toBe('N');
    expect((by('LAYOUTCOMUNICACAO') as { request: { url: object } }).request.url).toEqual({ raw: '{{URL_BASE}}/api/produtos' });
    expect(routeVariables(rec)).toEqual(['TOKEN', 'URL_BASE']);
    expect(routeProblems(form)).toEqual([]);
    expect(routeProblems(defaultRouteForm())).toHaveLength(2);
  });

  it('recusa o que não é registro de rota', () => {
    expect(routeFormFromRecord({ items: [] }).ok).toBe(false);
  });
});
