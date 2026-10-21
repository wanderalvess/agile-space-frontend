import { authFetch } from '@/lib/auth-client';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SPRING_API_URL || 'http://localhost:8002/api';

export type RuleKind = 'COPY' | 'AS_TEXT' | 'AS_NUMBER' | 'DIGITS' | 'CONCAT' | 'VALUE_MAP' | 'CONSTANT' | 'VARIABLE' | 'LIST' | 'UNRESOLVED';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

/** Regra inferida pelo backend (POST /api/jolt/generate). `scope`: "" = raiz, "items[]", "items[].produtoEmbalagens[]". */
export interface GeneratorRule {
  output: string;
  scope: string;
  kind: RuleKind;
  source: string | null;
  confidence: Confidence;
  pending: boolean;
  reason: string;
  alternatives: string[];
  example: string | null;
}

export interface GeneratorDifference {
  path: string;
  kind: string;
  expected: unknown;
  actual: unknown;
}

export interface GeneratorResult {
  spec: unknown[];
  rules: GeneratorRule[];
  pending: number;
  sources: Record<string, string[]>;
  /** VALORES: a saída traz os valores do registro; CONTRATO: valores genéricos ("string", 0), regras pelo nome. */
  mode: 'VALORES' | 'CONTRATO';
  validation: { ran: boolean; matches: boolean; error: string | null; differences: GeneratorDifference[]; checkedFields: number };
}

/** Escolha da pessoa para um campo, no formato do backend (JoltSpecGenerator.Override). */
export interface GeneratorOverride {
  kind: 'COPY' | 'AS_TEXT' | 'AS_NUMBER' | 'DIGITS' | 'VALUE_MAP' | 'CONSTANT';
  source?: string;
  value?: unknown;
  map?: Record<string, unknown>;
  otherwise?: unknown;
}

/** Rascunho do que a pessoa está editando na tela (texto livre; vira GeneratorOverride ao aplicar). */
export interface RuleDraft {
  kind: GeneratorOverride['kind'];
  source: string;
  value: string;
  map: { from: string; to: string }[];
  otherwise: string;
}

export const KIND_LABEL: Record<RuleKind, string> = {
  COPY: 'Copiar',
  AS_TEXT: 'Como texto',
  AS_NUMBER: 'Como número',
  DIGITS: 'Só dígitos',
  CONCAT: 'Concatenar',
  VALUE_MAP: 'De-para',
  CONSTANT: 'Fixo',
  VARIABLE: 'Variável da rota',
  LIST: 'Lista',
  UNRESOLVED: 'Sem origem',
};

/** Tipos que a pessoa pode escolher ao ajustar um campo. */
export const EDITABLE_KINDS: GeneratorOverride['kind'][] = ['COPY', 'AS_TEXT', 'AS_NUMBER', 'DIGITS', 'VALUE_MAP', 'CONSTANT'];

export async function generateSpec(
  input: unknown,
  output: unknown,
  overrides: Record<string, GeneratorOverride> = {},
  /** Grava no glossário da equipe as origens escolhidas, se a spec cumprir a saída (só no "Gerar spec" final). */
  learn = false,
): Promise<GeneratorResult> {
  const res = await authFetch(`${API_BASE_URL}/jolt/generate`, {
    method: 'POST',
    body: JSON.stringify({ input, output, overrides, learn }),
  });
  if (!res.ok) {
    let message = 'Não foi possível gerar a spec.';
    try {
      const body = await res.json();
      message = body?.message || body?.error || message;
    } catch {
      /* corpo sem JSON */
    }
    throw new Error(message);
  }
  return res.json();
}

/** Nome do campo dentro da lista ("items[].produtoEmbalagens[].codigoBarras" → "codigoBarras"). */
export function fieldName(rule: Pick<GeneratorRule, 'output' | 'scope'>): string {
  if (rule.scope && rule.output.startsWith(rule.scope + '.')) return rule.output.slice(rule.scope.length + 1);
  return rule.output;
}

