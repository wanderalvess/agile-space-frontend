/**
 * @fileOverview Motor Jolt Lite Ultra-Resiliente.
 * Resolve corretamente referências profundas de contexto (@), hierarquia de índices ([&n]),
 * branching condicional LHS e construção inteligente de estruturas aninhadas.
 * Otimizado para decodificação UTF-8 e preservação de tipos de dados.
 */

export interface JoltResult {
  outputData: any;
  preProcessed: boolean;
}

/**
 * Realiza uma clonagem profunda para evitar circularidade e manter a integridade dos dados.
 */
function safeClone(obj: any) {
  if (obj === undefined) return undefined;
  if (obj === null || typeof obj !== 'object') return obj;
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    return Array.isArray(obj) ? [] : {};
  }
}

/**
 * Aplica uma cadeia de operações Jolt localmente.
 */
export function applyJoltLocal(input: any, spec: any[]): JoltResult {
  const originalInput = safeClone(input); // Salva o input original para o post-processor
  let data = safeClone(input);
  let preProcessed = false;

  if (!Array.isArray(spec)) return { outputData: data, preProcessed };

  // 1. Pré-processamento Base64 nativo dinâmico baseado em Spec (custom-decode ou custom-totvs)
  const base64Spec = spec.find(s => s && (s.operation === 'custom-decode' || s.operation === 'custom-totvs'));
  if (base64Spec && base64Spec.spec) {
    const { modifiedData, wasProcessed } = preProcessBase64(data, base64Spec.spec);
    data = modifiedData;
    preProcessed = wasProcessed;
  }

  // 2. Cadeia de Operações Jolt
  for (const operation of spec) {
    if (!operation || operation.operation === 'custom-decode' || operation.operation === 'custom-totvs') continue;
    try {
      const op = operation.operation;
      const s = operation.spec;

      if (op === 'modify-overwrite-beta' || op === 'modify-default-beta') {
        data = applyModify(data, s, op === 'modify-default-beta');
      } else if (op === 'shift') {
        data = applyShift(data, s);
      } else if (op === 'default') {
        data = applyDefault(data, s);
      } else if (op === 'remove') {
        data = applyRemove(data, s);
      } else if (op === 'cardinality') {
        data = applyCardinality(data, s);
      } else if (op === 'sort') {
        data = applySort(data);
      }
    } catch (e) {
      console.error(`Erro na operação [${operation.operation}]:`, e);
    }
  }

  // 3. Post-processing de funções residuais
  // Agora passa o originalInput para resolver campos que sumiram no shift
  data = evaluateJoltModifiers(data, originalInput);

  return { outputData: data, preProcessed };
}

/**
 * Função auxiliar para busca profunda de uma chave no objeto (Deep Search).
 */
function findDeepValue(obj: any, targetKey: string): any {
  if (obj === null || typeof obj !== 'object') return undefined;
  if (targetKey in obj) return obj[targetKey];
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const res = findDeepValue(item, targetKey);
      if (res !== undefined) return res;
    }
  } else {
    for (const k in obj) {
      const res = findDeepValue(obj[k], targetKey);
      if (res !== undefined) return res;
    }
  }
  return undefined;
}

/**
 * Decodificador Base64 ultra-resiliente para UTF-8.
 * Decodifica JSON se estruturado, texto decodificado se texto simples, ou fallback seguro.
 */
function decodeBase64Helper(b64: any): any {
  if (b64 === undefined || b64 === null) return b64;
  if (typeof b64 !== 'string') return b64;
  const str = b64.trim();
  if (!str) return b64;
  try {
    const binString = typeof window !== 'undefined' ? atob(str) : Buffer.from(str, 'base64').toString('binary');
    const bytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) bytes[i] = binString.charCodeAt(i);
    const decoded = new TextDecoder().decode(bytes);
    try {
      return JSON.parse(decoded);
    } catch {
      return decoded;
    }
  } catch {
    return b64;
  }
}

/**
 * Post-processador recursivo para avaliar expressões de modificação residuais.
 * Resolve =toString, =toInteger, =toDouble, =toBoolean e =base64ToObject.
 */
