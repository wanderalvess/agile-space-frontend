// Geração e validação de JSON Schema (subset do draft-07) do DevTools.
// Movido de app/devtools/json-schema/page.tsx sem mudar o algoritmo.

export type Json = unknown;
export interface ValidationError { path: string; message: string }

// ---- Geração de schema a partir de um exemplo ---------------------------
// Todas as propriedades vistas viram "required"; arrays heterogêneos usam anyOf.
function typeOf(v: Json): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

export function inferSchema(v: Json): Record<string, unknown> {
  const t = typeOf(v);
  if (t === 'object') {
    const obj = v as Record<string, Json>;
    return { type: 'object', properties: Object.fromEntries(Object.entries(obj).map(([k, val]) => [k, inferSchema(val)])), required: Object.keys(obj) };
  }
  if (t === 'array') {
    const arr = v as Json[];
    if (arr.length === 0) return { type: 'array' };
    const distinct = new Set(arr.map(x => JSON.stringify(inferSchema(x))));
    const list = [...distinct].map(s => JSON.parse(s));
    return { type: 'array', items: list.length === 1 ? list[0] : { anyOf: list } };
  }
  return { type: t };
}

// ---- Validador (subset do draft-07) -------------------------------------
// O legado cobria type/enum/required/properties/items/min/max/pattern. Acrescentei:
// integer (o legado rejeitava), const, additionalProperties:false, anyOf/oneOf,
// uniqueItems, exclusiveMin/Max e multipleOf.
function matchesType(expected: string, data: Json): boolean {
  const actual = typeOf(data);
  return expected === actual || (expected === 'number' && actual === 'integer');
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function validate(schema: Json, data: Json, path = ''): ValidationError[] {
  if (!schema || typeof schema !== 'object') return [];
  const s = schema as Record<string, any>;
  const errors: ValidationError[] = [];
  const at = (msg: string, p = path) => errors.push({ path: p, message: msg });

  if (s.type) {
    const expected: string[] = Array.isArray(s.type) ? s.type : [s.type];
    if (!expected.some(t => matchesType(t, data))) {
      at(`Esperava tipo "${expected.join(' ou ')}", mas recebeu "${typeOf(data)}"`);
      return errors; // sem o tipo certo, o resto não faz sentido
    }
  }
  if (Array.isArray(s.enum) && !s.enum.some((e: Json) => JSON.stringify(e) === JSON.stringify(data))) {
    at(`Valor deve ser um de: ${JSON.stringify(s.enum)}`);
  }
  if ('const' in s && JSON.stringify(s.const) !== JSON.stringify(data)) at(`Valor deve ser igual a ${JSON.stringify(s.const)}`);

  if (Array.isArray(s.anyOf) && !s.anyOf.some((sub: Json) => validate(sub, data, path).length === 0)) at('Não atende a nenhuma das opções (anyOf)');
  if (Array.isArray(s.oneOf)) {
    const n = s.oneOf.filter((sub: Json) => validate(sub, data, path).length === 0).length;
    if (n !== 1) at(`Deve atender exatamente uma das opções (oneOf); atendeu ${n}`);
  }

  if (typeOf(data) === 'object') {
    const obj = data as Record<string, Json>;
    for (const req of Array.isArray(s.required) ? s.required : []) {
      if (!(req in obj)) at('Propriedade obrigatória ausente', path ? `${path}.${req}` : req);
    }
    const props = s.properties ?? {};
    for (const key of Object.keys(props)) {
      if (key in obj) errors.push(...validate(props[key], obj[key], path ? `${path}.${key}` : key));
    }
    if (s.additionalProperties === false) {
      for (const key of Object.keys(obj)) if (!(key in props)) at('Propriedade não permitida', path ? `${path}.${key}` : key);
    }
  }

  if (Array.isArray(data)) {
    if (s.items && !Array.isArray(s.items)) data.forEach((item, i) => errors.push(...validate(s.items, item, `${path}[${i}]`)));
    if (s.minItems !== undefined && data.length < s.minItems) at(`Deve conter no mínimo ${s.minItems} itens`);
    if (s.maxItems !== undefined && data.length > s.maxItems) at(`Deve conter no máximo ${s.maxItems} itens`);
    if (s.uniqueItems && new Set(data.map(d => JSON.stringify(d))).size !== data.length) at('Os itens devem ser únicos');
  }

  if (typeof data === 'string') {
    if (s.minLength !== undefined && data.length < s.minLength) at(`Comprimento mínimo de ${s.minLength} caracteres`);
    if (s.maxLength !== undefined && data.length > s.maxLength) at(`Comprimento máximo de ${s.maxLength} caracteres`);
    if (s.pattern) {
      try {
        if (!new RegExp(s.pattern).test(data)) at(`Valor não condiz com o padrão: ${s.pattern}`);
      } catch {
        at(`Padrão regex inválido no schema: ${s.pattern}`);
      }
    }
  }

  if (typeof data === 'number') {
    if (s.minimum !== undefined && data < s.minimum) at(`Deve ser maior ou igual a ${s.minimum}`);
    if (s.maximum !== undefined && data > s.maximum) at(`Deve ser menor ou igual a ${s.maximum}`);
    if (typeof s.exclusiveMinimum === 'number' && data <= s.exclusiveMinimum) at(`Deve ser maior que ${s.exclusiveMinimum}`);
    if (typeof s.exclusiveMaximum === 'number' && data >= s.exclusiveMaximum) at(`Deve ser menor que ${s.exclusiveMaximum}`);
    if (s.multipleOf && data % s.multipleOf !== 0) at(`Deve ser múltiplo de ${s.multipleOf}`);
  }
  return errors;
}