export function scopeLabel(scope: string): string {
  return scope ? `Cada item de ${scope}` : 'Raiz do resultado';
}

/** Pendentes primeiro; o resto agrupado pela lista da saída, na ordem em que aparece. */
export function groupRules(rules: GeneratorRule[]): { pending: GeneratorRule[]; groups: { scope: string; rules: GeneratorRule[] }[] } {
  const pending = rules.filter((r) => r.pending);
  const groups: { scope: string; rules: GeneratorRule[] }[] = [];
  for (const r of rules) {
    if (r.pending) continue;
    let g = groups.find((x) => x.scope === r.scope);
    if (!g) {
      g = { scope: r.scope, rules: [] };
      groups.push(g);
    }
    g.rules.push(r);
  }
  groups.sort((a, b) => (a.scope === '' ? -1 : b.scope === '' ? 1 : a.scope.length - b.scope.length));
  return { pending, groups };
}

/** Valor do campo na saída de exemplo (primeiro item de cada lista), para saber o tipo esperado. */
export function exampleValue(output: unknown, path: string): unknown {
  let cur: unknown = output;
  for (const raw of path.split('.')) {
    const isList = raw.endsWith('[]');
    const key = isList ? raw.slice(0, -2) : raw;
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
    if (isList) cur = Array.isArray(cur) ? cur[0] : undefined;
  }
  return cur;
}

/** Converte o texto digitado no tipo do exemplo: número fica número, true/false fica booleano, o resto é texto. */
export function coerceLike(text: string, example: unknown): unknown {
  if (typeof example === 'number') {
    const n = Number(text.replace(',', '.'));
    return Number.isFinite(n) && text.trim() !== '' ? n : text;
  }
  if (typeof example === 'boolean') {
    if (text.trim().toLowerCase() === 'true') return true;
    if (text.trim().toLowerCase() === 'false') return false;
  }
  return text;
}

/** Rascunho inicial a partir do que o gerador inferiu. */
export function draftFromRule(rule: GeneratorRule, output: unknown): RuleDraft {
  const editable = (EDITABLE_KINDS as string[]).includes(rule.kind);
  // Sem origem mas com candidatas (mesmo valor em mais de um campo): começa como cópia da primeira sugerida.
  const hasCandidates = rule.kind === 'UNRESOLVED' && rule.alternatives.length > 0;
  const kind = (editable ? rule.kind : rule.kind === 'CONCAT' || hasCandidates ? 'COPY' : 'CONSTANT') as GeneratorOverride['kind'];
  const example = exampleValue(output, rule.output);
  const map: { from: string; to: string }[] = [];
  if (rule.kind === 'VALUE_MAP' && rule.example) {
    for (const part of rule.example.split(', ')) {
      const [from, to] = part.split(' → ');
      if (from !== undefined && to !== undefined) map.push({ from, to: to.replace(/^"|"$/g, '') });
    }
  }
  return {
    kind,
    source: rule.source && !rule.source.includes(' + ') ? rule.source : hasCandidates ? rule.alternatives[0] : '',
    value: example === undefined || example === null ? '' : typeof example === 'string' ? example : JSON.stringify(example),
    map: map.length ? map : [{ from: '', to: '' }],
    otherwise: '',
  };
}

/** Rascunho → escolha no formato do backend. Devolve null quando falta o essencial (ex.: cópia sem origem). */
export function overrideFromDraft(draft: RuleDraft, example: unknown): GeneratorOverride | null {
  if (draft.kind === 'CONSTANT') return { kind: 'CONSTANT', value: coerceLike(draft.value, example) };
  if (!draft.source) return null;
  if (draft.kind !== 'VALUE_MAP') return { kind: draft.kind, source: draft.source };
  const map: Record<string, unknown> = {};
  for (const row of draft.map) {
    if (row.from.trim() === '') continue;
    map[row.from.trim()] = coerceLike(row.to, example);
  }
  if (Object.keys(map).length === 0) return null;
  const override: GeneratorOverride = { kind: 'VALUE_MAP', source: draft.source, map };
  if (draft.otherwise.trim() !== '') override.otherwise = coerceLike(draft.otherwise, example);
  return override;
}

