'use client';

import { useMemo, useState } from 'react';
import { Eraser, Import, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';
import { RequestEditor } from '@/components/devtools/http/RequestEditor';
import {
  SNIPPET_LANGS, buildUrl, defaultHeaders, emptyKv, generateSnippet, headersToObject, parseCurl,
  type RequestModel, type SnippetLang,
} from '@/lib/devtools/http-request';

const FALLBACK_URL = 'https://api.example.com/v1/resource';
const EXT: Record<SnippetLang, string> = { curl: 'sh', fetch: 'js', axios: 'js', python: 'py', java: 'java', csharp: 'cs' };

const blank = (): RequestModel => ({ method: 'GET', url: '', params: [emptyKv()], headers: defaultHeaders(), body: '' });

const sample = (): RequestModel => ({
  method: 'POST',
  url: 'https://api.exemplo.com/v1/tarefas',
  params: [emptyKv('notificar', 'true')],
  headers: [emptyKv('Content-Type', 'application/json'), emptyKv('Authorization', 'Bearer SEU_TOKEN')],
  body: JSON.stringify({ titulo: 'Revisar PR', pontos: 3 }, null, 2),
});

export default function ApiSnippetsPage() {
  const [req, setReq] = useState<RequestModel>(blank);
  const [lang, setLang] = useState<SnippetLang>('curl');
  const [importOpen, setImportOpen] = useState(false);
  const [curlInput, setCurlInput] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const snippet = useMemo(
    () => generateSnippet(lang, {
      method: req.method,
      url: buildUrl(req.url, req.params, FALLBACK_URL),
      headers: headersToObject(req.headers),
      body: req.body,
    }),
    [lang, req],
  );

  const doImport = () => {
    const parsed = parseCurl(curlInput);
    if (!parsed) {
      setImportError('Não encontrei uma URL no comando. Cole um cURL completo, ex.: curl -X POST "https://..." -H "..." -d \'...\'.');
      return;
    }
    setReq({ ...parsed, params: parsed.params.length ? parsed.params : [emptyKv()] });
    setImportOpen(false);
    setCurlInput('');
    setImportError(null);
  };

  const btn = 'h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider';

  return (
    <DevToolPage
      toolId="api-snippets"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => setReq(sample())} className={btn}>
            <Wand2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exemplo</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className={btn}>
            <Import className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Importar cURL</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setReq(blank())} className={btn}>
            <Eraser className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Limpar</span>
          </Button>
        </>
      }
    >
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <RequestEditor value={req} onChange={setReq} />
        <ToolPane
          title="Snippet"
          value={snippet}
          readOnly
          downloadName={`requisicao.${EXT[lang]}`}
          footer={req.url.trim() ? undefined : `Sem URL informada: usando ${FALLBACK_URL} como exemplo.`}
          toolbar={
            <Tabs value={lang} onValueChange={v => setLang(v as SnippetLang)}>
              <TabsList className="h-7 rounded-lg p-0.5">
                {SNIPPET_LANGS.map(l => (
                  <TabsTrigger key={l.id} value={l.id} className="h-6 rounded-md px-2 text-[10px] font-black uppercase tracking-wider">{l.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          }
        />
      </div>

      <Dialog open={importOpen} onOpenChange={o => { setImportOpen(o); if (!o) setImportError(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-headline font-black uppercase tracking-tight">Importar cURL</DialogTitle>
            <DialogDescription>Cole um comando cURL (inclusive o &quot;Copy as cURL&quot; do navegador) para preencher a requisição.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={curlInput}
            onChange={e => setCurlInput(e.target.value)}
            placeholder={`curl -X POST 'https://api...' -H 'Content-Type: application/json' -d '{"a":1}'`}
            spellCheck={false}
            className="min-h-[200px] rounded-xl font-code text-xs"
          />
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
