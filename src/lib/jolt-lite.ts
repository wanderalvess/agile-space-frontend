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
 * Post-processador recursivo para avaliar expressões de modificação residuais.
 * Resolve especificamente =toString(@(X,campo)) e =toInteger(@(X,campo)).
 */
function evaluateJoltModifiers(data: any, originalInput: any): any {
  if (data === null || typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(item => evaluateJoltModifiers(item, originalInput));
  }

  for (const key in data) {
    const value = data[key];

    if (typeof value === 'string' && value.startsWith('=')) {
      // 1. Regex flexível para =toString(@(X,campo))
      const toStringMatch = value.match(/^=toString\(@\(\d+,([a-zA-Z0-9_]+)\)\)$/);
      if (toStringMatch) {
        const targetField = toStringMatch[1];
        // 1. Tenta achar no objeto local. 2. Se não achar, busca no payload original!
        let val = data[targetField] !== undefined ? data[targetField] : findDeepValue(originalInput, targetField);
        
        if (val !== undefined) {
          data[key] = String(val);
          continue;
        }
      }

      // 2. Regex flexível para =toInteger(@(X,campo))
      const toIntegerMatch = value.match(/^=toInteger\(@\(\d+,([a-zA-Z0-9_]+)\)\)$/);
      if (toIntegerMatch) {
        const targetField = toIntegerMatch[1];
        let val = data[targetField] !== undefined ? data[targetField] : findDeepValue(originalInput, targetField);
        
        if (val !== undefined) {
          const parsed = parseInt(String(val), 10);
          data[key] = isNaN(parsed) ? 0 : parsed;
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

      if (key === '*') {
        if (Array.isArray(currentData)) {
          currentData.forEach(item => traverse(item, action));
        } else if (typeof currentData === 'object') {
          Object.values(currentData).forEach(val => traverse(val, action));
        }
      } else if (action === '=base64ToObject') {
        if (currentData[key] && typeof currentData[key] === 'string') {
          try {
            // Decodificador Base64 resiliente para UTF-8 (compatível com JSON estruturado)
            const b64 = currentData[key];
            const binString = typeof window !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
            const bytes = new Uint8Array(binString.length);
            for (let i = 0; i < binString.length; i++) bytes[i] = binString.charCodeAt(i);
            const decoded = new TextDecoder().decode(bytes);
            
            currentData[key] = JSON.parse(decoded);
            wasProcessed = true;
          } catch (e) {
            console.warn(`Aviso: Falha ao decodificar Base64 no campo ${key}`, e);
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

      if (key === '*') {
        if (Array.isArray(obj)) {
          obj.forEach(item => processNode(item, value, [obj, ...parents]));
        } else if (typeof obj === 'object') {
          Object.values(obj).forEach(item => processNode(item, value, [obj, ...parents]));
        }
        return;
      }

      const processValue = (valToProcess: any): any => {
        if (typeof valToProcess === 'string') {
          if (valToProcess.startsWith('=')) {
            return executeFunction(valToProcess, obj[key], [obj, ...parents], root);
          } else if (valToProcess.startsWith('@')) {
            return resolveValue(valToProcess, obj[key], [obj, ...parents]);
          }
        }
        return valToProcess;
      };

      if (Array.isArray(value)) {
        for (const item of value) {
          const resolved = processValue(item);
          if (resolved !== undefined && resolved !== null) {
            if (!isDefaultOnly || obj[key] === undefined) obj[key] = resolved;
            break;
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        if (!obj[key]) obj[key] = {};
        processNode(obj[key], value, [obj, ...parents]);
      } else {
        const resolved = processValue(value);
        if (resolved !== undefined) {
          if (!isDefaultOnly || obj[key] === undefined) obj[key] = resolved;
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
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === "'") inQuotes = !inQuotes;
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
 * Executa funções da especificação Modify (beta).
 * Suporta =doubleSum, =divide, =split, =join, =concat, etc.
 */
function executeFunction(funcStr: string, current: any, parents: any[], root: any): any {
  if (typeof funcStr !== 'string' || !funcStr.startsWith('=')) return funcStr;

  const evalArg = (arg: string): any => {
    if (arg.startsWith('=')) {
      return executeFunction(arg, current, parents, root);
    }
    if (arg.startsWith('@')) {
      return resolveValue(arg, current, parents);
    }
    if (arg.startsWith("'") && arg.endsWith("'")) {
      return arg.slice(1, -1);
    }
    if (arg === 'true') return true;
    if (arg === 'false') return false;
    if (arg === 'null') return null;
    const num = Number(arg);
    if (!isNaN(num) && arg.trim() !== '') return num;
    return arg;
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
        const val = args[0];
        if (Array.isArray(val) || typeof val === 'string') return val.length;
        if (val && typeof val === 'object') return Object.keys(val).length;
        return 0;
      }
      case 'toInteger': {
        const val = parseInt(args[0]);
        return isNaN(val) ? 0 : val;
      }
      case 'toDouble': {
        const val = parseFloat(args[0]);
        return isNaN(val) ? 0.0 : val;
      }
      case 'toString':
        return args[0] !== undefined && args[0] !== null ? String(args[0]) : '';
      case 'toBoolean': {
        const val = args[0];
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') {
          const lower = val.toLowerCase().trim();
          return lower === 'true' || lower === '1' || lower === 'sim' || lower === 'yes';
        }
        if (typeof val === 'number') return val === 1;
        return !!val;
      }
      case 'toUpper':
        return typeof args[0] === 'string' ? args[0].toUpperCase() : args[0];
      case 'toLower':
        return typeof args[0] === 'string' ? args[0].toLowerCase() : args[0];
      case 'trim':
        return typeof args[0] === 'string' ? args[0].trim() : args[0];
      case 'firstElement':
        return Array.isArray(args[0]) && args[0].length > 0 ? args[0][0] : undefined;
      case 'lastElement':
        return Array.isArray(args[0]) && args[0].length > 0 ? args[0][args[0].length - 1] : undefined;
      case 'doubleSum': {
        const collectNumbers = (val: any): number[] => {
          if (val === undefined || val === null) return [];
          if (Array.isArray(val)) return val.flatMap(collectNumbers);
          if (typeof val === 'object') return Object.values(val).flatMap(collectNumbers);
          const n = parseFloat(String(val));
          return isNaN(n) ? [] : [n];
        };
        const nums = args.flatMap(collectNumbers);
        return nums.reduce((a, b) => a + b, 0);
      }
      case 'divide':
        if (args.length >= 2) {
          const a = parseFloat(args[0]);
          const b = parseFloat(args[1]);
          return !isNaN(a) && !isNaN(b) && b !== 0 ? a / b : 0;
        }
        return 0;
      case 'split':
        if (args.length >= 2) {
          let separator = args[0];
          const val = args[1];
          if (val === undefined || val === null || val === '') return undefined;
          separator = separator.replace(/\\\\/g, '\\').replace(/\\\./g, '.');
          const sepRegex = separator === '\\D' ? /\D/ : separator;
          return typeof val === 'string' ? val.split(sepRegex).filter(Boolean) : undefined;
        }
        return undefined;
      case 'join':
        if (args.length >= 2) {
          const separator = args[0];
          const val = args[1];
          if (!val || (Array.isArray(val) && val.length === 0)) return undefined;
          return Array.isArray(val) ? val.filter(v => v !== undefined && v !== null && v !== '').join(separator) : val;
        }
        return undefined;
      case 'substring':
        if (args.length >= 2) {
          const val = args[0];
          if (typeof val === 'string') {
            const start = parseInt(args[1]);
            const end = args.length > 2 ? parseInt(args[2]) : undefined;
            if (!isNaN(start)) {
              return val.substring(start, isNaN(end!) ? undefined : end);
            }
          }
        }
        return undefined;
      case 'replace':
        if (args.length >= 3) {
          const val = args[0];
          if (typeof val === 'string') {
            const target = args[1];
            const replacement = args[2];
            return val.replaceAll(target, replacement);
          }
        }
        return undefined;
      case 'min':
      case 'max': {
        const nums = args.map(n => parseFloat(n)).filter(n => !isNaN(n));
        if (nums.length > 0) {
          return funcName === 'min' ? Math.min(...nums) : Math.max(...nums);
        }
        return undefined;
      }
      case 'abs': {
        const val = parseFloat(args[0]);
        return !isNaN(val) ? Math.abs(val) : undefined;
      }
      default:
        return funcStr;
    }
  }

  if (funcStr === '=toString') return current !== undefined && current !== null ? String(current) : undefined;
  if (funcStr === '=toUpper') return typeof current === 'string' ? current.toUpperCase() : current;
  if (funcStr === '=toLower') return typeof current === 'string' ? current.toLowerCase() : current;
  if (funcStr === '=trim') return typeof current === 'string' ? current.trim() : current;
  if (funcStr === '=size') {
    if (Array.isArray(current) || typeof current === 'string') return current.length;
    if (current && typeof current === 'object') return Object.keys(current).length;
    return 0;
  }
  if (funcStr === '=toBoolean') {
    if (typeof current === 'boolean') return current;
    if (typeof current === 'string') {
      const lower = current.toLowerCase().trim();
      return lower === 'true' || lower === '1' || lower === 'sim' || lower === 'yes';
    }
    if (typeof current === 'number') return current === 1;
    return !!current;
  }
  if (funcStr === '=toInteger') {
    const val = parseInt(current);
    return isNaN(val) ? 0 : val;
  }
  if (funcStr === '=toDouble') {
    const val = parseFloat(current);
    return isNaN(val) ? 0.0 : val;
  }
  if (funcStr === '=firstElement') {
    return Array.isArray(current) && current.length > 0 ? current[0] : undefined;
  }
  if (funcStr === '=lastElement') {
    return Array.isArray(current) && current.length > 0 ? current[current.length - 1] : undefined;
  }

  return funcStr;
}

/**
 * Resolve caminhos contextuais (@).
 * Permite subir na árvore de processamento para buscar valores.
 */
function resolveValue(path: string, current: any, parents: any[]) {
  if (!path || typeof path !== 'string' || !path.startsWith('@')) return path;

  const complexMatch = path.match(/@\((\d+),(.*?)\)/);
  if (complexMatch) {
    const levels = parseInt(complexMatch[1]);
    const keyPath = complexMatch[2].trim();
    
    let baseObj = levels === 0 ? current : parents[levels - 1];
    if (!baseObj) return undefined;
    if (keyPath === '') return safeClone(baseObj);

    const parts = keyPath.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
    let val = baseObj;
    for (const p of parts) {
      if (val === undefined || val === null) return undefined;
      val = val[p];
    }
    return safeClone(val);
  }

  const cleanPath = path.substring(1);
  if (!cleanPath) return safeClone(current);
  
  if (parents[0] && parents[0][cleanPath] !== undefined) return safeClone(parents[0][cleanPath]);
  if (current && current[cleanPath] !== undefined) return safeClone(current[cleanPath]);

  return undefined;
}

/**
 * Aplica a transformação de movimentação (Shift).
 * Mantém uma pilha de contexto (inputValues e specKeys) para resolver [&n].
 */
function applyShift(data: any, spec: any) {
  const result: any = {};
  
  const map = (input: any, s: any, specKeys: string[], inputValues: any[]) => {
    if (input === undefined || input === null || !s) return;

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
        const literalValue = sKey.substring(1);
        if (childIsLeaf) {
          const targets = Array.isArray(sVal) ? sVal : [sVal];
          targets.forEach(t => setDeep(result, t, literalValue, [sKey, ...specKeys]));
        }
        return;
      }

      // Referência de Valor (@)
      if (sKey.startsWith('@')) {
        let evalValue: any = input;
        
        const matchComplex = sKey.match(/@\((\d+),(.*?)\)/);
        const matchSimple = !matchComplex && sKey.match(/@\(?(\d+)\)?/);
        
        if (matchComplex) {
          const levels = parseInt(matchComplex[1]);
          const keyPath = matchComplex[2].trim();
          let baseObj = inputValues[levels] ?? inputValues[inputValues.length - 1];
          if (baseObj && keyPath) {
            const parts = keyPath.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
            let v = baseObj;
            for (const p of parts) { if (v !== undefined) v = v[p]; }
            evalValue = v;
          } else {
            evalValue = baseObj;
          }
        } else if (matchSimple) {
          const levels = parseInt(matchSimple[1]);
          evalValue = inputValues[levels] ?? inputValues[inputValues.length - 1];
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
        let level = sKey === '$' ? 1 : parseInt(sKey.substring(1));
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
      const wildcardEntry = matchingEntries.find(([k]) => k === '*');
      input.forEach((item, idx) => {
        const idxStr = String(idx);
        const exactEntry = matchingEntries.find(([k]) => k === idxStr || k.split('|').includes(idxStr));
        if (exactEntry) {
          map(item, exactEntry[1], [idxStr, ...specKeys], [item, ...inputValues]);
        } else if (wildcardEntry) {
          map(item, wildcardEntry[1], [idxStr, ...specKeys], [item, ...inputValues]);
        }
      });
    } else if (typeof input === 'object' && input !== null) {
      const wildcardEntry = matchingEntries.find(([k]) => k === '*');
      Object.entries(input).forEach(([k, v]) => {
        const exactEntry = matchingEntries.find(([sk]) => sk === k || sk.split('|').includes(k));
        if (exactEntry) {
          map(v, exactEntry[1], [k, ...specKeys], [v, ...inputValues]);
        } else if (wildcardEntry) {
          map(v, wildcardEntry[1], [k, ...specKeys], [v, ...inputValues]);
        }
      });
    } else {
      const inputStr = String(input);
      const exactEntry = matchingEntries.find(([k]) => k === inputStr || k.split('|').includes(inputStr));
      const wildcardEntry = matchingEntries.find(([k]) => k === '*');
      if (exactEntry) {
        map(input, exactEntry[1], [inputStr, ...specKeys], [input, ...inputValues]);
      } else if (wildcardEntry) {
        map(input, wildcardEntry[1], [inputStr, ...specKeys], [input, ...inputValues]);
      }
    }
  };

  map(data, spec, [], [data]);
  return result;
}

/**
 * Atribui valores em profundidade no objeto de resultado.
 * Suporta referências de índices cruzados (&n) e criação dinâmica de arrays.
 */
function setDeep(obj: any, path: string, value: any, specKeys: string[]) {
  if (typeof path !== 'string' || !path) return;
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

      if (cleanK === '*') {
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