/** Resumo de cada passo da spec, para a tela de validação. */
export function describeOperation(op: unknown, index: number, total: number): { name: string; what: string } {
  const name = (op as { operation?: string })?.operation ?? 'operação';
  if (name === 'shift') return { name, what: 'Leva cada campo da entrada para o lugar dele na saída, com os de-para.' };
  if (name === 'default') return { name, what: 'Valores fixos e variáveis da rota.' };
  if (name === 'modify-overwrite-beta') {
    return index === 0
      ? { name, what: 'Calcula os campos montados: concatenações, só dígitos, conversão para texto.' }
      : { name, what: index === total - 1 ? 'Ajustes finais.' : 'Converte o tipo de saída dos de-para (número, booleano).' };
  }
  return { name, what: '' };
}

/** Como o gerador leu a saída esperada (decidido pelo servidor, não escolhido na tela). */
export const MODE_INFO: Record<GeneratorResult['mode'], { label: string; short: string; long: string }> = {
  VALORES: {
    label: 'Valores',
    short: 'A saída traz os valores do mesmo registro da entrada.',
    long: 'A saída traz os valores do mesmo registro da entrada, então cada origem foi achada procurando o valor da saída dentro da entrada.',
  },
  CONTRATO: {
    label: 'Contrato',
    short: 'A saída é o exemplo do contrato do destino, com valores genéricos.',
    long: 'A saída é o exemplo do contrato do destino, com valores genéricos («string», 0, true). As origens foram sugeridas pelo nome do campo e as regras pelo tipo; a conferência vê campos e tipos, não valores.',
  },
};

/** Explicação antes de gerar: o servidor escolhe sozinho entre os dois jeitos de ler a saída. */
export const MODE_DETECTION_TEXT =
  'O portal decide sozinho como ler a saída. Se a maioria dos textos for genérica («string», 0, true), ela é tratada como contrato do destino: as origens vêm pelo nome do campo e pelo tipo. Se os valores forem os do mesmo registro da entrada, cada valor é procurado na entrada para achar a origem.';

function typeOf(v: unknown): string {
  if (v === null || v === undefined) return 'vazio';
  if (Array.isArray(v)) return 'lista';
  return typeof v;
}

/** Sugestão do que fazer diante de uma diferença da conferência. */
export function suggestFix(diff: GeneratorDifference): string {
  const kind = diff.kind;
  if (kind.startsWith('faltou')) return 'O campo não saiu na spec. Volte às regras e escolha de onde ele vem.';
  if (kind.startsWith('a mais')) return 'A spec gera um campo que a saída esperada não tem. Confira o nome do campo.';
  if (kind.startsWith('lista')) return 'A lista saiu com tamanho diferente. Confira de onde vem a lista.';
  const expected = typeOf(diff.expected);
  const actual = typeOf(diff.actual);
  if (expected !== actual) {
    if (expected === 'number') return 'Troque a regra para «Como número».';
    if (expected === 'string') return 'Troque a regra para «Como texto».';
    if (expected === 'boolean') return 'O valor precisa ser verdadeiro ou falso; confira a regra ou o de-para.';
  }
  if (kind.includes('contrato')) return 'Confira a regra e a origem deste campo.';
  return 'Confira a origem escolhida e a regra deste campo.';
}

/** Mostra um valor da conferência de forma curta e sem ambiguidade de tipo (`"1"` x `1`). */
export function describeValue(v: unknown): string {
  if (v === undefined) return '(ausente)';
  const s = JSON.stringify(v);
  return s.length > 60 ? s.slice(0, 59) + '…' : s;
}
