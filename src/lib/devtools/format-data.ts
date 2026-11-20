import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import * as yaml from 'js-yaml';

/**
 * Formatar e converter JSON, XML e YAML (Estúdio de Dados).
 * O código veio das antigas telas json, xml e yaml-converter; o comportamento é o mesmo.
 * Todas as funções devolvem `{ output, error }` e nunca lançam: o erro é uma frase em PT-BR
 * que, quando há posição, traz "linha N, coluna M".
 */

export type DataFormat = 'json' | 'xml' | 'yaml' | 'sql';
export type ConvertFormat = 'json' | 'xml' | 'yaml';
export interface Processed { output: string; error: string | null }

export const FORMAT_LABEL: Record<DataFormat, string> = { json: 'JSON', xml: 'XML', yaml: 'YAML', sql: 'SQL' };

export const SAMPLE_JSON = '{"projeto":"DDWMISSI","status":"em andamento","pontos":8,"tags":["api","qa"],"dono":{"nome":"Ana","ativo":true}}';
export const SAMPLE_XML = '<?xml version="1.0" encoding="UTF-8"?><projeto id="1"><nome>DDWMISSI</nome><itens><item>A</item><item>B</item></itens><vazio/></projeto>';
export const SAMPLE_YAML = 'projeto: DDWMISSI\nstatus: em andamento\npontos: 8\ntags:\n  - api\n  - qa\ndono:\n  nome: Ana\n  ativo: true\n';

/** Posição "linha N, coluna M" dentro de uma mensagem de erro, se houver. */
export function parseErrorPosition(message: string | null | undefined): { line: number; col: number } | null {
  if (!message) return null;
  const m = message.match(/linha (\d+), coluna (\d+)/i);
  return m ? { line: parseInt(m[1], 10), col: parseInt(m[2], 10) } : null;
}

// Converte posição absoluta em linha/coluna (1-based).
export function lineColumn(text: string, position: number) {
  const lines = text.slice(0, position).split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

// Mensagens do JSON.parse variam entre engines: "at position N" (V8 antigo),
// "(line L column C)" (V8 novo) ou "line L column C" (Firefox). Extraímos o que der.
export function describeJsonError(text: string, message: string): string {
  const lc = message.match(/line (\d+) column (\d+)/i);
  if (lc) return `JSON inválido na linha ${lc[1]}, coluna ${lc[2]}.`;
  const pos = message.match(/position (\d+)/i);
  if (pos) {
    const { line, column } = lineColumn(text, parseInt(pos[1], 10));
    return `JSON inválido na linha ${line}, coluna ${column}.`;
  }
  return `JSON inválido: ${message}`;
}

export function processJson(text: string, mode: 'format' | 'minify', indent: number | string): Processed {
  if (!text.trim()) return { output: '', error: null };
  try {
    const parsed = JSON.parse(text);
    return { output: mode === 'format' ? JSON.stringify(parsed, null, indent) : JSON.stringify(parsed), error: null };
  } catch (e) {
    return { output: '', error: describeJsonError(text, e instanceof Error ? e.message : String(e)) };
  }
}

// ---- XML ------------------------------------------------------------------
const XML_OPTS = { ignoreAttributes: false, attributeNamePrefix: '@_' };

// Formatação por tokens (tags vs. texto): simples e tolerante, como no legado.
// A validação com linha/coluna acontece antes, em processXml.
export function formatXml(xml: string): string {
  const compact = xml.replace(/>\s+</g, '><').trim();
  let out = '';
  let indent = '';
  const tab = '  ';
  for (const node of compact.split(/(?=<)|(?<=>)/)) {
    if (!node.trim()) continue;
    if (node.startsWith('</')) {
      indent = indent.slice(tab.length);
      out += indent + node + '\n';
    } else if (node.startsWith('<') && !node.endsWith('/>') && !node.startsWith('<?') && !node.startsWith('<!')) {
      out += indent + node + '\n';
      indent += tab;
    } else {
      out += indent + node + '\n';
    }
  }
  return out.trim();
}

export function processXml(text: string, mode: 'format' | 'minify'): Processed {
  if (!text.trim()) return { output: '', error: null };
  try {
    const valid = XMLValidator.validate(text);
    if (valid !== true) {
      return { output: '', error: `XML inválido na linha ${valid.err.line}, coluna ${valid.err.col}: ${valid.err.msg}` };
    }
    if (mode === 'minify') return { output: text.replace(/>\s+</g, '><').trim(), error: null };
    return { output: formatXml(text), error: null };
  } catch (e) {
    return { output: '', error: `Falha ao processar: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ---- YAML -----------------------------------------------------------------
function yamlError(e: unknown, label: string): string {
  const msg = e instanceof Error ? e.message : String(e);
  const mark = (e as { mark?: { line: number; column: number } }).mark;
  const where = mark ? ` na linha ${mark.line + 1}, coluna ${mark.column + 1}` : '';
  return `${label} inválido${where}: ${msg.split('\n')[0]}`;
}

/** Formata YAML relendo e reescrevendo com recuo de 2 espaços. */
export function processYaml(text: string, indent = 2): Processed {
  if (!text.trim()) return { output: '', error: null };
  try {
    return { output: yaml.dump(yaml.load(text), { indent, lineWidth: -1 }), error: null };
  } catch (e) {
    return { output: '', error: yamlError(e, 'YAML') };
  }
}

// ---- Conversão ------------------------------------------------------------
function parseAs(text: string, from: ConvertFormat): unknown {
  if (from === 'json') return JSON.parse(text);
  if (from === 'yaml') return yaml.load(text);
  const valid = XMLValidator.validate(text);
  if (valid !== true) throw Object.assign(new Error(valid.err.msg), { xmlPos: valid.err });
  return new XMLParser(XML_OPTS).parse(text);
}

function serializeAs(value: unknown, to: ConvertFormat): string {
  if (to === 'json') return JSON.stringify(value, null, 2);
  if (to === 'yaml') return yaml.dump(value, { indent: 2, lineWidth: -1 });
  return String(new XMLBuilder({ ...XML_OPTS, format: true, indentBy: '  ' }).build(value)).trim();
}

/**
 * Converte entre JSON, XML e YAML passando por um objeto. Os quatro pares que existiam
 * (XML↔JSON e YAML↔JSON) dão a mesma saída de antes; YAML↔XML passa pelo JSON.
 */
export function convertData(text: string, from: ConvertFormat, to: ConvertFormat): Processed {
  if (!text.trim()) return { output: '', error: null };
  if (from === to) return { output: text, error: null };
  let value: unknown;
  try {
    value = parseAs(text, from);
  } catch (e) {
    if (from === 'json') return { output: '', error: describeJsonError(text, e instanceof Error ? e.message : String(e)) };
    if (from === 'xml') {
      const pos = (e as { xmlPos?: { line: number; col: number; msg: string } }).xmlPos;
      return { output: '', error: pos ? `XML inválido na linha ${pos.line}, coluna ${pos.col}: ${pos.msg}` : `Falha ao processar: ${e instanceof Error ? e.message : String(e)}` };
    }
    return { output: '', error: yamlError(e, 'YAML') };
  }
  try {
    return { output: serializeAs(value, to), error: null };
  } catch (e) {
    return { output: '', error: `Falha ao processar: ${e instanceof Error ? e.message : String(e)}` };
  }
}
