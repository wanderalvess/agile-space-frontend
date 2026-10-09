/**
 * Geração da spec Jolt a partir das ligações do Mapeador Visual (funções puras, sem React).
 * Antes viviam dentro de app/jolt/visual/page.tsx; foram extraídas para poderem ser testadas.
 */

export interface Mapping {
  id: string;
  source: string;
  target: string;
  type: 'direct' | 'expression';
  expression?: string;
}

export interface PathInfo {
  path: string;
  type: string;
}

export const flattenJsonToPaths = (jsonObj: any, prefix = ''): PathInfo[] => {
  if (jsonObj === null || jsonObj === undefined || typeof jsonObj !== 'object') return [];
  const paths: PathInfo[] = [];

  if (Array.isArray(jsonObj)) {
    const arrayPrefix = prefix ? `${prefix}[*]` : '[*]';
    if (jsonObj.length > 0 && typeof jsonObj[0] === 'object' && jsonObj[0] !== null) {
      paths.push(...flattenJsonToPaths(jsonObj[0], arrayPrefix));
    } else {
      paths.push({ path: arrayPrefix, type: 'Array' });
    }
    return paths;
  }

  for (const key in jsonObj) {
    if (Object.prototype.hasOwnProperty.call(jsonObj, key)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      const value = jsonObj[key];
      const type = Array.isArray(value) ? 'Array' : value === null ? 'null' : typeof value;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        paths.push(...flattenJsonToPaths(value, newPrefix));
      } else if (Array.isArray(value)) {
        const arrayPrefix = `${newPrefix}[*]`;
        if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
          paths.push(...flattenJsonToPaths(value[0], arrayPrefix));
        } else {
          paths.push({ path: arrayPrefix, type: 'Array' });
        }
      } else {
        paths.push({ path: newPrefix, type });
      }
    }
  }
  return paths;
};

/**
 * Registra o destino de um campo de origem no shift. Se o mesmo campo de origem foi ligado a mais de um
 * destino, o Jolt aceita uma lista de destinos: antes, a segunda ligação apagava a primeira em silêncio.
 * Só junta quando a origem é a mesma e os dois destinos são texto simples (os casos especiais de
 * situação/prioritária continuam como estavam).
 */
export function addShiftTarget(
  items: Record<string, any>,
  origins: Map<string, string>,
  key: string,
  fullSource: string,
  target: string,
) {
  const current = items[key];
  const sameOrigin = origins.get(key) === fullSource;
  if (sameOrigin && typeof current === 'string') {
    if (current !== target) items[key] = [current, target];
  } else if (sameOrigin && Array.isArray(current)) {
    if (!current.includes(target)) items[key] = [...current, target];
  } else {
    items[key] = target;
  }
  origins.set(key, fullSource);
}

export interface GenerateSpecOptions {
  mode: 'smarthub' | 'direct';
  entityName?: string;
  inputJson?: string;
  targetJson?: string;
}