function evaluateJoltModifiers(data: any, originalInput: any): any {
  if (data === null || typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(item => evaluateJoltModifiers(item, originalInput));
  }

  for (const key in data) {
    const value = data[key];

    if (typeof value === 'string' && value.startsWith('=')) {
      // 1. =toString(@(X,campo)) ou =toString
      const toStringMatch = value.match(/^=toString(?:\(@\(\d+,([a-zA-Z0-9_]+)\)\))?$/);
      if (toStringMatch) {
        const targetField = toStringMatch[1];
        let val = targetField 
          ? (data[targetField] !== undefined ? data[targetField] : findDeepValue(originalInput, targetField))
          : (data[key] !== undefined ? data[key] : findDeepValue(originalInput, key));
        if (val !== undefined) {
          data[key] = String(val);
          continue;
        }
      }

      // 2. =toInteger(@(X,campo)) ou =toInteger
      const toIntegerMatch = value.match(/^=toInteger(?:\(@\(\d+,([a-zA-Z0-9_]+)\)\))?$/);
      if (toIntegerMatch) {
        const targetField = toIntegerMatch[1];
        let val = targetField 
          ? (data[targetField] !== undefined ? data[targetField] : findDeepValue(originalInput, targetField))
          : (data[key] !== undefined ? data[key] : findDeepValue(originalInput, key));
        if (val !== undefined) {
          const parsed = parseInt(String(val), 10);
          data[key] = isNaN(parsed) ? 0 : parsed;
          continue;
        }
      }

      // 3. =toDouble(@(X,campo)) ou =toDouble
      const toDoubleMatch = value.match(/^=toDouble(?:\(@\(\d+,([a-zA-Z0-9_]+)\)\))?$/);
      if (toDoubleMatch) {
        const targetField = toDoubleMatch[1];
        let val = targetField 
          ? (data[targetField] !== undefined ? data[targetField] : findDeepValue(originalInput, targetField))
          : (data[key] !== undefined ? data[key] : findDeepValue(originalInput, key));
        if (val !== undefined) {
          const parsed = parseFloat(String(val));
          data[key] = isNaN(parsed) ? 0.0 : parsed;
          continue;
        }
      }

      // 4. =toBoolean(@(X,campo)) ou =toBoolean
      const toBooleanMatch = value.match(/^=toBoolean(?:\(@\(\d+,([a-zA-Z0-9_]+)\)\))?$/);
      if (toBooleanMatch) {
        const targetField = toBooleanMatch[1];
        let val = targetField 
          ? (data[targetField] !== undefined ? data[targetField] : findDeepValue(originalInput, targetField))
          : (data[key] !== undefined ? data[key] : findDeepValue(originalInput, key));
        if (val !== undefined) {
          if (typeof val === 'boolean') data[key] = val;
          else {
            const str = String(val).toLowerCase().trim();
            data[key] = str === 'true' || str === '1' || str === 'sim' || str === 's' || str === 'yes';
          }
          continue;
        }
      }

      // 5. =base64ToObject(@(X,campo)) ou =base64ToObject
      const base64Match = value.match(/^=base64ToObject(?:\(@\(\d+,([a-zA-Z0-9_]+)\)\))?$/);
      if (base64Match) {
        const targetField = base64Match[1];
        let val = targetField 
          ? (data[targetField] !== undefined ? data[targetField] : findDeepValue(originalInput, targetField))
          : (data[key] !== undefined ? data[key] : findDeepValue(originalInput, key));
        if (val !== undefined) {
          data[key] = decodeBase64Helper(val);
          continue;
        }
      }
    } else if (value !== null && typeof value === 'object') {
      data[key] = evaluateJoltModifiers(value, originalInput);
    }
  }

  return data;
}

/**
 * Decodifica campos Base64 para objetos JSON conforme especificado no spec.
 * Suporta navegação em arrays via '*' e decodificação UTF-8 resiliente.
 */
function preProcessBase64(data: any, spec: any) {
  let wasProcessed = false;
  const clone = safeClone(data);

  const traverse = (currentData: any, currentSpec: any) => {
    if (!currentData || !currentSpec || typeof currentSpec !== 'object') return;
    for (const key in currentSpec) {
      const action = currentSpec[key];

      if (key === '*' || key === '[*]') {
        if (Array.isArray(currentData)) {
          currentData.forEach(item => traverse(item, action));
        } else if (typeof currentData === 'object') {
          Object.values(currentData).forEach(val => traverse(val, action));
        }
      } else if (typeof action === 'string' && action.startsWith('=base64ToObject')) {
        if (currentData[key] && typeof currentData[key] === 'string') {
          const decoded = decodeBase64Helper(currentData[key]);
          if (decoded !== currentData[key]) {
            currentData[key] = decoded;
            wasProcessed = true;
          }
        }
      } else if (typeof action === 'object') {
        if (currentData[key]) traverse(currentData[key], action);
      }
    }
  };

  traverse(clone, spec);
  return { modifiedData: clone, wasProcessed };
}

/**
 * Aplica operações de modificação (concat, split, doubleSum, etc).
 */
