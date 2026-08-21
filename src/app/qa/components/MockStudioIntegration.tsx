'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Sparkles, 
  ExternalLink,
  Flame,
  AlertCircle,
  Clock,
  Layers
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

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

const STORAGE_KEY = 'agile-space_custom_mocks';

export function MockStudioIntegration() {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Formulário do Mock
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('POST');
  const [endpointUrl, setEndpointUrl] = useState('https://api.exemplo.com.br/v1/pedidos');
  const [statusCode, setStatusCode] = useState<number>(200);
  const [delayMs, setDelayMs] = useState<number>(0);
  const [payload, setPayload] = useState(`{\n  "id": "PED-8821",\n  "status": "PROCESSANDO",\n  "total": 299.90,\n  "criadoEm": "${new Date().toISOString()}"\n}`);

  // Mocks salvos no localStorage
  const [savedMocks, setSavedMocks] = useState<SavedMock[]>([]);

  useEffect(() => {
    loadSavedMocks();
  }, []);

  const loadSavedMocks = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSavedMocks(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Erro ao carregar Mocks do localStorage', e);
    }
  };

  const saveMockEndpoint = () => {
    try {
      // Valida JSON
      JSON.parse(payload);

      const newMock: SavedMock = {
        id: 'mock_' + Date.now(),
        method,
        url: endpointUrl.trim(),
        cleanPath: endpointUrl.replace(/^https?:\/\/[^\/]+/, ''),
        payload,
        statusCode,
        delayMs,
        createdAt: new Date().toISOString()
      };

      const updated = [newMock, ...savedMocks];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setSavedMocks(updated);

      toast({
        title: 'Mock de API criado com sucesso!',
        description: `Endpoint ${method} (${statusCode}) salvo no Motor de Mocks.`
      });
    } catch (e: any) {
      toast({
        title: 'Payload JSON Inválido',
        description: 'Verifique se o payload do mock está em formato JSON correto.',
        variant: 'destructive'
      });
    }
  };

  const deleteMock = (id: string) => {
    const updated = savedMocks.filter(m => m.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSavedMocks(updated);
    toast({ title: 'Mock removido com sucesso.' });
  };

  const applyErrorPreset = (code: number) => {
    setStatusCode(code);
    if (code === 400) {
      setPayload(`{\n  "error": "BAD_REQUEST",\n  "message": "Parâmetros inválidos fornecidos no payload.",\n  "fields": ["email", "cpf"]\n}`);
    } else if (code === 401) {
      setPayload(`{\n  "error": "UNAUTHORIZED",\n  "message": "Token de autenticação ausente ou expirado."\n}`);
    } else if (code === 403) {
      setPayload(`{\n  "error": "FORBIDDEN",\n  "message": "Usuário não possui permissão para acessar este recurso."\n}`);
    } else if (code === 500) {
      setPayload(`{\n  "error": "INTERNAL_SERVER_ERROR",\n  "message": "Falha inesperada no banco de dados principal."\n}`);
    } else if (code === 504) {
      setDelayMs(5000);
      setPayload(`{\n  "error": "GATEWAY_TIMEOUT",\n  "message": "Serviço de pagamento não respondeu a tempo (5000ms)."\n}`);
    } else if (code === 200) {
      setDelayMs(0);
      setPayload(`{\n  "status": "success",\n  "message": "Requisição processada com sucesso."\n}`);
    }
  };

  const copyPayload = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ title: 'Payload do Mock copiado!' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 w-full">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <Database className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
              Estúdio de Mocks de API & Simulação de Erros
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Crie endpoints mockados com códigos de erro HTTP (400, 401, 500, 504) para testar a resiliência do sistema.
            </p>
          </div>
        </div>

        <Link href="/devtools/mock">
          <Button variant="outline" className="h-9 text-xs font-bold gap-2 rounded-xl">
            <ExternalLink className="h-4 w-4 text-purple-500" /> Motor de Mock Avançado
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUNA ESQUERDA: CRIADOR DE MOCK */}
        <Card className="lg:col-span-6 p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
              Novo Endpoint Mock
            </h3>
            <Badge variant="outline" className="text-[10px] font-bold text-purple-600 border-purple-500/30">
              HTTP Mock Engine
            </Badge>
          </div>

          {/* PRESETS DE ERRO */}
          <div className="space-y-2">
            <Label className="text-[11px] font-extrabold uppercase text-slate-500 block">Presets Rápidos de Resposta QA:</Label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => applyErrorPreset(200)} className="h-7 text-[10px] font-bold text-emerald-600 border-emerald-500/30">
                200 OK
              </Button>
              <Button size="sm" variant="outline" onClick={() => applyErrorPreset(400)} className="h-7 text-[10px] font-bold text-amber-600 border-amber-500/30">
                400 Bad Request
              </Button>
              <Button size="sm" variant="outline" onClick={() => applyErrorPreset(401)} className="h-7 text-[10px] font-bold text-purple-600 border-purple-500/30">
                401 Unauthorized
              </Button>
              <Button size="sm" variant="outline" onClick={() => applyErrorPreset(500)} className="h-7 text-[10px] font-bold text-rose-600 border-rose-500/30">
                500 Server Error
              </Button>
              <Button size="sm" variant="outline" onClick={() => applyErrorPreset(504)} className="h-7 text-[10px] font-bold text-blue-600 border-blue-500/30">
                504 Timeout (5s)
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider mb-1 block">Método</Label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as any)}
                  className="w-full h-10 px-3 font-extrabold text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold uppercase tracking-wider mb-1 block">Status Code</Label>
                <Input
                  type="number"
                  value={statusCode}
                  onChange={(e) => setStatusCode(parseInt(e.target.value) || 200)}
                  className="font-mono font-bold text-xs bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase tracking-wider mb-1 block">Delay (ms)</Label>
                <Input
                  type="number"
                  value={delayMs}
                  onChange={(e) => setDelayMs(parseInt(e.target.value) || 0)}
                  className="font-mono font-bold text-xs bg-slate-50 dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider mb-1 block">URL / Endpoint do Mock</Label>
              <Input
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder="https://api.empresa.com.br/v1/..."
                className="font-mono text-xs bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider mb-1 block">Payload de Resposta (JSON)</Label>
              <textarea
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                rows={10}
                className="w-full p-4 font-mono text-xs bg-slate-950 text-purple-400 rounded-xl border border-slate-800 focus:outline-none scrollbar-thin leading-relaxed"
              />
            </div>
          </div>

          <Button
            onClick={saveMockEndpoint}
            className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl gap-2 shadow-md"
          >
            <Plus className="h-4 w-4" /> Salvar Endpoint Mock
          </Button>
        </Card>

        {/* COLUNA DIREITA: ENDPOINTS SALVOS */}
        <Card className="lg:col-span-6 p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
              Endpoints Mockados Ativos ({savedMocks.length})
            </h3>
          </div>

          {savedMocks.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
              <Database className="h-8 w-8 text-slate-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-500">Nenhum endpoint mockado cadastrado no momento.</p>
              <p className="text-[11px] text-slate-400">Preencha o formulário ao lado para simular seu primeiro endpoint de teste.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1 scrollbar-thin">
              {savedMocks.map((mock) => (
                <div key={mock.id} className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`font-mono text-[10px] font-black uppercase ${mock.method === 'GET' ? 'bg-emerald-50 text-emerald-600 border-emerald-300' : mock.method === 'POST' ? 'bg-blue-50 text-blue-600 border-blue-300' : 'bg-amber-50 text-amber-600 border-amber-300'}`}>
                        {mock.method}
                      </Badge>
                      <Badge variant="secondary" className={`font-mono text-[10px] font-bold ${mock.statusCode && mock.statusCode >= 400 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40'}`}>
                        HTTP {mock.statusCode || 200}
                      </Badge>
                      {mock.delayMs ? (
                        <Badge variant="outline" className="text-[9px] font-mono gap-1 text-slate-500">
                          <Clock className="h-3 w-3" /> {mock.delayMs}ms
                        </Badge>
                      ) : null}
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMock(mock.id)}
                      className="h-7 w-7 text-rose-500 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
                    {mock.cleanPath || mock.url}
                  </span>

                  <div className="relative">
                    <textarea
                      readOnly
                      value={mock.payload}
                      rows={3}
                      className="w-full p-2 font-mono text-[11px] bg-slate-900 text-slate-300 rounded-lg border border-slate-800 scrollbar-thin"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyPayload(mock.payload, mock.id)}
                      className="absolute right-1 top-1 h-6 w-6 text-slate-400 hover:text-white"
                    >
                      {copiedId === mock.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