export const generateJoltSpec = (mappings: Mapping[], options: GenerateSpecOptions) => {
  const { mode = 'smarthub', entityName = '', inputJson = '', targetJson = '' } = options;

  let sObj: any = {};
  let tObj: any = {};
  try { sObj = JSON.parse(inputJson || '{}'); } catch {}
  try { tObj = JSON.parse(targetJson || '{}'); } catch {}

  const targetSample = Array.isArray(tObj)
    ? tObj[0] || {}
    : Array.isArray(tObj?.items)
      ? tObj.items[0] || {}
      : tObj;
  const targetKeysWithValues: Record<string, any> = {};
  if (targetSample && typeof targetSample === 'object') {
    Object.entries(targetSample).forEach(([k, v]) => {
      targetKeysWithValues[k] = v;
    });
  }

  const mappedTargetCleanSet = new Set(
    mappings.map((m) => m.target.replace(/^(0\.|\[\*\]\.|items\[\*\]\.)/, '')),
  );

  const inputSampleItem = Array.isArray(sObj?.items)
    ? sObj.items[0]
    : Array.isArray(sObj)
      ? sObj[0]
      : sObj;

  const findInputKey = (candidates: string[]) => {
    if (!inputSampleItem || typeof inputSampleItem !== 'object') return null;
    const lowerCandidates = candidates.map((c) => c.toLowerCase());
    return (
      Object.keys(inputSampleItem).find((k) => lowerCandidates.includes(k.toLowerCase())) || null
    );
  };

  const idSrc =
    findInputKey(['id', 'promotionId', 'codigo', 'idRetaguarda']) ||
    mappings
      .find((m) => m.target.toLowerCase().includes('retaguarda') || m.target.toLowerCase().includes('id'))
      ?.source.split('.')
      .pop()
      ?.replace('[*]', '') ||
    'id';

  const branchSrc =
    findInputKey(['branchId', 'codigoFilial', 'filial', 'idLoja']) ||
    mappings
      .find((m) => m.target.toLowerCase().includes('loja') || m.target.toLowerCase().includes('proprietario'))
      ?.source.split('.')
      .pop()
      ?.replace('[*]', '');

  const dateSrc =
    findInputKey(['lastChangeDate', 'dataUltimaAtualizacao', 'startDate', 'dataAlteracao', 'data']) ||
    'lastChangeDate';

  // Deduzir nome da entidade se não fornecido
  let resolvedEntity = entityName.trim();
  if (!resolvedEntity) {
    const allKeysStr = (
      Object.keys(targetKeysWithValues).join(' ') +
      ' ' +
      (inputSampleItem ? Object.keys(inputSampleItem).join(' ') : '')
    ).toLowerCase();

    if (allKeysStr.includes('vigencia') || allKeysStr.includes('promotion') || allKeysStr.includes('oferta')) {
      resolvedEntity = 'CAMPANHA-OFERTA';
    } else if (allKeysStr.includes('endereco') || allKeysStr.includes('receiver') || allKeysStr.includes('bairro')) {
      resolvedEntity = 'ENDERECO-ENTREGA-CLIENTE';
    } else if (allKeysStr.includes('plano') || allKeysStr.includes('parcelas') || allKeysStr.includes('prazos')) {
      resolvedEntity = 'PLANO-PAGAMENTO';
    } else if (allKeysStr.includes('cliente') || allKeysStr.includes('customer')) {
      resolvedEntity = 'CLIENTE';
    } else if (allKeysStr.includes('produto') || allKeysStr.includes('product')) {
      resolvedEntity = 'PRODUTO';
    } else {
      resolvedEntity = 'INTEGRACAO-DADOS';
    }
  }

  const slugEntity = resolvedEntity.toLowerCase().replace(/_/g, '-');
  const upperEntity = resolvedEntity.toUpperCase().replace(/-/g, '_');

  // MODO SMARTHUB (Envelope _attr_access)
  if (mode === 'smarthub') {
    const spec: any[] = [];

    // 1. base64ToObject (Apenas se o JSON de entrada possuir campo base64: conteudo)
    const hasConteudoTag = inputJson.includes('"conteudo"') || (inputSampleItem && typeof inputSampleItem === 'object' && 'conteudo' in inputSampleItem);

    if (hasConteudoTag) {
      spec.push({
        operation: 'custom-totvs',
        spec: {
          data: {
            '*': {
              conteudo: '=base64ToObject',
            },
          },
        },
      });
    }

    // 2. idExterno, idInterno, tipoIdInterno
    const idExternoParts = [`'pdvsync-${slugEntity}-'`];
    if (idSrc) idExternoParts.push(`@(1,${idSrc})`);
    if (branchSrc) idExternoParts.push(`@(1,${branchSrc})`);
    if (dateSrc) idExternoParts.push(`@(1,${dateSrc})`);

    spec.push({
      operation: 'modify-overwrite-beta',
      spec: {
        items: {
          '*': {
            idExterno: `=concat(${idExternoParts.join(", '-', ")})`,
            idInterno: idSrc ? `=concat('', @(1,${idSrc}))` : "=concat('', @(1,id))",
            tipoIdInterno: `PDVSYNC-${upperEntity}`,
          },
        },
      },
    });

    // 3. Shift
    const shiftOrigins = new Map<string, string>();
    const shiftSpecItems: any = {
      tipoIdInterno: 'tipoIdInterno',
      idExterno: 'idExterno',
      idInterno: 'idInterno',
    };

    mappings.forEach(({ source, target }) => {
      const targetClean = target.replace(/^(0\.|\[\*\]\.|items\[\*\]\.)/, '');
      const sourceClean = source.split('.').pop()?.replace('[*]', '') || '';
      if (!sourceClean || !targetClean) return;
      if (['idExterno', 'idInterno', 'tipoIdInterno'].includes(targetClean)) return;

      if (targetClean.toLowerCase() === 'situacao' || targetClean.toLowerCase() === 'ativo') {
        shiftSpecItems[sourceClean] = {
          true: { '#1': `items.[&3].${targetClean}` },
          false: { '#0': `items.[&3].${targetClean}` },
          '*': { '#0': `items.[&3].${targetClean}` },
        };
      } else if (targetClean.toLowerCase() === 'prioritaria') {
        shiftSpecItems[sourceClean] = {
          '0': { '#false': `items.[&3].${targetClean}` },
          '*': { '#true': `items.[&3].${targetClean}` },
        };
      } else {
        addShiftTarget(shiftSpecItems, shiftOrigins, sourceClean, source, `items.[&1].${targetClean}`);
      }
    });

    spec.push({
      operation: 'shift',
      spec: { items: { '*': shiftSpecItems } },
    });

    // 4. Modify casting & formatação de data
    const castingSpec: any = {};
    mappings.forEach(({ target }) => {
      const targetClean = target.replace(/^(0\.|\[\*\]\.|items\[\*\]\.)/, '');
      const tLower = targetClean.toLowerCase();
      if (
        ['idretaguarda', 'idretguardaproduto', 'idretguardaloja', 'idclienteretaguarda', 'idretguardaprodutoembalagem', 'idcliente'].includes(
          tLower,
        )
      ) {
        castingSpec[targetClean] = '=toString';
      }
      if (tLower === 'situacao') {
        castingSpec[targetClean] = '=toInteger';
      }
      if (tLower === 'prioritaria') {
        castingSpec[targetClean] = '=toBoolean';
      }
      if (['valor', 'offerprice', 'preco', 'precovenda'].includes(tLower)) {
        castingSpec[targetClean] = '=toDouble';
      }
      if (tLower.includes('data') || tLower.includes('vigencia')) {
        castingSpec[targetClean] = `=concat(=replace(@(1,${targetClean}),'T',' '),'.000')`;
      }
    });

    if (Object.keys(castingSpec).length > 0) {
      spec.push({
        operation: 'modify-overwrite-beta',
        spec: { items: { '*': castingSpec } },
      });
    }

    // 5. Default spec: campos do destino não mapeados
    const defaultItems: any = {};

    Object.entries(targetKeysWithValues).forEach(([k, v]) => {
      if (['idExterno', 'idInterno', 'tipoIdInterno'].includes(k)) return;
      if (!mappedTargetCleanSet.has(k)) {
        if (k.toLowerCase() === 'idinquilino') {
          defaultItems[k] = '{{ID_INQUILINO}}';
        } else if (k.toLowerCase() === 'loteorigem') {
          defaultItems[k] = '{{LOTE_ORIGEM}}';
        } else if (k.toLowerCase() === 'idproprietario' && (v === 'string' || !v)) {
          defaultItems[k] = '{{MASTER_ID_PROPRIETARIO}}';
        } else {
          defaultItems[k] = v !== undefined ? v : 'string';
        }
      }
    });

    if (Object.keys(defaultItems).length > 0) {
      spec.push({
        operation: 'default',
        spec: {
          _attr_access: 'items',
          'items[]': {
            '*': defaultItems,
          },
        },
      });
    }

    return spec;
  }

  // MODO DIRETO (Array Puro [ { ... } ])
  const directSpec: any[] = [];
  const shiftOrigins = new Map<string, string>();
  const shiftSpecItems: any = {};
  const isSourceInItems = mappings.some((m) => m.source.includes('items['));

  mappings.forEach(({ source, target }) => {
    const targetClean = target.replace(/^(0\.|\[\*\]\.|items\[\*\]\.)/, '');
    const sourceClean = source.split('.').pop()?.replace('[*]', '') || '';
    if (!sourceClean || !targetClean) return;

    if (targetClean.toLowerCase() === 'situacao' || targetClean.toLowerCase() === 'ativo') {
      shiftSpecItems[sourceClean] = {
        true: { '#1': `[&3].${targetClean}` },
        false: { '#0': `[&3].${targetClean}` },
        '*': { '#0': `[&3].${targetClean}` },
      };
    } else if (targetClean.toLowerCase() === 'prioritaria') {
      shiftSpecItems[sourceClean] = {
        '0': { '#false': `[&3].${targetClean}` },
        '*': { '#true': `[&3].${targetClean}` },
      };
    } else {
      addShiftTarget(shiftSpecItems, shiftOrigins, sourceClean, source, `[&1].${targetClean}`);
    }
  });

  if (isSourceInItems) {
    directSpec.push({
      operation: 'shift',
      spec: { items: { '*': shiftSpecItems } },
    });
  } else {
    directSpec.push({
      operation: 'shift',
      spec: { '*': shiftSpecItems },
    });
  }

  // Default para campos não mapeados
  const defaultItems: any = {};
  Object.entries(targetKeysWithValues).forEach(([k, v]) => {
    if (!mappedTargetCleanSet.has(k)) {
      defaultItems[k] = v !== undefined ? v : 'string';
    }
  });

  if (Object.keys(defaultItems).length > 0) {
    directSpec.push({
      operation: 'default',
      spec: {
        '*': defaultItems,
      },
    });
  }

  // Modify casting
  const castingSpec: any = {};
  mappings.forEach(({ target }) => {
    const targetClean = target.replace(/^(0\.|\[\*\]\.|items\[\*\]\.)/, '');
    const tLower = targetClean.toLowerCase();
    if (
      ['idretaguarda', 'idretguardaproduto', 'idretguardaloja', 'idclienteretaguarda', 'idretguardaprodutoembalagem', 'idcliente'].includes(
        tLower,
      )
    ) {
      castingSpec[targetClean] = '=toString';
    }
    if (tLower === 'situacao') {
      castingSpec[targetClean] = '=toInteger';
    }
    if (tLower === 'prioritaria') {
      castingSpec[targetClean] = '=toBoolean';
    }
    if (['valor', 'offerprice', 'preco', 'precovenda'].includes(tLower)) {
      castingSpec[targetClean] = '=toDouble';
    }
    if (tLower.includes('data') || tLower.includes('vigencia')) {
      castingSpec[targetClean] = `=concat(=replace(@(1,${targetClean}),'T',' '),'.000')`;
    }
  });

  if (Object.keys(castingSpec).length > 0) {
    directSpec.push({
      operation: 'modify-overwrite-beta',
      spec: { '*': castingSpec },
    });
  }

  directSpec.push({ operation: 'sort' });

  return directSpec;
};

