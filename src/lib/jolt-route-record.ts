/**
 * Registro de rota do Smart Hub (tabela PCINTEGRACAOROTASERVICO): o envelope em volta da spec. A spec gerada vai em
 * LAYOUTTRANSFORMACAO; o resto (serviço, requisição, flags) vem do formulário ou de um registro existente.
 */

export interface KeyValue {
  key: string;
  value: string;
}

export interface RouteForm {
  id: string;
  servico: string;
  empresaApi: string;
  tipoProcesso: 'BUSCAR' | 'ENVIAR' | string;
  nomeComunicacao: string;
  method: string;
  url: string;
  headers: KeyValue[];
  query: KeyValue[];
  ativo: boolean;
  autenticador: boolean;
  disponivelUrlWta: boolean;
  somenteAtualizarCore: boolean;
  dataSincronismo: string;
  refreshToken: string;
  /** Campos do registro que o formulário não conhece: voltam como estavam. */
  extras: { nome: string; valor: unknown }[];
}

export const ROUTE_TABLE = 'PCINTEGRACAOROTASERVICO';

const KNOWN = new Set([
  'SOMENTEATUALIZARINTEGRACAOCORE', 'ID', 'IDEMPRESAAPI', 'SERVICO', 'LAYOUTCOMUNICACAO', 'LAYOUTTRANSFORMACAO',
  'ATIVO', 'AUTENTICADOR', 'DATASINCRONISMO', 'REFRESHTOKEN', 'TIPOPROCESSO', 'DISPONIVELURLROTAWTA',
]);

export function defaultRouteForm(): RouteForm {
  return {
    id: '',
    servico: '',
    empresaApi: 'WINTHOR-WTA',
    tipoProcesso: 'BUSCAR',
    nomeComunicacao: '',
    method: 'GET',
    url: '{{URL_BASE}}/',
    headers: [
      { key: 'Authorization', value: 'Bearer {{TOKEN}}' },
      { key: 'Accept', value: '*/*' },
    ],
    query: [],
    ativo: true,
    autenticador: false,
    disponivelUrlWta: true,
    somenteAtualizarCore: false,
    dataSincronismo: '',
    refreshToken: '',
    extras: [],
  };
}

const sn = (b: boolean) => (b ? 'S' : 'N');
const clean = (rows: KeyValue[]) => rows.filter((r) => r.key.trim() !== '').map((r) => ({ key: r.key.trim(), value: r.value }));

/** Monta o registro completo, na ordem de campos dos layouts publicados. */
export function buildRouteRecord(form: RouteForm, spec: unknown): { tabela: { nome: string; campos: { nome: string; valor: unknown }[] } } {
  const servico = form.servico.trim() || form.id.trim();
  const url: { raw: string; query?: KeyValue[] } = { raw: form.url.trim() };
  const query = clean(form.query);
  if (query.length) url.query = query;
  const campos: { nome: string; valor: unknown }[] = [
    { nome: 'SOMENTEATUALIZARINTEGRACAOCORE', valor: sn(form.somenteAtualizarCore) },
    { nome: 'ID', valor: form.id.trim() },
    { nome: 'IDEMPRESAAPI', valor: form.empresaApi.trim() },
    { nome: 'SERVICO', valor: servico },
    {
      nome: 'LAYOUTCOMUNICACAO',
      valor: {
        name: form.nomeComunicacao.trim() || servico,
        request: { method: form.method, header: clean(form.headers), url },
        response: [],
      },
    },
    { nome: 'LAYOUTTRANSFORMACAO', valor: spec },
    { nome: 'ATIVO', valor: sn(form.ativo) },
    { nome: 'AUTENTICADOR', valor: sn(form.autenticador) },
    { nome: 'DATASINCRONISMO', valor: form.dataSincronismo },
    { nome: 'REFRESHTOKEN', valor: form.refreshToken },
    { nome: 'TIPOPROCESSO', valor: form.tipoProcesso },
    { nome: 'DISPONIVELURLROTAWTA', valor: sn(form.disponivelUrlWta) },
    ...form.extras,
  ];
  return { tabela: { nome: ROUTE_TABLE, campos } };
}

function asRows(v: unknown): KeyValue[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({ key: String(x.key ?? ''), value: String(x.value ?? '') }));
}

/**
 * Lê um registro existente (o arquivo de rotas do repositório de layouts) para preencher o formulário.
 * Devolve também a spec que estava em LAYOUTTRANSFORMACAO, para a pessoa comparar com a gerada.
 */
export function routeFormFromRecord(record: unknown): { ok: true; form: RouteForm; spec: unknown } | { ok: false; error: string } {
  const tabela = (record as { tabela?: { nome?: string; campos?: unknown } })?.tabela;
  const campos = Array.isArray(tabela?.campos) ? (tabela!.campos as { nome?: string; valor?: unknown }[]) : null;
  if (!campos) return { ok: false, error: 'Não é um registro de rota: falta "tabela.campos".' };
  const get = (nome: string) => campos.find((c) => String(c?.nome).toUpperCase() === nome)?.valor;
  const text = (nome: string) => {
    const v = get(nome);
    return v === undefined || v === null ? '' : String(v);
  };
  const flag = (nome: string, fallback: boolean) => {
    const v = text(nome).trim().toUpperCase();
    return v === '' ? fallback : v === 'S';
  };
  const com = (get('LAYOUTCOMUNICACAO') ?? {}) as { name?: string; request?: { method?: string; header?: unknown; url?: { raw?: string; query?: unknown } | string } };
  const req = com.request ?? {};
  const url = typeof req.url === 'string' ? { raw: req.url } : req.url ?? {};
  let spec = get('LAYOUTTRANSFORMACAO');
  if (typeof spec === 'string') {
    try {
      spec = JSON.parse(spec);
    } catch {
      /* mantém o texto */
    }
  }
  const form: RouteForm = {
    id: text('ID'),
    servico: text('SERVICO'),
    empresaApi: text('IDEMPRESAAPI'),
    tipoProcesso: text('TIPOPROCESSO') || 'BUSCAR',
    nomeComunicacao: com.name ?? '',
    method: req.method ?? 'GET',
    url: url.raw ?? '',
    headers: asRows(req.header),
    query: asRows(url.query),
    ativo: flag('ATIVO', true),
    autenticador: flag('AUTENTICADOR', false),
    disponivelUrlWta: flag('DISPONIVELURLROTAWTA', true),
    somenteAtualizarCore: flag('SOMENTEATUALIZARINTEGRACAOCORE', false),
    dataSincronismo: text('DATASINCRONISMO'),
    refreshToken: text('REFRESHTOKEN'),
    extras: campos
      .filter((c) => !KNOWN.has(String(c?.nome).toUpperCase()))
      .map((c) => ({ nome: String(c.nome), valor: c.valor })),
  };
  return { ok: true, form, spec };
}

/** Variáveis {{NOME}} usadas no registro: quem roda a rota precisa preenchê-las. */
export function routeVariables(record: unknown): string[] {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string') {
      for (const m of v.matchAll(/\{\{([A-Za-z0-9_]+)\}\}/g)) found.add(m[1]);
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach(walk);
    }
  };
  walk(record);
  return [...found].sort();
}

/** O que falta para o registro ser publicável. */
export function routeProblems(form: RouteForm): string[] {
  const out: string[] = [];
  if (!form.id.trim()) out.push('Informe o ID do serviço.');
  if (!form.empresaApi.trim()) out.push('Informe a empresa da API.');
  if (!form.url.trim() || form.url.trim() === '{{URL_BASE}}/') out.push('Informe a URL da requisição.');
  return out;
}