function applyModify(data: any, spec: any, isDefaultOnly: boolean) {
  const root = safeClone(data);
  
  const processNode = (obj: any, s: any, parents: any[]) => {
    if (!obj || !s) return;

    Object.entries(s).forEach(([key, value]) => {
      const isArrayKey = key.endsWith('[]');
      const cleanKey = isArrayKey ? key.replace('[]', '') : key;

      if (isArrayKey) {
        if (Array.isArray(obj[cleanKey])) {
          obj[cleanKey].forEach((item: any) => processNode(item, value, [obj, ...parents]));
        }
        return;
      }

      if (key === '*' || key === '[*]') {
        if (Array.isArray(obj)) {
          obj.forEach(item => processNode(item, value, [obj, ...parents]));
        } else if (typeof obj === 'object') {
          Object.values(obj).forEach(item => processNode(item, value, [obj, ...parents]));
        }
        return;
      }

      const processValue = (valToProcess: any): any => {
        if (typeof valToProcess === 'string') {
          // Normaliza @(1,&) substituindo o & pelo nome da chave corrente (cleanKey)
          const normalizedVal = valToProcess.replace(/@\(([^,]+),\s*&\)/g, `@($1,${cleanKey})`);
          if (normalizedVal.startsWith('=')) {
            return executeFunction(normalizedVal, obj[cleanKey], [obj, ...parents], root, cleanKey);
          } else if (normalizedVal.startsWith('@')) {
            return resolveValue(normalizedVal, obj[cleanKey], [obj, ...parents], cleanKey);
          }
        }
        return valToProcess;
      };

      if (Array.isArray(value)) {
        for (const item of value) {
          const resolved = processValue(item);
          if (resolved !== undefined && resolved !== null) {
            if (!isDefaultOnly || obj[cleanKey] === undefined) obj[cleanKey] = resolved;
            break;
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        if (!obj[cleanKey]) obj[cleanKey] = {};
        processNode(obj[cleanKey], value, [obj, ...parents]);
      } else {
        const resolved = processValue(value);
        if (resolved !== undefined) {
          if (!isDefaultOnly || obj[cleanKey] === undefined) obj[cleanKey] = resolved;
        }
      }
    });
  };

  processNode(root, spec, []);
  return root;
}

/**
 * Divide argumentos de funções Jolt respeitando parênteses aninhados e aspas simples.
 */
function splitArgs(str: string, separator: string = ',') {
  const result = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;
  let quoteChar = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if ((char === "'" || char === '"') && (i === 0 || str[i - 1] !== '\\')) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (quoteChar === char) {
        inQuotes = false;
        quoteChar = '';
      }
    }
    if (!inQuotes) {
      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (char === separator && depth === 0) {
        result.push(current.trim());
        current = '';
        continue;
      }
    }
    current += char;
  }
  result.push(current.trim());
  return result;
}

/**
 * Construtor resiliente de expressões regulares para a função =split do Jolt.
 * Converte notações Java/JOLT comuns (como \\D, \\., //., [-T], [./-]) para RegExp seguros em JS.
 */
function createSplitRegex(pattern: string): RegExp | string {
  if (!pattern) return '';
  let p = pattern;
  if (p === '//.' || p === '\\\\.' || p === '\\.') return /\./;
  if (p === '\\\\D' || p === '\\D') return /\D+/;
  if (p.startsWith('[') && p.endsWith(']')) {
    try {
      return new RegExp(p);
    } catch {
      return p;
    }
  }
  if (/[\\^$*+?.()|[\]{}]/.test(p)) {
    try {
      return new RegExp(p);
    } catch {
      return p;
    }
  }
  return p;
}

/**
 * Executa funções da especificação Modify (beta).
 * Suporta =concat, =size, =toInteger, =toDouble, =toString, =toBoolean, =toUpper, =toLower, =trim,
 * =firstElement, =lastElement, =toList, =doubleSum, =intSum, =longSum, =divide, =divideAndRound,
 * =multiply, =split, =join, =substring, =replace, =min, =max, =abs, =padLeft, =padRight, =base64ToObject.
 */
