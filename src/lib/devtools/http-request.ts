// Modelo de requisição HTTP compartilhado entre "Cliente HTTP" (api-client) e "Snippets de API" (api-snippets):
// montagem de URL, parse de cURL e geração de código em várias linguagens. Tudo puro (sem DOM).

export interface KeyValue {
  id: string;
  key: string;
  value: string;
}

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

let seq = 0;
export const newId = () => `kv${Date.now().toString(36)}${(seq++).toString(36)}`;
export const emptyKv = (key = '', value = ''): KeyValue => ({ id: newId(), key, value });
export const defaultHeaders = (): KeyValue[] => [emptyKv('Content-Type', 'application/json')];

export interface RequestModel {
  method: string;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  body: string;
}

/** Métodos que não enviam corpo na prática. */
export const methodHasBody = (method: string) => method !== 'GET' && method !== 'HEAD';

/** URL final = URL base + query params preenchidos. Respeita `?` já existente na base. */
export function buildUrl(url: string, params: KeyValue[], fallback = ''): string {
  let base = url.trim() || fallback;
  base = base.replace(/[?&]$/, '');
  const qs = new URLSearchParams();
  params.forEach(p => {
    if (p.key.trim()) qs.append(p.key.trim(), p.value);
  });
  const s = qs.toString();
  if (!s) return base;
  return base.includes('?') ? `${base}&${s}` : `${base}?${s}`;
}

export function headersToObject(headers: KeyValue[]): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach(h => {
    if (h.key.trim()) out[h.key.trim()] = h.value;
  });
  return out;
}

// ───────── Parse de cURL ─────────

/** Quebra a linha de comando em tokens respeitando aspas simples/duplas, $'..' e continuação com barra invertida. */
export function shellTokenize(input: string): string[] {
  const s = input.replace(/\\\r?\n/g, ' ').replace(/\^\r?\n/g, ' ');
  const tokens: string[] = [];
  let cur = '';
  let has = false;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "'" || (c === '$' && s[i + 1] === "'")) {
      const ansi = c === '$';
      i += ansi ? 2 : 1;
      has = true;
      while (i < s.length && s[i] !== "'") {
        if (ansi && s[i] === '\\' && i + 1 < s.length) {
          const n = s[i + 1];
          cur += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'r' ? '\r' : n;
          i += 2;
        } else cur += s[i++];
      }
      i++;
    } else if (c === '"') {
      i++;
      has = true;
      while (i < s.length && s[i] !== '"') {
        if (s[i] === '\\' && i + 1 < s.length && '"\\$`'.includes(s[i + 1])) {
          cur += s[i + 1];
          i += 2;
        } else cur += s[i++];
      }
      i++;
    } else if (/\s/.test(c)) {
      if (has || cur) tokens.push(cur);
      cur = '';
      has = false;
      i++;
    } else if (c === '\\' && i + 1 < s.length) {
      cur += s[i + 1];
      has = true;
      i += 2;
    } else {
      cur += c;
      has = true;
      i++;
    }
  }
  if (has || cur) tokens.push(cur);
  return tokens;
}

