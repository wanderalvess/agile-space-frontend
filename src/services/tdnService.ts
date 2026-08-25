import { knowledgeApi } from '@/app/knowledge/api';
import { KnowledgeDocument } from '@/lib/knowledge-types';

export interface TdnSearchResult {
  id: string;
  title: string;
  type: string;
  link: string;
  space?: string;
  lastModified?: string;
  labels?: string[];
}

const TDN_TIMEOUT_MS = 30000;

/** fetch com timeout, e leitura segura do corpo de erro (que pode não ser JSON válido, ex: 502/504 de gateway) */
async function fetchTdn(url: string, body: unknown): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TDN_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Tempo limite excedido ao consultar o TDN. Verifique a conexão e tente novamente.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const rawText = await response.text();
    let message = `Erro ${response.status} ao consultar o TDN`;
    try {
      const parsed = JSON.parse(rawText);
      message = parsed.error || message;
    } catch {
      if (rawText) message += `: ${rawText.substring(0, 300)}`;
    }
    throw new Error(message);
  }

  return response.json();
}

export async function searchTdn(baseUrl: string, token: string, query: string, space?: string, label?: string): Promise<TdnSearchResult[]> {
  if (!baseUrl || !token) return [];
  if (!query && !space && !label) return [];

  try {
    const data = await fetchTdn('/api/tdn/search', { baseUrl, token, query, space, label });
    return data.results || [];
  } catch (error) {
    console.error('TDN Search Error:', error);
    throw error;
  }
}

/**
 * Fetch full content of a TDN page
 */
export async function getTdnPageContent(baseUrl: string, token: string, pageId: string) {
  try {
    return await fetchTdn('/api/tdn/content', { baseUrl, token, pageId });
  } catch (error) {
    console.error('TDN Content Error:', error);
    throw error;
  }
}

/**
 * Parses Confluence specific XHTML macros and transforms them into standard HTML/Markdown structures
 */
export function parseConfluenceMacros(html: string): string {
  if (!html) return '';
  let content = html;

  // Helper to extract a parameter value and return it, while removing it from the macro string so it doesn't leak
  const extractParam = (macroStr: string, paramName: string): { value: string, cleanStr: string } => {
    const regex = new RegExp(`<ac:parameter\\s+ac:name="${paramName}">([\\s\\S]*?)<\/ac:parameter>`, 'i');
    const match = macroStr.match(regex);
    if (match) {
      const value = match[1].trim();
      const cleanStr = macroStr.replace(regex, '');
      return { value, cleanStr };
    }
    return { value: '', cleanStr: macroStr };
  };

  // Helper to extract and remove all ac:parameter tags to prevent them from leaking into the text
  const cleanAllParams = (macroStr: string): string => {
    return macroStr.replace(/<ac:parameter[^>]*>[\s\S]*?<\/ac:parameter>/gi, '');
  };

  // Helper to extract the body of a macro
  const getBody = (macroStr: string): string => {
    const match = macroStr.match(/<ac:(?:rich|plain)-text-body>([\s\S]*?)<\/ac:(?:rich|plain)-text-body>/i);
    return match ? match[1].trim() : '';
  };

  let safetyCounter = 0;
  const maxIterations = 100;

  // Pattern for innermost macros to handle nesting correctly (inside-out parsing)
  const innermostMacroPattern = /<ac:structured-macro([^>]*?)>(((?!<ac:structured-macro)[\s\S])*?)<\/ac:structured-macro>/gi;

  while (safetyCounter < maxIterations) {
    let matchesFound = false;

    content = content.replace(innermostMacroPattern, (match, attrs, innerContent) => {
      matchesFound = true;

      const nameMatch = attrs.match(/ac:name="([^"]+)"/i);
      const macroName = nameMatch ? nameMatch[1].toLowerCase() : '';

      // 1. Code block macro
      if (macroName === 'code') {
        const langRes = extractParam(match, 'language');
        const lang = langRes.value || 'plaintext';
        
        let codeBody = getBody(langRes.cleanStr) || innerContent;
        
        // Clean CDATA
        codeBody = codeBody.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');
        
        // Escape HTML entities to prevent rendering issues in dangerouslySetInnerHTML
        codeBody = codeBody
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

        return `<pre class="wiki-code-block"><code class="language-${lang}">${codeBody}</code></pre>`;
      }

      // 2. Tab / Card macro
      if (['card', 'tab', 'tab-page'].includes(macroName)) {
        const labelRes = extractParam(match, 'label');
        const titleRes = extractParam(match, 'title');
        const label = labelRes.value || titleRes.value || 'Passo';
        
        const cleanInner = cleanAllParams(match);
        const body = getBody(cleanInner) || innerContent;

        return `<div class="wiki-tab-section">
          <h3 class="wiki-tab-title">${label}</h3>
          <div class="wiki-tab-content">${body}</div>
        </div>`;
      }

      // 3. Deck / Tabs container macro
      if (['deck', 'tabs', 'tab-container'].includes(macroName)) {
        const cleanInner = cleanAllParams(match);
        const body = getBody(cleanInner) || innerContent;
        return `<div class="wiki-tabs-container">${body}</div>`;
      }

      // 4. Panel macros (info, note, warning, tip)
      if (['info', 'note', 'warning', 'tip', 'alert'].includes(macroName)) {
        const titleRes = extractParam(match, 'title');
        const title = titleRes.value;

        const cleanInner = cleanAllParams(match);
        const body = getBody(cleanInner) || innerContent;

        const type = macroName === 'note' ? 'info' : macroName;
        
        return `<div class="wiki-panel wiki-panel-${type}">
          ${title ? `<div class="wiki-panel-title">${title}</div>` : ''}
          <div class="wiki-panel-body">${body}</div>
        </div>`;
      }

      // 5. For other macros, clean their parameter tags and extract their body/content
      const cleanInner = cleanAllParams(match);
      const body = getBody(cleanInner);
      if (body) return body;

      // If no body, return innerContent without the macro tag and parameters
      return cleanAllParams(innerContent);
    });

    if (!matchesFound) break;
    safetyCounter++;
  }

  // Final cleaning of all leftover Confluence tags
  content = content
    .replace(/<ac:[^>]*>/gi, '')
    .replace(/<\/ac:[^>]*>/gi, '')
    .replace(/<ri:[^>]*>/gi, '')
    .replace(/<\/ri:[^>]*>/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return content;
}