function executeFunction(funcStr: string, current: any, parents: any[], root: any, currentKey?: string): any {
  if (typeof funcStr !== 'string' || !funcStr.startsWith('=')) return funcStr;

  const evalArg = (arg: string): any => {
    const trimmed = arg.trim();
    if (trimmed.startsWith('=')) {
      return executeFunction(trimmed, current, parents, root, currentKey);
    }
    if (trimmed.startsWith('@')) {
      return resolveValue(trimmed, current, parents, currentKey);
    }
    if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      return trimmed.slice(1, -1);
    }
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    const num = Number(trimmed);
    if (!isNaN(num) && trimmed !== '') return num;
    return trimmed;
  };

  const match = funcStr.match(/^=([a-zA-Z0-9_]+)\((.*)\)$/);
  if (match) {
    const funcName = match[1];
    const argsString = match[2];
    const rawArgs = splitArgs(argsString, ',');
    const args = rawArgs.map(evalArg);

    switch (funcName) {
      case 'concat':
        return args.map(a => a !== undefined && a !== null ? String(a) : '').join('');
      case 'size': {
        const val = args.length > 0 ? args[0] : current;
        if (val === undefined || val === null) return 0;
        if (Array.isArray(val) || typeof val === 'string') return val.length;
        if (typeof val === 'object') return Object.keys(val).length;
        return 1;
      }
      case 'toInteger': {
        const val = args.length > 0 ? args[0] : current;
        if (val === undefined || val === null || val === '') return undefined;
        const parsed = parseInt(String(val), 10);
        return isNaN(parsed) ? undefined : parsed;
      }
      case 'toDouble': {
        const val = args.length > 0 ? args[0] : current;
        if (val === undefined || val === null || val === '') return undefined;
        const parsed = parseFloat(String(val));
        return isNaN(parsed) ? undefined : parsed;
      }
      case 'toString': {
        const val = args.length > 0 ? args[0] : current;
        return val !== undefined && val !== null ? String(val) : '';
      }
      case 'toBoolean': {
        const val = args.length > 0 ? args[0] : current;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') {
          const lower = val.toLowerCase().trim();
          return lower === 'true' || lower === '1' || lower === 'sim' || lower === 's' || lower === 'yes';
        }
        if (typeof val === 'number') return val === 1;
        return !!val;
      }
      case 'toUpper': {
        const val = args.length > 0 ? args[0] : current;
        return typeof val === 'string' ? val.toUpperCase() : val;
      }
      case 'toLower': {
        const val = args.length > 0 ? args[0] : current;
        return typeof val === 'string' ? val.toLowerCase() : val;
      }
      case 'trim': {
        const val = args.length > 0 ? args[0] : current;
        return typeof val === 'string' ? val.trim() : val;
      }
      case 'firstElement': {
        const val = args.length > 0 ? args[0] : current;
        if (val === undefined || val === null) return undefined;
        if (Array.isArray(val)) return val.length > 0 ? val[0] : undefined;
        return val;
      }
      case 'lastElement': {
        const val = args.length > 0 ? args[0] : current;
        if (val === undefined || val === null) return undefined;
        if (Array.isArray(val)) return val.length > 0 ? val[val.length - 1] : undefined;
        return val;
      }
      case 'toList': {
        const val = args.length > 0 ? args[0] : current;
        if (val === undefined || val === null) return [];
        return Array.isArray(val) ? val : [val];
      }
      case 'doubleSum':
      case 'intSum':
      case 'longSum': {
        const collectNumbers = (val: any): number[] => {
          if (val === undefined || val === null) return [];
          if (Array.isArray(val)) return val.flatMap(collectNumbers);
          if (typeof val === 'object') return Object.values(val).flatMap(collectNumbers);
          const n = parseFloat(String(val));
          return isNaN(n) ? [] : [n];
        };
        const nums = (args.length > 0 ? args : [current]).flatMap(collectNumbers);
        const sum = nums.reduce((a, b) => a + b, 0);
        return funcName === 'doubleSum' ? sum : Math.round(sum);
      }
      case 'divide': {
        const a = args.length >= 2 ? parseFloat(String(args[0])) : parseFloat(String(current));
        const b = args.length >= 2 ? parseFloat(String(args[1])) : parseFloat(String(args[0]));
        if (!isNaN(a) && !isNaN(b) && b !== 0) {
          return a / b;
        }
        return 0;
      }
      case 'divideAndRound': {
        let scale = 2;
        let numerator = 0;
        let denominator = 1;

        if (args.length >= 3) {
          scale = parseInt(String(args[0]), 10);
          numerator = parseFloat(String(args[1]));
          denominator = parseFloat(String(args[2]));
        } else if (args.length === 2) {
          numerator = parseFloat(String(args[0]));
          denominator = parseFloat(String(args[1]));
        } else if (args.length === 1) {
          numerator = parseFloat(String(current));
          denominator = parseFloat(String(args[0]));
        }

        if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
          const res = numerator / denominator;
          return !isNaN(scale) ? Number(res.toFixed(scale)) : res;
        }
        return 0;
      }
      case 'multiply':
      case 'doubleMultiply':
      case 'intMultiply': {
        const nums = (args.length > 0 ? args : [current]).map(a => parseFloat(String(a))).filter(n => !isNaN(n));
        if (nums.length === 0) return 0;
        const res = nums.reduce((acc, curr) => acc * curr, 1);
        return funcName === 'intMultiply' ? Math.round(res) : res;
      }
      case 'split': {
        const separator = args[0];
        const val = args.length >= 2 ? args[1] : current;
        if (val === undefined || val === null || val === '') return undefined;
        const strVal = String(val);
        const sepRegex = createSplitRegex(String(separator));
        return strVal.split(sepRegex).filter(item => item !== '');
      }
      case 'join': {
        const separator = args[0] !== undefined ? String(args[0]) : '';
        const val = args.length >= 2 ? args[1] : current;
        if (val === undefined || val === null) return undefined;
        if (Array.isArray(val)) {
          if (val.length === 0) return '';
          return val.filter(v => v !== undefined && v !== null && v !== '').join(separator);
        }
        return String(val);
      }
      case 'substring': {
        let val = current;
        let start = 0;
        let end: number | undefined = undefined;

        if (args.length >= 3) {
          val = args[0];
          start = parseInt(String(args[1]), 10);
          end = parseInt(String(args[2]), 10);
        } else if (args.length === 2) {
          if (typeof args[0] === 'string' && isNaN(Number(args[0]))) {
            val = args[0];
            start = parseInt(String(args[1]), 10);
          } else {
            start = parseInt(String(args[0]), 10);
            end = parseInt(String(args[1]), 10);
          }
        } else if (args.length === 1) {
          start = parseInt(String(args[0]), 10);
        }

        if (val !== undefined && val !== null) {
          const str = String(val);
          return str.substring(isNaN(start) ? 0 : start, (end !== undefined && !isNaN(end)) ? end : undefined);
        }
        return undefined;
      }
      case 'replace': {
        let val = current;
        let target = '';
        let replacement = '';

        if (args.length >= 3) {
          val = args[0];
          target = String(args[1]);
          replacement = String(args[2] ?? '');
        } else if (args.length === 2) {
          target = String(args[0]);
          replacement = String(args[1] ?? '');
        }

        if (val !== undefined && val !== null) {
          return String(val).replaceAll(target, replacement);
        }
        return undefined;
      }
      case 'min':
      case 'max': {
        const collectNumbers = (val: any): number[] => {
          if (val === undefined || val === null) return [];
          if (Array.isArray(val)) return val.flatMap(collectNumbers);
          if (typeof val === 'object') return Object.values(val).flatMap(collectNumbers);
          const n = parseFloat(String(val));
          return isNaN(n) ? [] : [n];
        };
        const nums = (args.length > 0 ? args : [current]).flatMap(collectNumbers);
        if (nums.length > 0) {
          return funcName === 'min' ? Math.min(...nums) : Math.max(...nums);
        }
        return undefined;
      }
      case 'abs': {
        const val = args.length > 0 ? args[0] : current;
        const num = parseFloat(String(val));
        return !isNaN(num) ? Math.abs(num) : undefined;
      }
      case 'leftPad':
      case 'padLeft': {
        if (args.length >= 2) {
          const val = String(args[0] ?? '');
          const len = parseInt(String(args[1]), 10);
          const char = args.length > 2 ? String(args[2]) : ' ';
          return !isNaN(len) ? val.padStart(len, char) : val;
        }
        return undefined;
      }
      case 'rightPad':
      case 'padRight': {
        if (args.length >= 2) {
          const val = String(args[0] ?? '');
          const len = parseInt(String(args[1]), 10);
          const char = args.length > 2 ? String(args[2]) : ' ';
          return !isNaN(len) ? val.padEnd(len, char) : val;
        }
        return undefined;
      }
      case 'base64ToObject': {
        const val = args.length > 0 ? args[0] : current;
        return decodeBase64Helper(val);
      }
      default:
        return funcStr;
    }
  }

  // Avaliação standalone (=funcName)
  if (funcStr === '=toString') return current !== undefined && current !== null ? String(current) : undefined;
  if (funcStr === '=toUpper') return typeof current === 'string' ? current.toUpperCase() : current;
  if (funcStr === '=toLower') return typeof current === 'string' ? current.toLowerCase() : current;
  if (funcStr === '=trim') return typeof current === 'string' ? current.trim() : current;
  if (funcStr === '=size') {
    if (current === undefined || current === null) return 0;
    if (Array.isArray(current) || typeof current === 'string') return current.length;
    if (typeof current === 'object') return Object.keys(current).length;
    return 1;
  }
  if (funcStr === '=toBoolean') {
    if (typeof current === 'boolean') return current;
    if (typeof current === 'string') {
      const lower = current.toLowerCase().trim();
      return lower === 'true' || lower === '1' || lower === 'sim' || lower === 's' || lower === 'yes';
    }
    if (typeof current === 'number') return current === 1;
    return !!current;
  }
  if (funcStr === '=toInteger') {
    if (current === undefined || current === null || current === '') return undefined;
    const val = parseInt(String(current), 10);
    return isNaN(val) ? undefined : val;
  }
  if (funcStr === '=toDouble') {
    if (current === undefined || current === null || current === '') return undefined;
    const val = parseFloat(String(current));
    return isNaN(val) ? undefined : val;
  }
  if (funcStr === '=firstElement') {
    if (current === undefined || current === null) return undefined;
    return Array.isArray(current) && current.length > 0 ? current[0] : current;
  }
  if (funcStr === '=lastElement') {
    if (current === undefined || current === null) return undefined;
    return Array.isArray(current) && current.length > 0 ? current[current.length - 1] : current;
  }
  if (funcStr === '=toList') {
    if (current === undefined || current === null) return [];
    return Array.isArray(current) ? current : [current];
  }
  if (funcStr === '=base64ToObject') {
    return decodeBase64Helper(current);
  }
  if (funcStr === '=doubleSum' || funcStr === '=intSum' || funcStr === '=longSum') {
    const n = parseFloat(String(current));
    if (isNaN(n)) return 0;
    return funcStr === '=doubleSum' ? n : Math.round(n);
  }
  if (funcStr === '=abs') {
    const n = parseFloat(String(current));
    return !isNaN(n) ? Math.abs(n) : undefined;
  }

  return funcStr;
}