/** Converte um comando cURL em RequestModel. Devolve null se não achar uma URL. */
export function parseCurl(input: string): RequestModel | null {
  const t = shellTokenize(input.trim());
  if (!t.length) return null;
  let method = '';
  let rawUrl = '';
  const headers: KeyValue[] = [];
  const dataParts: string[] = [];
  let basic = '';

  for (let i = 0; i < t.length; i++) {
    const a = t[i];
    const next = () => t[++i] ?? '';
    if (a === '-X' || a === '--request') method = next().toUpperCase();
    else if (a.startsWith('-X') && a.length > 2) method = a.slice(2).toUpperCase();
    else if (a === '-H' || a === '--header') {
      const h = next();
      const idx = h.indexOf(':');
      if (idx > 0) headers.push(emptyKv(h.slice(0, idx).trim(), h.slice(idx + 1).trim()));
    } else if (['-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode', '--body'].includes(a)) dataParts.push(next());
    else if (a === '-u' || a === '--user') basic = next();
    else if (a === '--url') rawUrl = next();
    else if (a === '-A' || a === '--user-agent') headers.push(emptyKv('User-Agent', next()));
    else if (a === '-b' || a === '--cookie') headers.push(emptyKv('Cookie', next()));
    else if (['-o', '--output', '-w', '--write-out', '-m', '--max-time', '--connect-timeout', '-e', '--referer'].includes(a)) next();
    else if (/^https?:\/\//i.test(a) && !rawUrl) rawUrl = a;
    // demais flags (-s, -k, -L, --compressed, -i...) não alteram a requisição
  }
  if (!rawUrl) return null;
  if (basic) headers.push(emptyKv('Authorization', `Basic ${btoa(basic)}`));
  if (!method) method = dataParts.length ? 'POST' : 'GET';

  const params: KeyValue[] = [];
  let url = rawUrl;
  try {
    const u = new URL(rawUrl);
    u.searchParams.forEach((v, k) => params.push(emptyKv(k, v)));
    url = u.origin + u.pathname;
  } catch {
    /* URL com variáveis ({{host}}): mantém como veio */
  }

  let body = dataParts.join('&');
  try {
    body = JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    /* não é JSON: mantém cru */
  }

  return { method, url, params, headers, body };
}

// ───────── Geração de snippets ─────────

export type SnippetLang = 'curl' | 'fetch' | 'axios' | 'python' | 'java' | 'csharp';

export const SNIPPET_LANGS: { id: SnippetLang; label: string }[] = [
  { id: 'curl', label: 'cURL' },
  { id: 'fetch', label: 'fetch' },
  { id: 'axios', label: 'Axios' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'csharp', label: 'C#' },
];

// Literal de string; a sintaxe JSON de string também é válida em JS, Python, Java e C#.
const str = (s: string) => JSON.stringify(s);
const indent = (s: string) => s.replace(/\n/g, '\n  ');

/** Corpo como expressão JS: JSON.stringify(objeto) se for JSON válido, senão string literal. */
function jsBodyExpr(body: string): string {
  try {
    return `JSON.stringify(${indent(JSON.stringify(JSON.parse(body), null, 2))})`;
  } catch {
    return str(body);
  }
}

export function generateSnippet(
  lang: SnippetLang,
  m: { method: string; url: string; headers: Record<string, string>; body: string },
): string {
  const { method, url, headers } = m;
  const body = m.body.trim();
  const hasBody = !!body && methodHasBody(method);
  const hEntries = Object.entries(headers);

  switch (lang) {
    case 'curl': {
      let out = `curl -X ${method} "${url}"`;
      hEntries.forEach(([k, v]) => {
        out += ` \\\n  -H "${k}: ${v}"`;
      });
      if (hasBody) out += ` \\\n  -d '${body.replace(/'/g, "'\\''")}'`;
      return out;
    }
    case 'fetch': {
      const opts = [`  method: ${str(method)}`];
      if (hEntries.length) opts.push(`  headers: ${indent(JSON.stringify(headers, null, 2))}`);
      if (hasBody) opts.push(`  body: ${jsBodyExpr(body)}`);
      return `const response = await fetch(${str(url)}, {\n${opts.join(',\n')}\n});\nconst data = await response.json();`;
    }
    case 'axios': {
      const opts = [`  method: ${str(method.toLowerCase())}`, `  url: ${str(url)}`];
      if (hEntries.length) opts.push(`  headers: ${indent(JSON.stringify(headers, null, 2))}`);
      if (hasBody) {
        let data: string;
        try {
          data = indent(JSON.stringify(JSON.parse(body), null, 2));
        } catch {
          data = str(body);
        }
        opts.push(`  data: ${data}`);
      }
      return `import axios from "axios";\n\nconst { data } = await axios({\n${opts.join(',\n')}\n});`;
    }
    case 'python': {
      const lines = ['import requests', '', `url = ${str(url)}`];
      if (hEntries.length) lines.push(`headers = {\n${hEntries.map(([k, v]) => `    ${str(k)}: ${str(v)}`).join(',\n')}\n}`);
      if (hasBody) lines.push(`payload = ${str(body)}`);
      const args = ['url', hEntries.length ? 'headers=headers' : '', hasBody ? 'data=payload' : ''].filter(Boolean).join(', ');
      lines.push('', `response = requests.request(${str(method)}, ${args})`, 'print(response.status_code)', 'print(response.text)');
      return lines.join('\n');
    }
    case 'java': {
      const pub = hasBody ? `HttpRequest.BodyPublishers.ofString(${str(body)})` : 'HttpRequest.BodyPublishers.noBody()';
      const hs = hEntries.map(([k, v]) => `        .header(${str(k)}, ${str(v)})`).join('\n');
      return [
        'import java.net.URI;',
        'import java.net.http.HttpClient;',
        'import java.net.http.HttpRequest;',
        'import java.net.http.HttpResponse;',
        '',
        'HttpClient client = HttpClient.newHttpClient();',
        'HttpRequest request = HttpRequest.newBuilder()',
        `        .uri(URI.create(${str(url)}))`,
        ...(hs ? [hs] : []),
        `        .method(${str(method)}, ${pub})`,
        '        .build();',
        '',
        'HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());',
        'System.out.println(response.statusCode());',
        'System.out.println(response.body());',
      ].join('\n');
    }
    case 'csharp': {
      // Content-Type vai no StringContent; o resto em Headers.
      const ct = hEntries.find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? 'application/json';
      const hs = hEntries
        .filter(([k]) => k.toLowerCase() !== 'content-type')
        .map(([k, v]) => `request.Headers.TryAddWithoutValidation(${str(k)}, ${str(v)});`);
      return [
        'using var client = new HttpClient();',
        `var request = new HttpRequestMessage(new HttpMethod(${str(method)}), ${str(url)});`,
        ...hs,
        ...(hasBody ? [`request.Content = new StringContent(${str(body)}, System.Text.Encoding.UTF8, ${str(ct)});`] : []),
        '',
        'var response = await client.SendAsync(request);',
        'Console.WriteLine((int)response.StatusCode);',
        'Console.WriteLine(await response.Content.ReadAsStringAsync());',
      ].join('\n');
    }
  }
}