type TdnDocInput = { id: string; title: string; content: string; space?: string; link: string; labels?: string[] };

/**
 * Import a TDN document to the local Knowledge Base (via REST /api/knowledge).
 *
 * Overloaded to keep the legacy 3-arg call shape (`firestore, userId, tdnDoc`)
 * working for call sites not yet migrated off Firestore in this pass, while
 * offering the new 2-arg shape (`userId, tdnDoc`) for migrated callers.
 */
export async function importTdnToKnowledgeBase(userId: string, tdnDoc: TdnDocInput): Promise<string>;
/** @deprecated Legacy signature — the first argument (formerly a Firestore instance) is ignored. */
export async function importTdnToKnowledgeBase(legacyFirestoreArg: unknown, userId: string, tdnDoc: TdnDocInput): Promise<string>;
export async function importTdnToKnowledgeBase(
  arg1: unknown,
  arg2: unknown,
  arg3?: TdnDocInput
): Promise<string> {
  const userId = (arg3 ? arg2 : arg1) as string;
  const tdnDoc = (arg3 ? arg3 : arg2) as TdnDocInput;

  // Clean and structure Confluence macro contents
  let cleanContent = parseConfluenceMacros(tdnDoc.content);

  // Add source info to content
  const sourceInfo = `\n\n---\n*Documento importado do TDN (${tdnDoc.space})*\n*Link original: [${tdnDoc.link}](${tdnDoc.link})*`;
  const content = cleanContent + sourceInfo;
  
  const newDoc: any = {
    tdnId: tdnDoc.id,
    title: `[TDN] ${tdnDoc.title}`,
    content: content,
    category: 'Importado / TDN',
    status: 'published',
    authorId: userId,
    tags: ['TDN', tdnDoc.space || 'Wiki', ...(tdnDoc.labels || [])].filter(Boolean) as string[],
    byteSize: new Blob([content]).size,
  };

  const saved = await knowledgeApi.saveOrUpdateDocument(newDoc);
  return saved.id;
}
