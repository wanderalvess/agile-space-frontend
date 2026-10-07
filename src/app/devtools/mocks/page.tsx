'use client';

import { useEffect, useState } from 'react';
import { Check, Clock, Copy, Database, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SavedMock {
  id: string;
  method: string;
  url: string;
  cleanPath?: string;
  payload: string;
  statusCode?: number;
  delayMs?: number;
  createdAt: string;
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

// Mesma chave da Central de Qualidade antiga: os mocks já salvos pelos usuários continuam aparecendo.
const STORAGE_KEY = 'agile-space_custom_mocks';

const PRESETS: { code: number; label: string }[] = [
  { code: 200, label: '200 OK' },
  { code: 400, label: '400 Bad Request' },
  { code: 401, label: '401 Unauthorized' },
  { code: 403, label: '403 Forbidden' },
  { code: 500, label: '500 Server Error' },
  { code: 504, label: '504 Timeout (5s)' },
];

const selectClass = 'h-9 w-full rounded-lg border border-input bg-background px-2 text-xs font-extrabold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const labelClass = 'text-[10px] font-black uppercase tracking-widest text-muted-foreground';

const defaultPayload = () =>
  `{\n  "id": "PED-8821",\n  "status": "PROCESSANDO",\n  "total": 299.90,\n  "criadoEm": "${new Date().toISOString()}"\n}`;

export default function MocksPage() {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [method, setMethod] = useState<Method>('POST');
  const [endpointUrl, setEndpointUrl] = useState('https://api.exemplo.com.br/v1/pedidos');
  const [statusCode, setStatusCode] = useState<number>(200);
  const [delayMs, setDelayMs] = useState<number>(0);
  const [payload, setPayload] = useState('');
  const [savedMocks, setSavedMocks] = useState<SavedMock[]>([]);

  // Data dinâmica e localStorage só depois da montagem (evita erro de hidratação).
  useEffect(() => {
    setPayload(defaultPayload());
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSavedMocks(JSON.parse(stored));
    } catch (e) {
      console.error('Erro ao carregar Mocks do localStorage', e);
    }
  }, []);

  const persist = (list: SavedMock[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    setSavedMocks(list);
  };

  const saveMockEndpoint = () => {
    try {
      JSON.parse(payload);
    } catch {
      toast({ title: 'Payload JSON inválido', description: 'Verifique se o payload do mock está em formato JSON correto.', variant: 'destructive' });
      return;
    }
    const newMock: SavedMock = {
      id: 'mock_' + Date.now(),
      method,
      url: endpointUrl.trim(),
      cleanPath: endpointUrl.replace(/^https?:\/\/[^/]+/, ''),
      payload,
      statusCode,
      delayMs,
      createdAt: new Date().toISOString(),
    };
    persist([newMock, ...savedMocks]);
    toast({ title: 'Mock de API criado', description: `Endpoint ${method} (${statusCode}) salvo no Motor de Mocks.` });
  };

  const deleteMock = (id: string) => {
    persist(savedMocks.filter(m => m.id !== id));
    toast({ title: 'Mock removido.' });
  };

  const applyErrorPreset = (code: number) => {
    setStatusCode(code);
    if (code === 400) setPayload(`{\n  "error": "BAD_REQUEST",\n  "message": "Parâmetros inválidos fornecidos no payload.",\n  "fields": ["email", "cpf"]\n}`);
    else if (code === 401) setPayload(`{\n  "error": "UNAUTHORIZED",\n  "message": "Token de autenticação ausente ou expirado."\n}`);
    else if (code === 403) setPayload(`{\n  "error": "FORBIDDEN",\n  "message": "Usuário não possui permissão para acessar este recurso."\n}`);
    else if (code === 500) setPayload(`{\n  "error": "INTERNAL_SERVER_ERROR",\n  "message": "Falha inesperada no banco de dados principal."\n}`);
    else if (code === 504) {
      setDelayMs(5000);
      setPayload(`{\n  "error": "GATEWAY_TIMEOUT",\n  "message": "Serviço de pagamento não respondeu a tempo (5000ms)."\n}`);
    } else if (code === 200) {
      setDelayMs(0);
      setPayload(`{\n  "status": "success",\n  "message": "Requisição processada com sucesso."\n}`);
    }
  };

  const copyPayload = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast({ title: 'Payload do mock copiado' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: 'Não foi possível copiar', description: 'O navegador bloqueou o acesso à área de transferência.', variant: 'destructive' });
    }
  };

  return (
    <DevToolPage toolId="mocks">
      <div className="grid h-full grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
        {/* Criador */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Novo endpoint mock</h2>
            <Badge variant="outline" className="rounded-full text-[10px] font-bold">HTTP Mock Engine</Badge>
          </header>

          <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            <div className="space-y-2">
              <Label className={labelClass}>Presets rápidos de resposta</Label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map(p => (
                  <Button
                    key={p.code}
                    size="sm"
                    variant={statusCode === p.code ? 'default' : 'outline'}
                    onClick={() => applyErrorPreset(p.code)}
                    className="h-7 rounded-lg font-code text-[10px] font-bold"
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className={labelClass}>Método</Label>
                <select value={method} onChange={e => setMethod(e.target.value as Method)} className={selectClass}>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className={labelClass}>Status</Label>
                <Input type="number" value={statusCode} onChange={e => setStatusCode(parseInt(e.target.value) || 200)} className="h-9 rounded-lg font-code text-xs font-bold" />
              </div>
              <div className="space-y-1">
                <Label className={labelClass}>Delay (ms)</Label>
                <Input type="number" value={delayMs} onChange={e => setDelayMs(parseInt(e.target.value) || 0)} className="h-9 rounded-lg font-code text-xs font-bold" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className={labelClass}>URL / endpoint do mock</Label>
              <Input value={endpointUrl} onChange={e => setEndpointUrl(e.target.value)} placeholder="https://api.empresa.com.br/v1/..." className="h-9 rounded-lg font-code text-xs" />
            </div>

            <div className="space-y-1">
              <Label className={labelClass}>Payload de resposta (JSON)</Label>
              <Textarea
                value={payload}
                onChange={e => setPayload(e.target.value)}
                rows={10}
                spellCheck={false}
                className="rounded-xl bg-muted/40 font-code text-xs leading-relaxed"
              />
            </div>

            <Button onClick={saveMockEndpoint} className="h-10 w-full gap-2 rounded-xl text-[10px] font-black uppercase tracking-wider">
              <Plus className="h-4 w-4" /> Salvar endpoint mock
            </Button>
          </div>
        </section>

        {/* Salvos */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <header className="shrink-0 border-b border-border/60 px-3 py-2">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Endpoints mockados ({savedMocks.length})</h2>
          </header>

          <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {savedMocks.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center">
                <Database className="h-8 w-8 text-muted-foreground" />
                <p className="text-xs font-semibold text-foreground">Nenhum endpoint mockado cadastrado.</p>
                <p className="text-[11px] font-medium text-muted-foreground">Preencha o formulário para simular seu primeiro endpoint de teste.</p>
              </div>
            ) : (
              savedMocks.map(mock => (
                <div key={mock.id} className="space-y-3 rounded-xl border border-border bg-muted/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-full font-code text-[10px] font-black uppercase">{mock.method}</Badge>
                      <Badge
                        variant={mock.statusCode && mock.statusCode >= 400 ? 'destructive' : 'secondary'}
                        className="rounded-full font-code text-[10px] font-bold"
                      >
                        HTTP {mock.statusCode || 200}
                      </Badge>
                      {mock.delayMs ? (
                        <Badge variant="outline" className="gap-1 rounded-full font-code text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" /> {mock.delayMs}ms
                        </Badge>
                      ) : null}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => deleteMock(mock.id)} className="h-7 w-7 rounded-lg text-destructive hover:text-destructive" aria-label="Remover mock">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <span className="block truncate font-code text-xs font-bold text-foreground">{mock.cleanPath || mock.url}</span>

                  <div className="relative">
                    <Textarea
                      readOnly
                      value={mock.payload}
                      rows={3}
                      spellCheck={false}
                      className={cn('rounded-lg bg-card p-2 pr-9 font-code text-[11px]')}
                    />
                    <Button size="icon" variant="ghost" onClick={() => copyPayload(mock.payload, mock.id)} className="absolute right-1 top-1 h-6 w-6 text-muted-foreground hover:text-foreground" aria-label="Copiar payload">
                      {copiedId === mock.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </DevToolPage>
  );
}
