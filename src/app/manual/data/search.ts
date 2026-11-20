import { getModuleIntegration } from '@/lib/integration-catalog';
import { plainText } from './inline';
import type { ManualBlock } from '../content/types';
import type { ManualCategoryId, ManualTopic } from './topics';

/**
 * Busca do Manual: título, frase e palavras-chave do tópico (o "cabeçalho") e o texto do corpo.
 * O índice sai do mesmo conteúdo que a página do tópico mostra, então a busca nunca fica para trás do texto.
 */

/** Minúsculas e sem acento, mantendo o tamanho do texto (os trechos achados são cortados do original). */
export function fold(source: string): string {
  let out = '';
  for (const ch of source) {
    if (ch.length > 1) {
      out += ch;
      continue;
    }
    const base = (ch.normalize('NFD')[0] ?? ch).toLowerCase();
    out += base.length === 1 ? base : ch;
  }
  return out;
}

/** O texto que a pessoa lê num bloco, sem a marcação. */
export function blockPlainText(block: ManualBlock): string {
  switch (block.kind) {
    case 'idea':
    case 'h2':
    case 'p':
    case 'li':
    case 'warn':
      return plainText(block.text);
    case 'step':
      return `${block.title}. ${plainText(block.text)}`;
    case 'faq':
      return `${block.q} ${plainText(block.a)}`;
    case 'code':
      return block.code;
    case 'api':
      return `${block.label} ${block.path} ${block.text}`;
    case 'module-api': {
      const m = getModuleIntegration(block.moduleId);
      if (!m) return '';
      return [
        m.label,
        m.tagline,
        ...m.rest.map((r) => `${r.method} ${r.path} ${r.summary}`),
        ...m.mcp.map((t) => `${t.name} ${t.summary}`),
        ...(m.notes ?? []),
      ].join(' ');
    }
  }
}

/** Cada bloco termina em ponto, para os trechos da busca não emendarem títulos e frases ("comuns O JWT..."). */
function endSentence(text: string): string {
  return /[.!?:…]$/.test(text) ? text : `${text}.`;
}

export function bodyText(blocks: ManualBlock[]): string {
  return blocks.map((b) => blockPlainText(b).trim()).filter(Boolean).map(endSentence).join(' ');
}

/** Tempo de leitura em minutos (200 palavras por minuto), no mínimo 1. */
export function readingMinutes(blocks: ManualBlock[]): number {
  const words = bodyText(blocks).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export interface TopicHeading {
  id: string;
  text: string;
}

export const MODULE_API_HEADING = 'API REST e ferramentas MCP';

/** Títulos de seção (e a seção de API do módulo), com os ids das âncoras do sumário "Neste tópico". */
export function headingsOf(blocks: ManualBlock[]): TopicHeading[] {
  const out: TopicHeading[] = [];
  for (const b of blocks) {
    if (b.kind === 'h2') out.push({ id: `secao-${out.length + 1}`, text: b.text });
    else if (b.kind === 'module-api') out.push({ id: `secao-${out.length + 1}`, text: MODULE_API_HEADING });
  }
  return out;
}

export interface TopicIndexEntry {
  topic: ManualTopic;
  /** Título, frase e palavras-chave, já sem acento nem caixa. */
  head: string;
  /** O texto do corpo como a pessoa lê. */
  body: string;
  bodyFolded: string;
}

export function buildIndex(topics: ManualTopic[], content: Record<string, ManualBlock[]>): TopicIndexEntry[] {
  return topics.map((topic) => {
    const body = bodyText(content[topic.id] ?? []);
    return {
      topic,
      head: fold([topic.title, topic.summary, ...topic.keywords].join(' ')),
      body,
      bodyFolded: fold(body),
    };
  });
}

export interface SearchHit {
  topic: ManualTopic;
  /** Achou no título, na frase ou nas palavras-chave. */
  inTitle: boolean;
  /** Achou no corpo do tópico. */
  inBody: boolean;
  /** Trecho do corpo, só quando o achado está no corpo e não no título. */
  snippet: string;
}

const BEFORE = 36;
const AFTER = 64;

/** Trecho do corpo em volta do primeiro achado, cortado em limite de palavra e com reticências. */
export function snippetAround(body: string, bodyFolded: string, tokens: string[]): string {
  let at = -1;
  let len = 0;
  const phrase = tokens.join(' ');
  const whole = phrase ? bodyFolded.indexOf(phrase) : -1;
  if (whole >= 0) {
    at = whole;
    len = phrase.length;
  } else {
    for (const t of tokens) {
      const i = bodyFolded.indexOf(t);
      if (i >= 0 && (at < 0 || i < at)) {
        at = i;
        len = t.length;
      }
    }
  }
  if (at < 0) return '';
  let start = Math.max(0, at - BEFORE);
  let end = Math.min(body.length, at + len + AFTER);
  if (start > 0) {
    const space = body.indexOf(' ', start);
    if (space >= 0 && space < at) start = space + 1;
  }
  if (end < body.length) {
    const space = body.lastIndexOf(' ', end);
    if (space > at + len) end = space;
  }
  return `${start > 0 ? '…' : ''}${body.slice(start, end).trim()}${end < body.length ? '…' : ''}`;
}

export function queryTokens(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean);
}

/**
 * Procura em todo o índice. Cada palavra da busca precisa aparecer no tópico (cabeçalho ou corpo).
 * Quem tem o termo no título vem primeiro; a ordem do Manual desempata. Busca vazia devolve todos, sem trecho.
 */
export function searchTopics(index: TopicIndexEntry[], query: string, category?: ManualCategoryId | null): SearchHit[] {
  const tokens = queryTokens(query);
  const pool = category ? index.filter((e) => e.topic.category === category) : index;
  if (tokens.length === 0) return pool.map((e) => ({ topic: e.topic, inTitle: false, inBody: false, snippet: '' }));

  const hits: SearchHit[] = [];
  for (const e of pool) {
    const inHead = tokens.every((t) => e.head.includes(t));
    const inText = tokens.every((t) => e.head.includes(t) || e.bodyFolded.includes(t));
    if (!inText) continue;
    const inBody = tokens.every((t) => e.bodyFolded.includes(t));
    hits.push({
      topic: e.topic,
      inTitle: inHead,
      inBody,
      snippet: !inHead ? snippetAround(e.body, e.bodyFolded, tokens) : '',
    });
  }
  // `sort` é estável: dentro de cada grupo vale a ordem do Manual.
  return hits.sort((a, b) => Number(b.inTitle) - Number(a.inTitle));
}
