// Ignora erro de certificado em rede corporativa (proxy / self-signed)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';

const LOG_FILE = 'C:/Users/wanderson.alves/projetosWanderson/agile-space-frontend/mcp/knowledge-server/mcp_debug.log';

function log(msg) {
    try {
        const line = `[${new Date().toISOString()}] ${msg}\n`;
        fs.appendFileSync(LOG_FILE, line, 'utf-8');
    } catch {}
}

log(`Knowledge server module loaded. ENV: LEGACY_BASE_URL=${process.env.LEGACY_BASE_URL}, LEGACY_API_KEY=${process.env.LEGACY_API_KEY ? (process.env.LEGACY_API_KEY.slice(0, 8) + '...') : 'undefined'}, NEW_BASE_URL=${process.env.NEW_BASE_URL}`);

function getConfig(source) {
    const prefix = source === 'legacy' ? 'LEGACY' : 'NEW';
    const baseUrl = process.env[`${prefix}_BASE_URL`];
    const apiKey = process.env[`${prefix}_API_KEY`];
    if (!baseUrl || !apiKey) {
        const err = `Configuração ausente para source="${source}": defina ${prefix}_BASE_URL e ${prefix}_API_KEY (env vars do servidor MCP). Recebido: ${prefix}_BASE_URL=${baseUrl}, ${prefix}_API_KEY=${apiKey ? 'definida' : 'ausente'}`;
        log(`getConfig error: ${err}`);
        throw new Error(err);
    }
    return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
}

async function call(source, path, options) {
    const { baseUrl, apiKey } = getConfig(source);
    const targetUrl = `${baseUrl}${path}`;
    log(`Calling [${source}] ${options?.method || 'GET'} -> ${targetUrl} (apiKey: ${apiKey.slice(0, 8)}...)`);
    try {
        const headers = { 'X-Api-Key': apiKey };
        let bodyText;
        if (options?.body !== undefined) {
            headers['Content-Type'] = 'application/json';
            bodyText = JSON.stringify(options.body);
        }
        const res = await fetch(targetUrl, {
            method: options?.method || 'GET',
            headers,
            body: bodyText,
        });
        log(`Response from ${targetUrl}: HTTP ${res.status}`);
        return res;
    }
    catch (err) {
        const causeMsg = err?.cause?.message || err?.cause?.code || err?.cause || err?.message;
        const msg = `Falha ao conectar em ${targetUrl}: ${err?.message} (detalhe: ${causeMsg})`;
        log(`Fetch error on ${targetUrl}: ${msg}\nStack: ${err?.stack}\nCause: ${JSON.stringify(err?.cause || {})}`);
        throw new Error(msg);
    }
}
async function callJson(source, path, options) {
    const res = await call(source, path, options);
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        log(`API ${source} error HTTP ${res.status}: ${body.slice(0, 300)}`);
        throw new Error(`API ${source} respondeu ${res.status}: ${body.slice(0, 300)}`);
    }
    return res.json();
}
export function listDocs(source, params) {
    const qs = new URLSearchParams();
    if (params.q)
        qs.set('q', params.q);
    if (params.category)
        qs.set('category', params.category);
    if (params.tag)
        qs.set('tag', params.tag);
    if (params.page)
        qs.set('page', String(params.page));
    if (params.pageSize)
        qs.set('pageSize', String(params.pageSize));
    const query = qs.toString();
    return callJson(source, `/api/v1/knowledge/docs${query ? `?${query}` : ''}`);
}
export function getDoc(source, id, format = 'html') {
    return callJson(source, `/api/v1/knowledge/docs/${encodeURIComponent(id)}?format=${format}`);
}
export async function downloadDoc(source, id, format = 'md') {
    const res = await call(source, `/api/v1/knowledge/docs/${encodeURIComponent(id)}/download?format=${format}`);
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`API ${source} respondeu ${res.status}: ${body.slice(0, 300)}`);
    }
    return res.text();
}
export function createDoc(source, params) {
    return callJson(source, '/api/v1/knowledge/docs', {
        method: 'POST',
        body: params,
    });
}