export const DEFAULT_ENVELOPE_TEMPLATE = JSON.stringify(
  {
    tabela: {
      nome: 'PCINTEGRACAOROTASERVICO',
      campos: [
        {
          nome: 'SOMENTEATUALIZARINTEGRACAOCORE',
          valor: 'N',
        },
        {
          nome: 'ID',
          valor: 'WTA - Buscar dados',
        },
        {
          nome: 'IDEMPRESAAPI',
          valor: 'WINTHOR-WTA',
        },
        {
          nome: 'SERVICO',
          valor: 'WTA - Buscar dados',
        },
        {
          nome: 'LAYOUTCOMUNICACAO',
          valor: {
            name: 'WTA - Buscar dados',
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{TOKEN}}',
                },
                {
                  key: 'Accept',
                  value: '*/*',
                },
              ],
              url: {
                raw: '{{URL_BASE}}/winthor/venda/v0/servico/pdv-sync',
              },
            },
            response: [],
          },
        },
        {
          nome: 'LAYOUTTRANSFORMACAO',
          valor: '_JOLT_SPEC_',
        },
        {
          nome: 'ATIVO',
          valor: 'S',
        },
        {
          nome: 'AUTENTICADOR',
          valor: 'N',
        },
        {
          nome: 'DATASINCRONISMO',
          valor: '14-NOV-23',
        },
        {
          nome: 'REFRESHTOKEN',
          valor: '',
        },
        {
          nome: 'TIPOPROCESSO',
          valor: 'BUSCAR',
        },
      ],
    },
  },
  null,
  2
);