/**
 * Resolve caminhos contextuais (@).
 * Permite subir na árvore de processamento para buscar valores.
 */
function resolveValue(path: string, current: any, parents: any[], currentKey?: string) {
  if (!path || typeof path !== 'string' || !path.startsWith('@')) return path;

  // Substitui & pela chave atual se aplicável
  let normalizedPath = path;
  if (currentKey && path.includes('&')) {
    normalizedPath = path.replace(/&/g, currentKey);
  }

  const complexMatch = normalizedPath.match(/@\((?:(\d+),)?\s*(.*?)\)/);
  if (complexMatch) {
    const levels = complexMatch[1] !== undefined ? parseInt(complexMatch[1], 10) : 0;
    const keyPath = complexMatch[2].trim();
    
    let baseObj = levels === 0 ? current : parents[levels - 1];
    if (!baseObj) return undefined;
    if (keyPath === '' || keyPath === '&') return safeClone(baseObj);

    const parts = keyPath.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
    let val = baseObj;
    for (const p of parts) {
      if (val === undefined || val === null) return undefined;
      val = val[p];
    }
    return safeClone(val);
  }

  const cleanPath = normalizedPath.substring(1);
  if (!cleanPath) return safeClone(current);
  
  if (parents[0] && parents[0][cleanPath] !== undefined) return safeClone(parents[0][cleanPath]);
  if (current && current[cleanPath] !== undefined) return safeClone(current[cleanPath]);

  return undefined;
}

