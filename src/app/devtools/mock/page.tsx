'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Plus,
  Play,
  Trash2,
  FileCode,
  Copy,
  Sparkles,
  RefreshCw,
  Code2,
  Layers,
  AlertCircle,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface CustomMock {
  id: string;
  method: string;
  url: string;
  cleanPath?: string;
  queryParams?: Record<string, string>;
  payload: string;
  createdAt: string;
}

interface SwaggerDoc {
  id: string;
  title: string;
  spec: any;
  createdAt: string;
}

export default function DevToolsMockEnginePage() {
  const [activeTab, setActiveTab] = useState<'manual' | 'swagger'>('manual');

  // Quick Smart URL Paste
  const [smartPasteInput, setSmartPasteInput] = useState<string>('');

  // Manual Mock Form state
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  const [urlRoute, setUrlRoute] = useState<string>(
    'winthor/integracao/fulfillment/v1/layout/resolverUrlsRotasWta?integracao=pdvsync&tipoLote=true'
  );
  const [responsePayload, setResponsePayload] = useState<string>(
    JSON.stringify(
      [
        {
          descricaoRota: 'WTA - Buscar Clientes',
          tipo: '0',
          url: 'http://localhost:9090/api/wholesale/v1/customer/list?pageSize=25&page=1&lastChange=2026-07-13T10:04:42&ignoreClientPDVOmni=true',
        },
        {
          descricaoRota: 'WTA - Buscar Produto PDV',
          tipo: '12',
          url: 'http://localhost:9090/winthor/tributacao/v0/saida/produtotributacao/consultar?pageSize=1000&page=1&filial=1,2,3&dataUltimaAlteracao=1899-12-31T23:55:12&dataExclusao=2026-05-14T10:48:49&revenda=true&tipoMercadoria=CB,KT,L,PA,TM',
        },
      ],
      null,
      2
    )
  );

  // Swagger Spec Form state
  const [swaggerTitle, setSwaggerTitle] = useState<string>('API Exemplo Winthor / WTA');
  const [swaggerPayload, setSwaggerPayload] = useState<string>(
    JSON.stringify(
      {
        openapi: '3.0.0',
        info: {
          title: 'API de Testes Winthor Fulfillment',
          version: '1.0.0',
        },
        paths: {
          '/winthor/integracao/fulfillment/v1/layout/resolverUrlsRotasWta': {
            get: {
              summary: 'Resolver URLs e Rotas WTA',
              responses: {
                '200': {
                  description: 'Lista de rotas WTA mapeadas',
                  content: {
                    'application/json': {
                      example: [
                        {
                          descricaoRota: 'WTA - Buscar Clientes',
                          tipo: '0',
                          url: 'http://localhost:9090/api/wholesale/v1/customer/list',
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
      null,
      2
    )
  );

  // Lists from memory
  const [customMocks, setCustomMocks] = useState<CustomMock[]>([]);
  const [swaggerDocs, setSwaggerDocs] = useState<SwaggerDoc[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Tester state
  const [testUrl, setTestUrl] = useState<string>(
    'winthor/integracao/fulfillment/v1/layout/resolverUrlsRotasWta?integracao=pdvsync&tipoLote=true'
  );
  const [testMethod, setTestMethod] = useState<string>('GET');
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testStatus, setTestStatus] = useState<number | null>(null);
  const [testing, setTesting] = useState<boolean>(false);

  // Chaos Simulator State
  const [statusCode, setStatusCode] = useState<number>(200);
  const [delay, setDelay] = useState<number>(0);

  // Dynamic origin for UI display
  const [currentOrigin, setCurrentOrigin] = useState<string>('http://localhost:9002');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);
    }
  }, []);

  // Format JSON Action
  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(responsePayload);
      setResponsePayload(JSON.stringify(parsed, null, 2));
      toast.success('JSON formatado com sucesso!');
    } catch {
      toast.error('O payload atual não é um JSON válido para formatação.');
    }
  };

  // Parse smart cURL or full Postman URL
  const handleSmartParse = () => {
    if (!smartPasteInput.trim()) return;

    let input = smartPasteInput.trim();

    // Check method
    const methodMatch = input.match(/^(GET|POST|PUT|DELETE|PATCH)\s+/i);
    if (methodMatch) {
      setMethod(methodMatch[1].toUpperCase() as any);
      input = input.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/i, '');
    }

    setUrlRoute(input);
    setTestUrl(input);
    toast.success('URL e método extraídos com sucesso!');
  };

  // Fetch active mocks from global Node state
  const fetchMockConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mock-config');
      if (res.ok) {
        const data = await res.json();
        setCustomMocks(data.customMocks || []);
        setSwaggerDocs(data.swaggerDocs || []);
      }
    } catch {
      toast.error('Erro ao carregar configurações do motor de mock.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMockConfigs();
  }, [fetchMockConfigs]);

  // Handle Save Manual Mock
  const handleSaveManualMock = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!urlRoute.trim()) {
      toast.error('Informe a URL ou rota para salvar o mock.');
      return;
    }

    // Auto-detect method if user pasted "GET http://..." into the URL input
    let selectedMethod = method;
    let targetUrl = urlRoute.trim();
    const methodMatch = targetUrl.match(/^(GET|POST|PUT|DELETE|PATCH)\s+/i);
    if (methodMatch) {
      selectedMethod = methodMatch[1].toUpperCase() as any;
      setMethod(selectedMethod);
      targetUrl = targetUrl.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/i, '');
      setUrlRoute(targetUrl);
    }

    try {
      JSON.parse(responsePayload);
    } catch {
      toast.error('O payload informado contém erro de sintaxe JSON.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/mock-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'manual',
          mock: {
            method: selectedMethod,
            url: targetUrl,
            payload: responsePayload,
            status: statusCode,
            delay: delay,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Mock Local salvo na memória Node!');
        setCustomMocks(data.customMocks || []);
        setTestUrl(targetUrl);
        setTestMethod(selectedMethod);
      } else {
        toast.error(data.error || 'Falha ao salvar mock manual.');
      }
    } catch {
      toast.error('Erro de conexão ao salvar mock.');
    } finally {
      setSaving(false);
    }
  };

  // Handle Save Swagger Spec
  const handleSaveSwaggerSpec = async (e: React.FormEvent) => {
    e.preventDefault();

    let parsedSpec: any;
    try {
      parsedSpec = JSON.parse(swaggerPayload);
    } catch {
      toast.error('A especificação Swagger deve ser um JSON válido.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/mock-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'swagger',
          swagger: {
            title: swaggerTitle,
            spec: parsedSpec,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Contrato Swagger registrado com sucesso!');
        setSwaggerDocs(data.swaggerDocs || []);
      } else {
        toast.error(data.error || 'Falha ao registrar Swagger.');
      }
    } catch {
      toast.error('Erro de conexão ao salvar Swagger.');
    } finally {
      setSaving(false);
    }
  };

  // Handle Delete Item
  const handleDeleteMock = async (id: string, type: 'manual' | 'swagger') => {
    try {
      const res = await fetch(`/api/mock-config?id=${id}&type=${type}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Mock removido da memória local.');
        if (type === 'manual') setCustomMocks(data.customMocks || []);
        else setSwaggerDocs(data.swaggerDocs || []);
      } else {
        toast.error(data.error || 'Erro ao remover mock.');
      }
    } catch {
      toast.error('Erro ao conectar com a API de remoção.');
    }
  };

  // Handle Test Route Dispatch
  const handleTestMockRoute = async (
    targetUrl?: string,
    targetMethod?: string
  ) => {
    const rawRouteToCall = targetUrl || testUrl;
    const methodToCall = targetMethod || testMethod;

    if (!rawRouteToCall) {
      toast.error('Defina uma URL para testar.');
      return;
    }

    setTesting(true);
    setTestResponse(null);
    setTestStatus(null);

    // Clean leading method/protocol/host
    let cleanRoute = rawRouteToCall.trim();
    cleanRoute = cleanRoute.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/i, '');
    cleanRoute = cleanRoute.replace(/^https?:\/\/[^/]+/i, '');
    cleanRoute = cleanRoute.replace(/^https?:\/\/\{\{[^}]+\}\}(?::\{\{[^}]+\}\})?/i, '');
    cleanRoute = cleanRoute.replace(/^\{\{[^}]+\}\}(?::\{\{[^}]+\}\})?/i, '');
    cleanRoute = cleanRoute.replace(/^\/+/, '');

    const endpoint = `/api/mock/${cleanRoute}`;

    try {
      const res = await fetch(endpoint, { method: methodToCall });
      setTestStatus(res.status);
      const data = await res.json();
      setTestResponse(data);

      if (res.ok) {
        toast.success(`Resposta ${res.status} recebida do Motor de Mock!`);
      } else {
        toast.warning(`Retorno ${res.status}: Rota não encontrada no motor.`);
      }
    } catch (err: any) {
      setTestStatus(500);
      setTestResponse({ error: err.message || 'Erro ao executar chamada' });
      toast.error('Erro ao efetuar requisição de teste.');
    } finally {
      setTesting(false);
    }
  };

  const getBadgeVariant = (m: string) => {
    switch (m.toUpperCase()) {
      case 'GET':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'POST':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'PUT':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'DELETE':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col w-full bg-background text-foreground overflow-hidden">
      {/* BARRA SUPERIOR COMPACTA */}
      <header className="h-14 px-6 flex items-center justify-between border-b border-border bg-card/40 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500">
            <Database className="h-4.5 w-4.5" />
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm font-bold tracking-tight text-foreground">
              Motor de Mock API
            </h1>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[9px] uppercase font-black tracking-widest px-2 py-0.5">
              Híbrido + Query Params
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMockConfigs}
            disabled={loading}
            className="h-8 text-xs font-semibold rounded-lg border-border hover:bg-accent"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar Memória
          </Button>
        </div>
      </header>

      {/* ÁREA DE CONTEÚDO COM ROLAGEM */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin">
        {/* SMART PARSER QUICK BAR */}
        <Card className="bg-card border-border/80 shadow-sm rounded-xl p-3.5">
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="flex items-center gap-2 text-blue-500 font-bold text-xs shrink-0">
              <Wand2 className="h-4 w-4" />
              Parser Rápido Postman / cURL:
            </div>
            <Input
              placeholder="Cole aqui: GET http://{{host}}:{{port}}/winthor/integracao/fulfillment/v1/layout/resolverUrlsRotasWta?integracao=pdvsync&tipoLote=true"
              value={smartPasteInput}
              onChange={(e) => setSmartPasteInput(e.target.value)}
              className="bg-background border-input text-xs font-mono rounded-lg flex-1"
            />
            <Button
              size="sm"
              onClick={handleSmartParse}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs shrink-0 h-9"
            >
              Preencher Formulário
            </Button>
          </div>
        </Card>

        {/* CONTAINER PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* FORMULÁRIO DE CONFIGURAÇÃO E LISTA */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="bg-card border-border/80 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Sparkles className="h-4.5 w-4.5 text-blue-500" />
                  Passo 1: Configurar e Salvar Mock Local
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  O motor aceita URLs completas do Postman (incluindo {'http://{{host}}:{{port}}'} e query params) e faz a limpeza automática.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5">
                <Tabs
                  defaultValue="manual"
                  value={activeTab}
                  onValueChange={(val) => setActiveTab(val as 'manual' | 'swagger')}
                  className="w-full space-y-5"
                >
                  <TabsList className="grid grid-cols-2 bg-muted/60 p-1 rounded-lg border border-border/50">
                    <TabsTrigger
                      value="manual"
                      className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm font-bold text-xs rounded-md transition-all"
                    >
                      <Layers className="h-3.5 w-3.5 mr-1.5" />
                      Mocks Manuais
                    </TabsTrigger>
                    <TabsTrigger
                      value="swagger"
                      className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm font-bold text-xs rounded-md transition-all"
                    >
                      <FileCode className="h-3.5 w-3.5 mr-1.5" />
                      Contratos Swagger
                    </TabsTrigger>
                  </TabsList>

                  {/* ABA 1: MOCKS MANUAIS */}
                  <TabsContent value="manual" className="space-y-4">
                    <form onSubmit={handleSaveManualMock} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Método */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Método HTTP
                          </label>
                          <Select
                            value={method}
                            onValueChange={(val: any) => setMethod(val)}
                          >
                            <SelectTrigger className="bg-background border-input rounded-lg font-bold">
                              <SelectValue placeholder="Selecione o método" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="GET" className="font-bold text-emerald-500">
                                GET
                              </SelectItem>
                              <SelectItem value="POST" className="font-bold text-blue-500">
                                POST
                              </SelectItem>
                              <SelectItem value="PUT" className="font-bold text-amber-500">
                                PUT
                              </SelectItem>
                              <SelectItem value="DELETE" className="font-bold text-rose-500">
                                DELETE
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* URL da Rota */}
                        <div className="sm:col-span-2 space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            URL da Rota (Aceita Query Params e Host)
                          </label>
                          <Input
                            placeholder="ex: winthor/integracao/fulfillment/v1/layout/resolverUrlsRotasWta?integracao=pdvsync"
                            value={urlRoute}
                            onChange={(e) => setUrlRoute(e.target.value)}
                            className="bg-background border-input rounded-lg font-mono text-xs"
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Dica: Se você colar a URL completa, o motor limpará o domínio para você.
                          </p>
                        </div>
                      </div>

                      {/* Simulador de Caos (Status & Delay) */}
                      <div className="grid grid-cols-2 gap-4 bg-muted/40 p-3 rounded-lg border border-border/60">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Status Code
                          </label>
                          <Select
                            value={String(statusCode)}
                            onValueChange={(val) => setStatusCode(Number(val))}
                          >
                            <SelectTrigger className="bg-background border-input rounded-lg font-bold h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="200" className="text-emerald-500 font-bold">200 OK</SelectItem>
                              <SelectItem value="201" className="text-emerald-500 font-bold">201 Created</SelectItem>
                              <SelectItem value="400" className="text-amber-500 font-bold">400 Bad Req</SelectItem>
                              <SelectItem value="401" className="text-amber-500 font-bold">401 Unauth</SelectItem>
                              <SelectItem value="404" className="text-amber-500 font-bold">404 Not Found</SelectItem>
                              <SelectItem value="500" className="text-rose-500 font-bold">500 Server Err</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex justify-between">
                            <span>Delay (ms)</span>
                            <span className="text-[10px] text-muted-foreground normal-case font-normal">(Simular lentidão)</span>
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="100"
                            value={delay}
                            onChange={(e) => setDelay(Number(e.target.value) || 0)}
                            className="bg-background border-input rounded-lg font-mono text-xs h-9"
                          />
                        </div>
                      </div>

                      {/* Payload de Resposta */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Payload de Resposta (JSON Puro)
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleFormatJson}
                            className="h-6 text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded px-2"
                          >
                            <Wand2 className="h-3 w-3 mr-1" />
                            Formatar JSON
                          </Button>
                        </div>
                        <Textarea
                          rows={8}
                          placeholder='[{"descricaoRota": "WTA - Buscar Clientes", "tipo": "0"}]'
                          value={responsePayload}
                          onChange={(e) => setResponsePayload(e.target.value)}
                          className="bg-background border-input rounded-lg font-mono text-xs leading-relaxed p-3.5 text-emerald-600 dark:text-emerald-400"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-10 rounded-lg shadow-sm transition-all"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Salvar Mock Local
                      </Button>
                    </form>
                  </TabsContent>

                  {/* ABA 2: CONTRATOS SWAGGER */}
                  <TabsContent value="swagger" className="space-y-4">
                    <form onSubmit={handleSaveSwaggerSpec} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Nome do Contrato
                        </label>
                        <Input
                          placeholder="ex: API Winthor Fulfillment"
                          value={swaggerTitle}
                          onChange={(e) => setSwaggerTitle(e.target.value)}
                          className="bg-background border-input rounded-lg"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Especificação OpenAPI / Swagger (JSON)
                        </label>
                        <Textarea
                          rows={8}
                          placeholder="Cole o JSON da sua especificação OpenAPI/Swagger aqui..."
                          value={swaggerPayload}
                          onChange={(e) => setSwaggerPayload(e.target.value)}
                          className="bg-background border-input rounded-lg font-mono text-xs leading-relaxed p-3.5"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 rounded-lg shadow-sm transition-all"
                      >
                        <FileCode className="h-4 w-4 mr-2" />
                        Salvar Contrato Swagger
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* LISTA DE MOCKS EM MEMÓRIA */}
            <Card className="bg-card border-border/80 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="border-b border-border/60 bg-muted/20 pb-3">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Code2 className="h-4.5 w-4.5 text-blue-500" />
                    Mocks na Memória Local
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {customMocks.length} Manuais | {swaggerDocs.length} Swaggers
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {customMocks.length === 0 && swaggerDocs.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground space-y-2">
                    <AlertCircle className="h-6 w-6 mx-auto opacity-50" />
                    <p className="text-xs">Nenhum mock cadastrado na memória local.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                    {/* Manual Mocks */}
                    {customMocks.map((mock) => (
                      <div
                        key={mock.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 hover:border-blue-500/40 transition-all group"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <Badge className={`font-mono text-[10px] font-bold ${getBadgeVariant(mock.method)}`}>
                            {mock.method}
                          </Badge>
                          <div className="flex flex-col overflow-hidden">
                            <span className="font-mono text-xs text-foreground truncate">
                              /api/mock/{mock.cleanPath || mock.url}
                            </span>
                            {mock.url.includes('?') && (
                              <span className="font-mono text-[10px] text-blue-500 truncate">
                                ?{mock.url.split('?')[1]}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleTestMockRoute(mock.url, mock.method)}
                            className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 rounded-md"
                            title="Testar este mock"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteMock(mock.id, 'manual')}
                            className="h-7 w-7 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-md"
                            title="Excluir mock"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {/* Swagger Docs */}
                    {swaggerDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/20 hover:border-indigo-500/40 transition-all"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-bold text-[9px]">
                            SWAGGER
                          </Badge>
                          <span className="font-sans text-xs font-medium text-foreground truncate">
                            {doc.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteMock(doc.id, 'swagger')}
                            className="h-7 w-7 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-md"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* PAINEL DE TESTE INTERATIVO */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="bg-card border-border/80 shadow-sm rounded-xl overflow-hidden sticky top-6">
              <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Play className="h-4.5 w-4.5 text-emerald-500" />
                  Passo 2: Consumir / Testar o Interceptador
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Para sua outra API consumir o mock, substitua o domínio original por <code className="text-blue-500 bg-blue-500/10 px-1 py-0.5 rounded border border-blue-500/20">{currentOrigin}/api/mock/</code>
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Rota para Testar
                  </label>
                  <div className="flex gap-2">
                    <Select
                      value={testMethod}
                      onValueChange={(val) => setTestMethod(val)}
                    >
                      <SelectTrigger className="w-[100px] bg-background border-input font-bold rounded-lg text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      placeholder="winthor/integracao/fulfillment/v1/layout/resolverUrlsRotasWta?integracao=pdvsync&tipoLote=true"
                      value={testUrl}
                      onChange={(e) => setTestUrl(e.target.value)}
                      className="bg-background border-input rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>

                {/* ENDEREÇO PARA OUTRA API CONSUMIR */}
                <div className="bg-blue-500/5 border border-blue-500/20 p-3 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      Sua API deve fazer um {testMethod} para:
                    </label>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const clean = testUrl.trim().replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/i, '').replace(/^https?:\/\/[^/]+/i, '').replace(/^https?:\/\/\{\{[^}]+\}\}(?::\{\{[^}]+\}\})?/i, '').replace(/^\{\{[^}]+\}\}(?::\{\{[^}]+\}\})?/i, '').replace(/^\/+/, '');
                        navigator.clipboard.writeText(`${currentOrigin}/api/mock/${clean}`);
                        toast.success('URL de consumo copiada!');
                      }}
                      className="h-6 w-6 text-blue-500 hover:text-blue-600 hover:bg-blue-500/20 rounded-md"
                      title="Copiar URL Final"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <code className="block w-full text-xs text-foreground font-mono bg-background p-2 rounded border border-border whitespace-nowrap overflow-x-auto scrollbar-thin select-all">
                    {currentOrigin}/api/mock/{testUrl.trim().replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/i, '').replace(/^https?:\/\/[^/]+/i, '').replace(/^https?:\/\/\{\{[^}]+\}\}(?::\{\{[^}]+\}\})?/i, '').replace(/^\{\{[^}]+\}\}(?::\{\{[^}]+\}\})?/i, '').replace(/^\/+/, '')}
                  </code>
                </div>

                <Button
                  onClick={() => handleTestMockRoute()}
                  disabled={testing}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 rounded-lg shadow-sm transition-all"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Disparar Requisição Mock
                </Button>

                {/* RESULTADO DO TESTE */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Resposta HTTP
                    </label>
                    {testStatus !== null && (
                      <Badge
                        variant="outline"
                        className={
                          testStatus === 200
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-mono text-[10px]'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-mono text-[10px]'
                        }
                      >
                        Status: {testStatus}
                      </Badge>
                    )}
                  </div>

                  <div className="relative">
                    <pre className="bg-slate-950 text-emerald-400 border border-slate-800 rounded-lg p-3.5 text-xs font-mono overflow-x-auto min-h-[200px] max-h-[320px]">
                      {testing ? (
                        <span className="text-slate-400 italic">Enviando requisição...</span>
                      ) : testResponse !== null ? (
                        JSON.stringify(testResponse, null, 2)
                      ) : (
                        <span className="text-slate-500 italic">
                          Clique em &quot;Disparar Requisição Mock&quot; para visualizar a resposta.
                        </span>
                      )}
                    </pre>

                    {testResponse && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            JSON.stringify(testResponse, null, 2)
                          );
                          toast.success('Resposta copiada para a área de transferência!');
                        }}
                        className="absolute top-2 right-2 h-7 w-7 text-slate-400 hover:text-white bg-slate-900/80 rounded-md"
                        title="Copiar JSON"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
