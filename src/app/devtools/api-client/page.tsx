'use client';

import { useRef, useState } from 'react';
import { Eraser, Import, Loader2, Send, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';
import { RequestEditor } from '@/components/devtools/http/RequestEditor';
import {
  buildUrl, defaultHeaders, emptyKv, headersToObject, methodHasBody, parseCurl, type RequestModel,
} from '@/lib/devtools/http-request';

// O legado não tinha cliente HTTP próprio: a rota /devtools/api-client só redirecionava para os Snippets.
// Aqui o cliente é novo e reaproveita o editor de requisição dos Snippets.

interface HttpResult {
  status: number;
  statusText: string;
  ms: number;
  bytes: number;
  headers: [string, string][];
  body: string;
  isJson: boolean;
}

const blank = (): RequestModel => ({ method: 'GET', url: '', params: [emptyKv()], headers: defaultHeaders(), body: '' });

const sample = (): RequestModel => ({
  method: 'GET',
  url: 'https://viacep.com.br/ws/01001000/json/',
  params: [emptyKv()],
  headers: [],
  body: '',
});

const formatBytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

export default function ApiClientPage() {
  const [req, setReq] = useState<RequestModel>(blank);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HttpResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'body' | 'headers'>('body');
  const [importOpen, setImportOpen] = useState(false);
  const [curlInput, setCurlInput] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = async () => {
    const url = buildUrl(req.url, req.params);
    if (!url) {
      setError('Informe a URL da requisição.');
      return;
    }
    try {
      new URL(url);
    } catch {
      setError('URL inválida: inclua o protocolo, ex.: https://api.exemplo.com/recurso.');
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setResult(null);
    const started = performance.now();
    try {
      const body = req.body.trim();
      const res = await fetch(url, {
        method: req.method,
        headers: headersToObject(req.headers),
        body: body && methodHasBody(req.method) ? body : undefined,
        signal: ctrl.signal,
      });
      const text = await res.text();
      const ms = Math.round(performance.now() - started);
      let pretty = text;
      let isJson = false;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
        isJson = true;
      } catch {
        /* corpo não é JSON: exibe cru */
      }
      setResult({
        status: res.status,
        statusText: res.statusText,
        ms,
        bytes: new TextEncoder().encode(text).length,
        headers: Array.from(res.headers.entries()),
        body: pretty,
        isJson,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      // fetch não distingue CORS de rede fora do ar: ambos viram TypeError genérico
      setError('Falha na requisição: o servidor não respondeu ou bloqueou o acesso do navegador (CORS). APIs sem CORS liberado só funcionam via cURL/Postman.');
    } finally {
      setLoading(false);
    }
  };

  const doImport = () => {
    const parsed = parseCurl(curlInput);
    if (!parsed) {
      setImportError('Não encontrei uma URL no comando cURL.');
      return;
    }
    setReq({ ...parsed, params: parsed.params.length ? parsed.params : [emptyKv()] });
    setImportOpen(false);
    setCurlInput('');
    setImportError(null);
  };

  const statusLine = result
    ? `${result.status} ${result.statusText} · ${result.ms} ms · ${formatBytes(result.bytes)}`
    : undefined;
  const isHttpError = !!result && result.status >= 400;
  const output = result ? (view === 'body' ? result.body : result.headers.map(([k, v]) => `${k}: ${v}`).join('\n')) : '';
  const btn = 'h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider';

  return (
    <DevToolPage
      toolId="api-client"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => { setReq(sample()); setResult(null); setError(null); }} className={btn}>
            <Wand2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exemplo</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className={btn}>
            <Import className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Importar cURL</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setReq(blank()); setResult(null); setError(null); }} className={btn}>
            <Eraser className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Limpar</span>
          </Button>
        </>
      }
    >
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <RequestEditor
          value={req}
          onChange={setReq}
          urlAction={
            <Button onClick={send} disabled={loading} size="sm" className="h-9 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Enviar
            </Button>
          }
        />
        <ToolPane
          title={result ? `Resposta (${result.status})` : 'Resposta'}
          value={output}
          readOnly
          placeholder={
            loading
              ? 'Aguardando resposta…'
              : 'A resposta aparece aqui.\n\nA requisição sai do seu navegador: a API precisa liberar CORS, e headers como User-Agent, Host e Cookie são controlados pelo navegador e ignorados.'
          }
          downloadName={view === 'headers' ? 'headers.txt' : result?.isJson ? 'resposta.json' : 'resposta.txt'}
          error={error ?? (isHttpError ? statusLine : null)}
          footer={statusLine}
          toolbar={
            <Tabs value={view} onValueChange={v => setView(v as 'body' | 'headers')}>
              <TabsList className="h-7 rounded-lg p-0.5">
                <TabsTrigger value="body" className="h-6 rounded-md px-2.5 text-[10px] font-black uppercase tracking-wider">Corpo</TabsTrigger>
                <TabsTrigger value="headers" className="h-6 rounded-md px-2.5 text-[10px] font-black uppercase tracking-wider">Headers</TabsTrigger>
              </TabsList>
            </Tabs>
          }
        />
      </div>

      <Dialog open={importOpen} onOpenChange={o => { setImportOpen(o); if (!o) setImportError(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-headline font-black uppercase tracking-tight">Importar cURL</DialogTitle>
            <DialogDescription>Cole um comando cURL para preencher método, URL, headers e corpo.</DialogDescription>
          </DialogHeader>
          <Textarea value={curlInput} onChange={e => setCurlInput(e.target.value)} placeholder="curl -X POST 'https://api...'" spellCheck={false} className="min-h-[200px] rounded-xl font-code text-xs" />
          {importError && <p className="text-xs font-semibold text-destructive">{importError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportOpen(false)} className="rounded-xl text-[10px] font-black uppercase tracking-wider">Cancelar</Button>
            <Button onClick={doImport} disabled={!curlInput.trim()} className="rounded-xl text-[10px] font-black uppercase tracking-wider">Importar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DevToolPage>
  );
}
