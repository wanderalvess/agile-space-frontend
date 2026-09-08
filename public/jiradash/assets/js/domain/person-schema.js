// Leitor TOLERANTE e versionado do envelope de identidade (schema v2) do documento de
// configuração do JiraDash — CP1 da épica "Implementar identidade e roster v2" (#7).
//
// Este módulo é PURO e inerte na avaliação: sem DOM, storage, state, fetch, Date nem
// aleatoriedade. Ele só INTERPRETA o que recebeu — nunca corrige, migra, normaliza nem
// regrava um envelope. Os erros são códigos de caminho estrutural ESTÁTICOS: nenhum nome,
// key ou valor recebido aparece na saída, para nada pessoal vazar em log ou mensagem.
//
// Os quatro desfechos são deliberadamente distintos, e a distinção é o produto do CP1:
//   absent      → documento legado puro, sem `identity`. NÃO é erro: o caminho v1 segue.
//   supported   → `identity` presente com schemaVersion === 2 e shape básico íntegro.
//   unsupported → schemaVersion inteira e finita, mas ≠ 2. Um cliente antigo diante de um
//                 documento mais novo precisa RECUAR sem destruir nem reinterpretar a
//                 projeção legada — versão desconhecida nunca é tratada como v2 válida.
//   invalid     → `identity` ou `schemaVersion` estruturalmente quebrados. A v2 fica
//                 indisponível, nada é corrigido e a projeção legada continua legível.

export const IDENTITY_SCHEMA_VERSION = 2;

// Coleções que o envelope v2 prevê, com o shape RASO que a Rev. 7 do estudo define para
// cada uma: quando PRESENTES, as de registro são objeto plano e `conflicts` é ARRAY (é a
// fila de conflitos, ordenada). A validação é rasa de propósito (CP1): distinguir shape
// básico sem cristalizar campos que os próximos checkpoints ainda vão definir. Campo
// desconhecido é tolerado, não erro.
const OBJECT_COLLECTIONS = [
  'people',
  'bindings',
  'migration',
  'scopes',
  'selectors',
  'periods',
  'participation',
  'redactions'
];
const ARRAY_COLLECTIONS = ['conflicts'];

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Devolve { status, envelope, schemaVersion, errors }:
//   envelope       — a MESMA referência recebida quando supported (sem clone: o leitor não
//                    copia dado pessoal sem necessidade); null nos demais desfechos.
//   schemaVersion  — o número observado quando ele é um número íntegro (inclusive numa
//                    versão desconhecida); null quando ausente ou não numérico.
//   errors         — códigos estáticos de caminho (ex.: 'identity.schemaVersion:missing');
//                    vazio em absent/supported/unsupported.
export function readIdentityEnvelope(doc) {
  if (!isPlainObject(doc) || doc.identity === undefined) {
    // Ausência de identity não é erro: é o documento legado de sempre.
    return { status: 'absent', envelope: null, schemaVersion: null, errors: [] };
  }
  const identity = doc.identity;
  if (!isPlainObject(identity)) {
    return { status: 'invalid', envelope: null, schemaVersion: null, errors: ['identity:not-object'] };
  }
  const version = identity.schemaVersion;
  if (version === undefined) {
    return {
      status: 'invalid',
      envelope: null,
      schemaVersion: null,
      errors: ['identity.schemaVersion:missing']
    };
  }
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    // Cobre string, NaN, Infinity e fração: nada disso é versão conhecida NEM futura.
    return {
      status: 'invalid',
      envelope: null,
      schemaVersion: null,
      errors: ['identity.schemaVersion:not-integer']
    };
  }
  if (version !== IDENTITY_SCHEMA_VERSION) {
    return { status: 'unsupported', envelope: null, schemaVersion: version, errors: [] };
  }
  const errors = [];
  for (const key of OBJECT_COLLECTIONS) {
    const value = identity[key];
    if (value !== undefined && !isPlainObject(value)) errors.push(`identity.${key}:not-object`);
  }
  for (const key of ARRAY_COLLECTIONS) {
    const value = identity[key];
    if (value !== undefined && !Array.isArray(value)) errors.push(`identity.${key}:not-array`);
  }
  if (errors.length) return { status: 'invalid', envelope: null, schemaVersion: version, errors };
  return { status: 'supported', envelope: identity, schemaVersion: version, errors: [] };
}