/**
 * Converte literais Jolt (#) para seus tipos nativos (booleanos, números, null ou strings).
 */
function parseLiteralValue(rawVal: string): any {
  if (rawVal === 'True' || rawVal === 'true') return true;
  if (rawVal === 'False' || rawVal === 'false') return false;
  if (rawVal === 'null') return null;
  if (/^-?\d+$/.test(rawVal)) {
    if (rawVal.length > 1 && rawVal.startsWith('0')) return rawVal;
    return parseInt(rawVal, 10);
  }
  if (/^-?\d+\.\d+$/.test(rawVal)) {
    return parseFloat(rawVal);
  }
  return rawVal;
}

/**
 * Valida se uma chave de entrada bate com uma chave de especificação Jolt,
 * suportando pipes (|) e padrões coringa glob (*, como *-*-*-*-* ou RCA-*).
 */
function matchesPattern(pattern: string, testStr: string): boolean {
  if (pattern === testStr) return true;
  if (pattern.includes('|')) {
    return pattern.split('|').some(p => matchesPattern(p.trim(), testStr));
  }
  if (pattern.includes('*')) {
    if (pattern === '*') return true;
    const regexStr = '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
    try {
      return new RegExp(regexStr).test(testStr);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Encontra a melhor entrada correspondente para uma chave no spec do Shift,
 * respeitando a ordem de precedência: Exato > Padrão Coringa Específico > Coringa Genérico (*).
 */
function findMatchingEntry(entries: [string, any][], keyStr: string): [string, any] | undefined {
  // 1. Match exato ou pipe-exato (sem coringas)
  const exact = entries.find(([k]) => {
    if (k === keyStr) return true;
    if (k.includes('|') && !k.includes('*')) {
      return k.split('|').some(p => p.trim() === keyStr);
    }
    return false;
  });
  if (exact) return exact;

  // 2. Match de padrão coringa específico (ex: *-*-*-*-* ou RCA-*)
  const pattern = entries.find(([k]) => {
    if (k === '*') return false;
    return matchesPattern(k, keyStr);
  });
  if (pattern) return pattern;

  // 3. Catch-all '*'
  return entries.find(([k]) => k === '*');
}

/**
 * Aplica a transformação de movimentação (Shift).
 * Mantém uma pilha de contexto (inputValues e specKeys) para resolver [&n].
 */
function applyShift(data: any, spec: any) {
  const result: any = {};
  
  const map = (input: any, s: any, specKeys: string[], inputValues: any[]) => {
    if (input === undefined || !s) return;

    const isLeaf = typeof s === 'string' || Array.isArray(s);
    if (isLeaf) {
      const targets = Array.isArray(s) ? s : [s];
      targets.forEach(t => setDeep(result, t, input, specKeys));
      return;
    }

    const specEntries = Object.entries(s);
    const specialEntries: [string, any][] = [];
    const matchingEntries: [string, any][] = [];

    specEntries.forEach(([sKey, sVal]) => {
      if (sKey.startsWith('#') || sKey.startsWith('@') || sKey.startsWith('$')) {
        specialEntries.push([sKey, sVal]);
      } else {
        matchingEntries.push([sKey, sVal]);
      }
    });

    specialEntries.forEach(([sKey, sVal]) => {
      const childIsLeaf = typeof sVal === 'string' || Array.isArray(sVal);

      // Literais (#)
      if (sKey.startsWith('#')) {
        const rawVal = sKey.substring(1);
        const literalValue = parseLiteralValue(rawVal);
        if (childIsLeaf) {
          const targets = Array.isArray(sVal) ? sVal : [sVal];
          targets.forEach(t => setDeep(result, t, literalValue, [sKey, ...specKeys]));
        }
        return;
      }

      // Referência de Valor (@)
      if (sKey.startsWith('@')) {
        let evalValue: any = input;
        
        const matchComplex = sKey.match(/^@\((?:(\d+),)?\s*(.*?)\)$/);
        const matchSimple = !matchComplex && sKey.match(/^@\(?(\d*)\)?$/);
        
        if (matchComplex) {
          const levels = matchComplex[1] !== undefined ? parseInt(matchComplex[1], 10) : 0;
          const keyPath = matchComplex[2].trim();
          let baseObj = levels === 0 ? input : (inputValues[levels] ?? inputValues[inputValues.length - 1]);
          if (baseObj && keyPath) {
            const parts = keyPath.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
            let v = baseObj;
            for (const p of parts) { 
              if (v === undefined || v === null) break;
              v = v[p]; 
            }
            evalValue = v;
          } else {
            evalValue = baseObj;
          }
        } else if (matchSimple) {
          const levels = (matchSimple[1] !== undefined && matchSimple[1] !== '') ? parseInt(matchSimple[1], 10) : 0;
          evalValue = levels === 0 ? input : (inputValues[levels] ?? inputValues[inputValues.length - 1]);
        }

        if (childIsLeaf) {
          if (evalValue !== undefined) {
            const targets = Array.isArray(sVal) ? sVal : [sVal];
            targets.forEach(t => setDeep(result, t, evalValue, [sKey, ...specKeys]));
          }
        } else {
          if (evalValue !== undefined) {
            map(evalValue, sVal, [String(evalValue), ...specKeys], [evalValue, ...inputValues]);
          }
        }
        return;
      }

      // Referência de Chave ($)
      if (sKey.startsWith('$')) {
        let level = sKey === '$' ? 1 : parseInt(sKey.substring(1), 10);
        if (isNaN(level)) level = 1;
        const valToSet = specKeys[level - 1];
        if (valToSet !== undefined && childIsLeaf) {
          const targets = Array.isArray(sVal) ? sVal : [sVal];
          targets.forEach(t => setDeep(result, t, valToSet, [sKey, ...specKeys]));
        }
        return;
      }
    });

    if (Array.isArray(input)) {
      input.forEach((item, idx) => {
        const idxStr = String(idx);
        const matchEntry = findMatchingEntry(matchingEntries, idxStr);
        if (matchEntry) {
          map(item, matchEntry[1], [idxStr, ...specKeys], [item, ...inputValues]);
        }
      });
    } else if (typeof input === 'object' && input !== null) {
      Object.entries(input).forEach(([k, v]) => {
        const matchEntry = findMatchingEntry(matchingEntries, k);
        if (matchEntry) {
          map(v, matchEntry[1], [k, ...specKeys], [v, ...inputValues]);
        }
      });
    } else if (input !== undefined && input !== null) {
      const inputStr = String(input);
      const matchEntry = findMatchingEntry(matchingEntries, inputStr);
      if (matchEntry) {
        map(input, matchEntry[1], [inputStr, ...specKeys], [input, ...inputValues]);
      }
    }
  };

  map(data, spec, [], [data]);
  const keys = Object.keys(result);
  if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
    return keys.sort((a, b) => Number(a) - Number(b)).map(k => result[k]);
  }
  return result;
}

/**
 * Atribui valores em profundidade no objeto de resultado.
 * Suporta referências de índices cruzados (&n) e criação dinâmica de arrays.
 */
function setDeep(obj: any, path: string, value: any, specKeys: string[]) {
  if (typeof path !== 'string' || !path.trim()) return;
  const clonedValue = safeClone(value);

  // Resolve referências & simples (ex: [&4]) e avançadas &(level,index) (ex: &(1,2))
  let resolvedPath = path.replace(/&(?:\((\d+),\s*(\d+)\)|(\d*))/g, (match, g1, g2, g3) => {
    const level = g3 !== undefined 
      ? (g3 === '' ? 0 : parseInt(g3)) 
      : parseInt(g1);
    const spliceIdx = g2 !== undefined ? parseInt(g2) : undefined;
    
    let val = specKeys[level] ?? '';
    if (spliceIdx !== undefined && val) {
       val = val.substring(spliceIdx); 
    }
    return val;
  });

  // Normalização de sintaxe de array [] e pontos duplos
  resolvedPath = resolvedPath
    .replace(/\[\]/g, '.[+]')
    .replace(/\[([^\]+]+)\]/g, '.$1')
    .replace(/\.\./g, '.')
    .replace(/^\./, '')
    .replace(/\.$/, '');

  if (resolvedPath === "") return;

  const parts = resolvedPath.split('.');
  let current = obj;

  for (let i = 0; i < parts.length; i++) {
    let key: any = parts[i];
    
    // Suporte a pivô de array inteligente
    if (key === '[+]') key = Array.isArray(current) ? current.length : 0;

    const isLast = i === parts.length - 1;

    if (isLast) {
      if (current[key] !== undefined) {
        if (Array.isArray(current[key])) {
          current[key].push(clonedValue);
        } else {
          current[key] = [current[key], clonedValue];
        }
      } else {
        current[key] = clonedValue;
      }
    } else {
      let nextKey = parts[i + 1];
      let isNextNumeric = !isNaN(Number(nextKey)) || nextKey === '[+]';
      
      if (current[key] === undefined) {
        current[key] = isNextNumeric ? [] : {};
      } else if (typeof current[key] !== 'object') {
        current[key] = isNextNumeric ? [] : {};
      }
      current = current[key];
    }
  }
}

/**
 * Aplica valores padrão (Default).
 * Só insere se o campo for nulo ou indefinido.
 */
function applyDefault(data: any, spec: any) {
  const clone = safeClone(data);
  const merge = (target: any, s: any) => {
    if (!s || typeof s !== 'object') return;
    Object.entries(s).forEach(([k, v]) => {
      let cleanK = k;
      let isArraySpec = false;
      if (k.endsWith('[]')) {
        cleanK = k.substring(0, k.length - 2);
        isArraySpec = true;
      }

      if (cleanK === '*' || cleanK === '[*]') {
        if (Array.isArray(target)) {
          target.forEach(item => {
            if (isArraySpec) {
              if (Array.isArray(item)) {
                merge(item, v);
              }
            } else {
              merge(item, v);
            }
          });
        } else if (typeof target === 'object' && target !== null) {
          Object.values(target).forEach(item => {
            if (isArraySpec) {
              if (Array.isArray(item)) {
                merge(item, v);
              }
            } else {
              merge(item, v);
            }
          });
        }
        return;
      }

      if (isArraySpec) {
        if (target[cleanK] === undefined) target[cleanK] = [];
        if (Array.isArray(target[cleanK])) {
          merge(target[cleanK], v);
        }
      } else if (typeof v === 'object' && !Array.isArray(v)) {
        if (target[cleanK] === undefined) target[cleanK] = {};
        merge(target[cleanK], v);
      } else {
        if (target[cleanK] === undefined || target[cleanK] === null) target[cleanK] = safeClone(v);
      }
    });
  };
  merge(clone, spec);
  return clone;
}

/**
 * Remove campos especificados recursivamente.
 */
function applyRemove(data: any, spec: any) {
  const clone = safeClone(data);
  const removePath = (obj: any, currentSpec: any) => {
    if (!obj || typeof currentSpec !== 'object') return;
    for (const key in currentSpec) {
      if (key === '*') {
        if (Array.isArray(obj)) obj.forEach(item => removePath(item, currentSpec[key]));
        else if (typeof obj === 'object') Object.values(obj).forEach(val => removePath(val, currentSpec[key]));
      } else {
        // No Jolt, "" ou null no spec de remove significa deletar a chave
        if (currentSpec[key] === "" || currentSpec[key] === null) {
          delete obj[key];
        } else if (obj[key]) {
          removePath(obj[key], currentSpec[key]);
        }
      }
    }
  };
  removePath(clone, spec);
  return clone;
}

/**
 * Aplica a operação de cardinalidade (Converte valores únicos em arrays ou vice-versa).
 */
function applyCardinality(data: any, spec: any) {
  const result = safeClone(data);
  const traverse = (obj: any, currentSpec: any) => {
    if (!obj || typeof currentSpec !== 'object') return;
    for (const key in currentSpec) {
      if (key === '*') {
        if (Array.isArray(obj)) {
          obj.forEach(item => traverse(item, currentSpec[key]));
        } else if (typeof obj === 'object') {
          Object.values(obj).forEach(val => traverse(val, currentSpec[key]));
        }
      } else {
        const action = currentSpec[key];
        if (typeof action === 'object') {
          if (obj[key] !== undefined) traverse(obj[key], action);
        } else if (action === 'MANY') {
          if (obj[key] !== undefined && !Array.isArray(obj[key])) {
            obj[key] = [obj[key]];
          }
        } else if (action === 'ONE') {
          if (obj[key] !== undefined && Array.isArray(obj[key])) {
            obj[key] = obj[key].length > 0 ? obj[key][0] : null;
          }
        }
      }
    }
  };
  traverse(result, spec);
  return result;
}

/**
 * Ordena as chaves de todos os objetos (Maps) alfabeticamente.
 */
function applySort(data: any): any {
  if (Array.isArray(data)) {
    return data.map(applySort);
  } else if (data !== null && typeof data === 'object') {
    return Object.keys(data)
      .sort()
      .reduce((acc: any, key) => {
        acc[key] = applySort(data[key]);
        return acc;
      }, {});
  }
  return data;
}
