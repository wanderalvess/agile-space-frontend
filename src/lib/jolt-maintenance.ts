/**
 * Manutenção de layouts Jolt que JÁ EXISTEM: acrescentar um campo, trocar o destino de um campo,
 * remover um campo — sem regerar a spec do zero e sem encostar nas outras operações (modify,
 * default, remove...). Tudo aqui é função pura sobre JSON; a tela só chama e mostra.
 *
 * Só a operação `shift` é editada. O resto da spec volta exatamente como entrou.
 */

type Json = any;

// ───────────────────────────────────────────────────────────── layout (envelope)

export interface LayoutParts {
  /** Array de operações Jolt (a LAYOUTTRANSFORMACAO, ou o próprio array colado). */
  spec: Json[];
  /** 'envelope' = layout completo com `tabela.campos`; 'array' = só as operações. */
  kind: 'array' | 'envelope';
  /** Devolve o documento original com a spec nova no lugar (o resto do layout fica intacto). */
  rebuild: (newSpec: Json[]) => Json;
}

export type ParseLayoutResult = { ok: true; parts: LayoutParts } | { ok: false; error: string };

/** Entende o que está no editor: array de operações ou layout completo (PCINTEGRACAOROTASERVICO). */
export function parseLayoutText(text: string): ParseLayoutResult {
  let data: Json;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'A spec não é um JSON válido. Corrija o erro de sintaxe antes de usar a manutenção.' };
  }
  return parseLayoutData(data);
}

export function parseLayoutData(data: Json): ParseLayoutResult {
  if (Array.isArray(data)) {
    return { ok: true, parts: { spec: data, kind: 'array', rebuild: s => s } };
  }
  if (data && typeof data === 'object' && typeof data.operation === 'string') {
    return { ok: true, parts: { spec: [data], kind: 'array', rebuild: s => s } };
  }
  const campos = data?.tabela?.campos;
  if (Array.isArray(campos)) {
    const idx = campos.findIndex((c: Json) => c?.nome === 'LAYOUTTRANSFORMACAO');
    if (idx < 0) return { ok: false, error: 'Este layout não tem o campo LAYOUTTRANSFORMACAO.' };
    const valor = campos[idx].valor;
    const valorWasString = typeof valor === 'string';
    let spec: Json;
    try {
      spec = valorWasString ? JSON.parse(valor) : valor;
    } catch {
      return { ok: false, error: 'O campo LAYOUTTRANSFORMACAO do layout não é um JSON válido.' };
    }
    if (!Array.isArray(spec)) return { ok: false, error: 'O campo LAYOUTTRANSFORMACAO precisa ser uma lista de operações Jolt.' };
    return {
      ok: true,
      parts: {
        spec,
        kind: 'envelope',
        rebuild: newSpec => {
          const copy = clone(data);
          copy.tabela.campos[idx].valor = valorWasString ? JSON.stringify(newSpec) : newSpec;
          return copy;
        },
      },
    };
  }
  return { ok: false, error: 'Formato não reconhecido. Cole uma lista de operações Jolt ou um layout com tabela.campos.' };
}

// ─────────────────────────────────────────────────────────────────── chaves da spec