export function injectSpecIntoEnvelope(specArray: any[], templateStr: string): string {
  try {
    if (!templateStr || !templateStr.trim()) {
      return JSON.stringify(specArray, null, 2);
    }
    
    // Se tiver a tag literal "_JOLT_SPEC_"
    if (templateStr.includes('"_JOLT_SPEC_"')) {
      const specJson = JSON.stringify(specArray, null, 2);
      const injected = templateStr.replace('"_JOLT_SPEC_"', () => specJson);
      return JSON.stringify(JSON.parse(injected), null, 2);
    }
    
    if (templateStr.includes('_JOLT_SPEC_')) {
      const specJson = JSON.stringify(specArray, null, 2);
      const injected = templateStr.replace('_JOLT_SPEC_', () => specJson);
      return JSON.stringify(JSON.parse(injected), null, 2);
    }

    // Fallback: parse como JSON e procura campo LAYOUTTRANSFORMACAO
    const parsed = JSON.parse(templateStr);
    if (parsed?.tabela?.campos && Array.isArray(parsed.tabela.campos)) {
      const campo = parsed.tabela.campos.find((c: any) => c.nome === 'LAYOUTTRANSFORMACAO');
      if (campo) {
        campo.valor = specArray;
        return JSON.stringify(parsed, null, 2);
      }
    }

    return JSON.stringify(specArray, null, 2);
  } catch {
    return JSON.stringify(specArray, null, 2);
  }
}