const SPECIAL_START = /^[#@$]/;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

/** `\*` → `*`. Chaves da spec escapam caracteres especiais com barra invertida. */
function unescapeKey(k: string): string {
  return k.replace(/\\(.)/g, '$1');
}

/** Escapa o nome de um campo da entrada para virar chave de spec. */
export function escapeSpecKey(k: string): string {
  return k.replace(/[\\*|&@$#[\]]/g, m => '\\' + m);
}

function splitAlternatives(specKey: string): string[] {
  const parts: string[] = [];
  let cur = '';
  for (let i = 0; i < specKey.length; i++) {
    const ch = specKey[i];
    if (ch === '\\' && i + 1 < specKey.length) {
      cur += ch + specKey[++i];
    } else if (ch === '|') {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts;
}

function globToRegex(pattern: string): RegExp {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\' && i + 1 < pattern.length) {
      re += pattern[++i].replace(/[.+?^${}()|[\]\\*]/g, '\\$&');
    } else if (ch === '*') {
      re += '.*';
    } else {
      re += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp('^' + re + '$');
}

function isSpecialKey(k: string): boolean {
  return SPECIAL_START.test(k);
}

/**
 * Escolhe a entrada da spec que atende uma chave da entrada, na mesma precedência do Jolt:
 * chave exata > padrão com coringa (RCA-*) > `*` sozinho. Só UMA entrada atende cada chave.
 */
export function bestMatchingEntry(entries: [string, Json][], key: string): [string, Json] | undefined {
  const candidates = entries.filter(([k]) => !isSpecialKey(k));
  const exact = candidates.find(([k]) =>
    splitAlternatives(k).some(alt => !alt.includes('*') && unescapeKey(alt) === key)
  );
  if (exact) return exact;
  const pattern = candidates.find(([k]) =>
    splitAlternatives(k).some(alt => alt !== '*' && /(^|[^\\])\*/.test(alt) && globToRegex(alt).test(key))
  );
  if (pattern) return pattern;
  return candidates.find(([k]) => splitAlternatives(k).includes('*'));
}

function isObject(v: Json): v is Record<string, Json> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isShift(op: Json): boolean {
  return isObject(op) && op.operation === 'shift' && isObject(op.spec);
}

// ──────────────────────────────────────────────────────────────── mapeamentos existentes

export interface ShiftMapping {
  /** Estável enquanto a spec não muda de estrutura. */
  id: string;
  opIndex: number;
  /** Caminho de chaves dentro de `op.spec` até o destino. */
  specPath: string[];
  /** Lado da entrada, legível: `items.*.name`. */
  source: string;
  /** Um ou mais destinos (o Jolt aceita lista). */
  targets: string[];
  /** Passa por `#`, `@` ou `$` (literal, valor, chave): é condicional, o destino não é só "campo → campo". */
  conditional: boolean;
}

function mappingId(opIndex: number, specPath: string[]) {
  return `${opIndex}:${specPath.join('\u0001')}`;
}

/** Lista todos os pares "campo da entrada → destino" das operações shift. */
export function listShiftMappings(spec: Json[]): ShiftMapping[] {
  const out: ShiftMapping[] = [];
  spec.forEach((op, opIndex) => {
    if (!isShift(op)) return;
    const walk = (node: Json, path: string[]) => {
      if (typeof node === 'string' || (Array.isArray(node) && node.every(t => typeof t === 'string'))) {
        if (path.length === 0) return;
        out.push({
          id: mappingId(opIndex, path),
          opIndex,
          specPath: path,
          source: path.map(unescapeKey).join('.'),
          targets: Array.isArray(node) ? node : [node],
          conditional: path.some(isSpecialKey),
        });
        return;
      }
      if (isObject(node)) {
        for (const [k, v] of Object.entries(node)) walk(v, [...path, k]);
      }
    };
    walk(op.spec, []);
  });
  return out;
}

// ─────────────────────────────────────────────────────────────── campos da entrada

export interface InputField {
  /** Chaves até o campo; posições de array viram `*`. */
  path: string[];
  label: string;
  example?: Json;
}

const MAX_FIELDS = 3000;

/** Todos os campos "folha" do JSON de entrada, juntando os elementos de listas. */
export function listInputFields(input: Json): InputField[] {
  const seen = new Map<string, InputField>();
  const walk = (node: Json, path: string[]) => {
    if (seen.size >= MAX_FIELDS) return;
    if (Array.isArray(node)) {
      const objects = node.filter(isObject);
      if (objects.length > 0) {
        objects.forEach(o => walk(o, [...path, '*']));
        return;
      }
      if (path.length > 0) record(path, node);
      return;
    }
    if (isObject(node)) {
      const keys = Object.keys(node);
      if (keys.length === 0 && path.length > 0) return record(path, node);
      keys.forEach(k => walk(node[k], [...path, k]));
      return;
    }
    if (path.length > 0) record(path, node);
  };
  const record = (path: string[], value: Json) => {
    const label = path.join('.');
    const prev = seen.get(label);
    // Prefere um exemplo preenchido ao primeiro null que aparecer.
    if (!prev || (prev.example == null && value != null)) seen.set(label, { path, label, example: value });
  };
  walk(input, []);
  return [...seen.values()];
}

/** Segue o caminho de um campo da entrada dentro de uma spec shift, como o Jolt faria. */
function walkShift(node: Json, keys: string[]): Json | undefined {
  if (keys.length === 0) return node;
  if (!isObject(node)) return undefined;
  const entry = bestMatchingEntry(Object.entries(node), keys[0] === '*' ? '0' : keys[0]);
  if (!entry) return undefined;
  return walkShift(entry[1], keys.slice(1));
}

export type FieldUsage = 'mapped' | 'indirect' | 'unused';

export interface ClassifiedField extends InputField {
  usage: FieldUsage;
  /** Para `mapped`: destinos atuais. */
  targets?: string[];
}

function wordRegex(name: string) {
  return new RegExp('(?<![\\w$])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w$])');
}

/**
 * Diz o que a spec faz com cada campo da entrada:
 * - mapped: tem destino em alguma shift;
 * - indirect: não vai direto para a saída, mas é citado em outra operação (ex.: `@(1,cpf)` num modify);
 * - unused: ninguém usa — candidato a campo novo.
 */
export function classifyInputFields(input: Json, spec: Json[]): ClassifiedField[] {
  const shifts = spec.filter(isShift);
  const mentions = JSON.stringify(spec);
  return listInputFields(input).map(f => {
    for (const op of shifts) {
      const node = walkShift(op.spec, f.path);
      if (node !== undefined && (typeof node === 'string' || Array.isArray(node) || (isObject(node) && Object.keys(node).length > 0))) {
        const targets = typeof node === 'string' ? [node] : Array.isArray(node) ? node.filter((t: Json) => typeof t === 'string') : undefined;
        return { ...f, usage: 'mapped' as const, targets };
      }
    }
    const last = f.path[f.path.length - 1];
    if (last !== '*' && wordRegex(last).test(mentions)) return { ...f, usage: 'indirect' as const };
    return { ...f, usage: 'unused' as const };
  });
}

// ─────────────────────────────────────────────────────────────────────── edição

export type EditResult =
  | { ok: true; spec: Json[]; summary: string }
  | { ok: false; reason: string };

/** Container (objeto da spec) onde um campo da entrada deveria ficar, se o caminho já existir. */
function findContainer(opSpec: Json, parentPath: string[]): Record<string, Json> | undefined {
  const node = walkShift(opSpec, parentPath);
  return isObject(node) ? node : undefined;
}

/** Prefixo de destino mais usado entre os vizinhos do container (`items.[&1].`). */
function siblingTargetPrefix(container: Record<string, Json>): string {
  const counts = new Map<string, number>();
  for (const [k, v] of Object.entries(container)) {
    if (isSpecialKey(k)) continue;
    const targets = typeof v === 'string' ? [v] : Array.isArray(v) ? v.filter((t: Json) => typeof t === 'string') : [];
    for (const t of targets) {
      const dot = t.lastIndexOf('.');
      if (dot < 0) continue;
      const prefix = t.slice(0, dot + 1);
      counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
    }
  }
  let best = '';
  let bestCount = 0;
  counts.forEach((c, p) => {
    if (c > bestCount) {
      best = p;
      bestCount = c;
    }
  });
  return best;
}

/** `vencimentoDias` vira `items.[&1].vencimentoDias` quando os vizinhos usam esse padrão; caminho completo fica como veio. */
export function resolveTarget(container: Record<string, Json> | undefined, typed: string): string {
  const t = typed.trim();
  if (/[.[&]/.test(t)) return t;
  return (container ? siblingTargetPrefix(container) : '') + t;
}

function ensureContainer(opSpec: Record<string, Json>, parentPath: string[]): Record<string, Json> | undefined {
  let node: Record<string, Json> = opSpec;
  for (const key of parentPath) {
    const entry = bestMatchingEntry(Object.entries(node), key === '*' ? '0' : key);
    if (entry) {
      if (!isObject(entry[1])) return undefined;
      node = entry[1];
    } else {
      const created: Record<string, Json> = {};
      node[key === '*' ? '*' : escapeSpecKey(key)] = created;
      node = created;
    }
  }
  return node;
}

/**
 * Acrescenta "campo da entrada → destino" na primeira shift que já conhece o caminho do campo.
 * Se nenhuma conhece, cria o caminho na primeira shift. Não mexe em nenhuma outra operação.
 */
export function addShiftMapping(spec: Json[], inputPath: string[], target: string): EditResult {
  if (inputPath.length === 0) return { ok: false, reason: 'Escolha o campo da entrada.' };
  if (!target.trim()) return { ok: false, reason: 'Informe o nome do campo na saída.' };
  const shiftIdx = spec.map((op, i) => (isShift(op) ? i : -1)).filter(i => i >= 0);
  if (shiftIdx.length === 0) {
    return { ok: false, reason: 'Este layout não tem uma operação shift. Insira uma pelo menu Modelos e tente de novo.' };
  }

  const next = clone(spec);
  const parentPath = inputPath.slice(0, -1);
  const leaf = inputPath[inputPath.length - 1];
  const leafKey = escapeSpecKey(leaf);

  let opIndex = shiftIdx.find(i => findContainer(next[i].spec, parentPath));
  let container: Record<string, Json> | undefined;
  if (opIndex !== undefined) {
    container = findContainer(next[opIndex].spec, parentPath);
  } else {
    opIndex = shiftIdx[0];
    container = ensureContainer(next[opIndex].spec, parentPath);
  }
  if (!container || opIndex === undefined) {
    return { ok: false, reason: 'A estrutura da shift não permite acrescentar esse campo automaticamente. Edite a spec à mão.' };
  }

  if (Object.prototype.hasOwnProperty.call(container, leafKey)) {
    const current = container[leafKey];
    const shown = typeof current === 'string' ? `"${current}"` : 'um mapeamento condicional';
    return { ok: false, reason: `O campo "${leaf}" já está mapeado para ${shown}. Mude o destino na lista de mapeamentos.` };
  }
  // Já coberto por uma chave com coringa/pipe? Acrescentar uma chave exata antes dela mudaria o que ela faz hoje.
  const covering = bestMatchingEntry(Object.entries(container), leaf);
  if (covering && covering[0] !== '*') {
    return { ok: false, reason: `O campo "${leaf}" já é tratado pela chave "${covering[0]}". Edite essa chave.` };
  }

  const resolved = resolveTarget(container, target);
  container[leafKey] = resolved;
  return {
    ok: true,
    spec: next,
    summary: `"${leafKey}": "${resolved}"  (shift ${opIndex + 1}${parentPath.length ? ', em ' + parentPath.join('.') : ''})`,
  };
}

function getAt(root: Json, path: string[]): { parent: Record<string, Json>; key: string } | undefined {
  if (path.length === 0) return undefined;
  let node = root;
  for (const k of path.slice(0, -1)) {
    if (!isObject(node) || !(k in node)) return undefined;
    node = node[k];
  }
  const key = path[path.length - 1];
  if (!isObject(node) || !(key in node)) return undefined;
  return { parent: node, key };
}

/** Troca o(s) destino(s) de um mapeamento existente. */
export function updateMappingTargets(spec: Json[], mapping: Pick<ShiftMapping, 'opIndex' | 'specPath'>, targets: string[]): EditResult {
  const clean = targets.map(t => t.trim()).filter(Boolean);
  if (clean.length === 0) return { ok: false, reason: 'Informe o destino do campo.' };
  const next = clone(spec);
  const op = next[mapping.opIndex];
  if (!isShift(op)) return { ok: false, reason: 'A operação deste mapeamento não existe mais. Recarregue a lista.' };
  const at = getAt(op.spec, mapping.specPath);
  if (!at) return { ok: false, reason: 'Este mapeamento não existe mais na spec. Recarregue a lista.' };
  at.parent[at.key] = clean.length === 1 ? clean[0] : clean;
  return { ok: true, spec: next, summary: `"${mapping.specPath.join('.')}" agora vai para ${clean.map(t => `"${t}"`).join(', ')}` };
}

/** Remove o mapeamento e limpa os objetos que ficaram vazios acima dele. */
export function removeMapping(spec: Json[], mapping: Pick<ShiftMapping, 'opIndex' | 'specPath'>): EditResult {
  const next = clone(spec);
  const op = next[mapping.opIndex];
  if (!isShift(op)) return { ok: false, reason: 'A operação deste mapeamento não existe mais. Recarregue a lista.' };
  const chain: Record<string, Json>[] = [op.spec];
  let node: Json = op.spec;
  for (const k of mapping.specPath.slice(0, -1)) {
    if (!isObject(node) || !(k in node)) return { ok: false, reason: 'Este mapeamento não existe mais na spec. Recarregue a lista.' };
    node = node[k];
    chain.push(node);
  }
  const last = mapping.specPath[mapping.specPath.length - 1];
  if (!isObject(node) || !(last in node)) return { ok: false, reason: 'Este mapeamento não existe mais na spec. Recarregue a lista.' };
  delete node[last];
  for (let i = chain.length - 1; i > 0; i--) {
    if (Object.keys(chain[i]).length === 0) delete chain[i - 1][mapping.specPath[i - 1]];
    else break;
  }
  return { ok: true, spec: next, summary: `Removido o mapeamento de "${mapping.specPath.map(unescapeKey).join('.')}"` };
}

// ──────────────────────────────────────────────────────── mapeador visual (modo manutenção)
//
// O mapeador desenha campos como caminhos (`items[*].name`) e liga um ao outro. A spec guarda o
// mesmo par como chave + destino (`items` › `*` › `name` → `items.[&1].nome`). Aqui ficam as
// conversões entre os dois mundos e a aplicação das mudanças feitas no mapa sobre a spec existente.

/** `items[*].name` → `['items', '*', 'name']`. */
export function nodePathToKeys(nodePath: string): string[] {
  const keys: string[] = [];
  for (const seg of nodePath.split('.')) {
    const m = seg.match(/^(.*?)((?:\[\*\])+)$/);
    if (m) {
      if (m[1]) keys.push(m[1]);
      for (let i = 0; i < m[2].length / 3; i++) keys.push('*');
    } else {
      keys.push(seg);
    }
  }
  return keys;
}

/** `['items', '*', 'name']` → `items[*].name`. */
export function keysToNodePath(keys: string[]): string {
  let out = '';
  for (const k of keys) out += k === '*' ? '[*]' : (out ? '.' : '') + k;
  return out;
}

/** Destino da spec → caminho do mapa. `items.[&1].nome` → `items[*].nome`; `lista[]` → `lista[*]`. Null se for avançado (`@`, `$`, `#`...). */
export function targetStringToNodePath(target: string): string | null {
  if (/[@$#]|&(?!\d)/.test(target.replace(/\[&\d+\]/g, ''))) return null;
  let out = '';
  for (const seg of target.split('.')) {
    if (/^\[&\d+\]$/.test(seg)) out += '[*]';
    else if (/^.+\[\]$/.test(seg)) out += (out ? '.' : '') + seg.slice(0, -2) + '[*]';
    else if (seg.includes('&')) return null;
    else out += (out ? '.' : '') + seg;
  }
  return out || null;
}

/**
 * Caminho do mapa → destino da spec, usando a posição dos `*` do campo de origem para saber
 * quantos níveis acima fica cada índice (`items[*].x` → `items.[&1].x`). Null se não der para inferir.
 */
export function nodePathToTargetString(nodePath: string, sourceKeys: string[]): string | null {
  const tKeys = nodePathToKeys(nodePath);
  const wildcardsAtSource = sourceKeys.map((k, i) => (k === '*' ? i : -1)).filter(i => i >= 0);
  const tWild = tKeys.filter(k => k === '*').length;
  if (tWild === 0) return nodePath;
  if (tWild !== wildcardsAtSource.length) return null;
  const lastSource = sourceKeys.length - 1;
  let w = 0;
  const parts: string[] = [];
  tKeys.forEach((k, i) => {
    if (k !== '*') return void parts.push(k);
    const levelsUp = lastSource - wildcardsAtSource[w++];
    // Lista de valores soltos (`ids[*]`): o destino é `ids[]`, sem índice.
    if (i === tKeys.length - 1) parts[parts.length - 1] += '[]';
    else parts.push(`[&${levelsUp}]`);
  });
  return parts.join('.');
}

export interface ExistingEdge {
  mappingId: string;
  opIndex: number;
  specPath: string[];
  /** Caminho do campo de origem no mapa. */
  source: string;
  /** Caminho do campo de saída no mapa. */
  target: string;
}

export interface LayoutOnCanvas {
  /** Mapeamentos simples, que viram uma ligação no mapa. */
  edges: ExistingEdge[];
  /** Condicionais, com várias saídas ou com expressão: continuam na spec, mas não dão para desenhar. */
  advanced: ShiftMapping[];
  /** Simples, mas o campo de origem não existe no JSON de entrada atual. */
  orphans: ShiftMapping[];
}

/** Separa o que o mapa consegue desenhar do que só a spec sabe representar. */
export function layoutToCanvas(spec: Json[], inputNodePaths: Set<string>): LayoutOnCanvas {
  const edges: ExistingEdge[] = [];
  const advanced: ShiftMapping[] = [];
  const orphans: ShiftMapping[] = [];
  for (const m of listShiftMappings(spec)) {
    if (m.conditional || m.targets.length !== 1) {
      advanced.push(m);
      continue;
    }
    const target = targetStringToNodePath(m.targets[0]);
    if (!target) {
      advanced.push(m);
      continue;
    }
    const source = keysToNodePath(m.specPath.map(unescapeKey));
    if (!inputNodePaths.has(source)) {
      orphans.push(m);
      continue;
    }
    edges.push({ mappingId: m.id, opIndex: m.opIndex, specPath: m.specPath, source, target });
  }
  return { edges, advanced, orphans };
}

/** JSON de exemplo com os campos de saída do layout, para o mapa mostrar os nós de destino. */
export function buildJsonFromNodePaths(paths: string[]): Json {
  const root: Record<string, Json> = {};
  for (const p of paths) {
    const keys = nodePathToKeys(p);
    let node: Json = root;
    keys.forEach((k, i) => {
      const next = keys[i + 1];
      if (k === '*') return;
      const isLast = i === keys.length - 1;
      if (next === '*') {
        const afterStar = keys[i + 2];
        if (afterStar === undefined) {
          if (!Array.isArray(node[k])) node[k] = [];
        } else {
          if (!Array.isArray(node[k])) node[k] = [{}];
          // desce para o objeto da lista
          node = node[k][0];
        }
      } else if (isLast) {
        node[k] = '';
      } else {
        if (!isObject(node[k])) node[k] = {};
        node = node[k];
      }
    });
  }
  return root;
}

export interface MapperChangeResult {
  spec: Json[];
  added: string[];
  removed: string[];
  errors: string[];
}

/**
 * Aplica sobre a spec existente só o que mudou no mapa: ligações novas entram na shift, ligações
 * que existiam e foram apagadas saem. Todo o resto da spec (modify, default, condicionais) fica igual.
 */
export function applyMapperChanges(
  spec: Json[],
  base: ExistingEdge[],
  current: { source: string; target: string }[]
): MapperChangeResult {
  const key = (s: string, t: string) => `${s}\u0001${t}`;
  const currentKeys = new Set(current.map(e => key(e.source, e.target)));
  const baseKeys = new Set(base.map(e => key(e.source, e.target)));
  const removedEdges = base.filter(b => !currentKeys.has(key(b.source, b.target)));
  const addedEdges = current.filter(c => !baseKeys.has(key(c.source, c.target)));

  let next = spec;
  const out: MapperChangeResult = { spec, added: [], removed: [], errors: [] };

  for (const r of removedEdges) {
    const res = removeMapping(next, r);
    if (res.ok) {
      next = res.spec;
      out.removed.push(`${r.source} → ${r.target}`);
    } else {
      out.errors.push(`${r.source}: ${res.reason}`);
    }
  }
  for (const a of addedEdges) {
    const srcKeys = nodePathToKeys(a.source);
    const target = nodePathToTargetString(a.target, srcKeys);
    if (!target) {
      out.errors.push(`${a.source} → ${a.target}: não foi possível montar o destino sozinho (a quantidade de listas não bate com a da origem). Use a Manutenção na Sandbox para esse campo.`);
      continue;
    }
    const res = addShiftMapping(next, srcKeys, target);
    if (res.ok) {
      next = res.spec;
      out.added.push(`${a.source} → ${a.target}`);
    } else {
      out.errors.push(`${a.source}: ${res.reason}`);
    }
  }
  out.spec = next;
  return out;
}
