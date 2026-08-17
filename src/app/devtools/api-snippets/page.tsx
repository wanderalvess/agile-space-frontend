'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Code2,
  Plus, 
  Trash2, 
  Copy, 
  Eraser, 
  Terminal,
  FileCode,
  Braces,
  Import,
  HelpCircle,
  Info,
  Globe,
  Settings2,
  Search,
  AlertTriangle,
  Zap,
  Cpu,
  MousePointerSquareDashed,
  FileText,
  Sparkles
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useUserContext } from '@/context/UserContext';
import { Editor } from '@monaco-editor/react';

interface KeyValuePair {
  key: string;
  value: string;
  id: string;
}

export default function ApiSnippetsPage() {
  const { toast } = useToast();
  const { userProfile } = useUserContext();
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [queryParams, setQueryParams] = useState<KeyValuePair[]>([{ key: '', value: '', id: 'q1' }]);
  const [headers, setHeaders] = useState<KeyValuePair[]>([{ key: 'Content-Type', value: 'application/json', id: 'h1' }]);
  const [body, setBody] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [curlInput, setCurlInput] = useState('');

  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '', id: Math.random().toString(36).substr(2, 9) }]);
  };

  const removeHeader = (id: string) => {
    setHeaders(headers.filter(h => h.id !== id));
  };

  const updateHeader = (id: string, field: 'key' | 'value', val: string) => {
    setHeaders(headers.map(h => h.id === id ? { ...h, [field]: val } : h));
  };

  const addQueryParam = () => {
    setQueryParams([...queryParams, { key: '', value: '', id: Math.random().toString(36).substr(2, 9) }]);
  };

  const removeQueryParam = (id: string) => {
    setQueryParams(queryParams.filter(q => q.id !== id));
  };

  const updateQueryParam = (id: string, field: 'key' | 'value', val: string) => {
    setQueryParams(queryParams.map(q => q.id === id ? { ...q, [field]: val } : q));
  };

  const parseCurlCommand = (curlString: string) => {
    if (!curlString.trim()) return;
    try {
      const cleanCurl = curlString.replace(/\\\n/g, ' ').replace(/\\\r/g, ' ');
      let extractedMethod = 'GET';
      let extractedUrl = '';
      const postmanMatch = cleanCurl.match(/(?:postman\s+request\s+)?([A-Z]+)\s+['"](https?:\/\/[^\s"']+)['"]/i);
      if (postmanMatch) {
        extractedMethod = postmanMatch[1].toUpperCase();
        extractedUrl = postmanMatch[2];
      } else {
        const urlMatch = cleanCurl.match(/(https?:\/\/[^\s"']+)/i);
        if (urlMatch) extractedUrl = urlMatch[1];
        const methodMatch = cleanCurl.match(/(?:-X|--request)\s+([A-Z]+)/i);
        if (methodMatch) extractedMethod = methodMatch[1].toUpperCase();
        else if (cleanCurl.includes('-d ') || cleanCurl.includes('--data')) extractedMethod = 'POST';
      }
      if (!extractedUrl) {
        toast({ title: "Erro na importação", description: "Comando inválido.", variant: "destructive" });
        return;
      }
      const extractedQueryParams: KeyValuePair[] = [];
      try {
        const urlObj = new URL(extractedUrl);
        urlObj.searchParams.forEach((value, key) => {
          extractedQueryParams.push({ key, value, id: Math.random().toString(36).substr(2, 9) });
        });
        setUrl(urlObj.origin + urlObj.pathname);
      } catch (e) {
        setUrl(extractedUrl);
      }
      const extractedHeaders: KeyValuePair[] = [];
      const headerRegex = /(?:-H|--header)\s+(['"])([^:]+):\s*(.+?)\1/g;
      let match;
      while ((match = headerRegex.exec(cleanCurl)) !== null) {
        extractedHeaders.push({ key: match[2].trim(), value: match[3].trim(), id: Math.random().toString(36).substr(2, 9) });
      }
      let extractedBody = '';
      const bodyMatch = cleanCurl.match(/(?:-d|--data|--data-raw|--body)\s+(['"])([\s\S]*?)\1/);
      if (bodyMatch) {
        const rawBody = bodyMatch[2];
        try {
          extractedBody = JSON.stringify(JSON.parse(rawBody), null, 2);
        } catch (e) {
          extractedBody = rawBody;
        }
      }
      setMethod(extractedMethod);
      if (extractedQueryParams.length > 0) setQueryParams(extractedQueryParams);
      if (extractedHeaders.length > 0) setHeaders(extractedHeaders);
      setBody(extractedBody);
      toast({ title: "cURL Importado!" });
      setIsImportModalOpen(false);
      setCurlInput('');
    } catch (e) {
      toast({ title: "Erro no parse", description: "Verifique o comando cURL.", variant: "destructive" });
    }
  };

  const fullUrl = useMemo(() => {
    let base = url.trim() || 'https://api.example.com/v1/resource';
    base = base.replace(/[?&]$/, '');
    const params = new URLSearchParams();
    queryParams.forEach(p => { if (p.key.trim()) params.append(p.key.trim(), p.value); });
    const queryString = params.toString();
    if (!queryString) return base;
    return base.includes('?') ? `${base}&${queryString}` : `${base}?${queryString}`;
  }, [url, queryParams]);

  const headersObj = useMemo(() => {
    return headers.reduce((acc, h) => {
      if (h.key.trim()) acc[h.key.trim()] = h.value;
      return acc;
    }, {} as Record<string, string>);
  }, [headers]);

  const snippets = useMemo(() => {
    const targetUrl = fullUrl;
    const cleanBody = body.trim();
    const hasBody = cleanBody && method !== 'GET' && method !== 'HEAD';
    let curl = `curl -X ${method} "${targetUrl}"`;
    Object.entries(headersObj).forEach(([k, v]) => { curl += ` \\\n  -H "${k}: ${v}"`; });
    if (hasBody) {
      const escapedBody = cleanBody.replace(/'/g, "'\\''");
      curl += ` \\\n  -d '${escapedBody}'`;
    }
    const fetchSnippet = `fetch("${targetUrl}", {
  method: "${method}",
  headers: ${JSON.stringify(headersObj, null, 2)}${hasBody ? `,
  body: JSON.stringify(${cleanBody})` : ''}
})`;
    return { curl, fetchSnippet };
  }, [method, fullUrl, headersObj, body]);

  const handleCopy = async (text: string, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado!", description: `${label} copiado.` });
    } catch (e) {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const handleClear = () => {
    setUrl('');
    setBody('');
    setHeaders([{ key: 'Content-Type', value: 'application/json', id: 'h1' }]);
    setQueryParams([{ key: '', value: '', id: 'q1' }]);
    toast({ title: "Campos limpos" });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TooltipProvider>
        <header className="flex items-center justify-between px-6 py-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Code2 className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold leading-none">Gerador de Snippets HTTP</h1>
              <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-widest">ACELERADOR DE INTEGRAÇÃO PROFISSIONAL</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {userProfile?.isGuest && (
              <Badge variant="outline" className="hidden lg:flex items-center gap-1.5 h-8 px-3 bg-amber-500/5 text-amber-600 border-amber-500/20 text-[10px] font-bold">
                <AlertTriangle className="h-3.5 w-3.5" />
                CONVIDADO
              </Badge>
            )}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 px-4 font-black text-[9px] uppercase tracking-widest gap-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all rounded-xl">
                  <HelpCircle className="h-4 w-4" />
                  GUIA
                </Button>
              </SheetTrigger>
              <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col p-0 border-none shadow-2xl">
                <SheetHeader className="shrink-0 border-b p-8 bg-white">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
                    <Terminal className="h-6 w-6 text-white" />
                  </div>
                  <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-slate-800">
                    Snippets de Requisição
                  </SheetTitle>
                  <SheetDescription className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2 leading-relaxed">
                    Toolkit de aceleração para integração e modelagem de requisições
                  </SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>

            <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(true)} className="h-9 px-4 font-bold text-[10px] uppercase tracking-widest gap-2 rounded-xl border-dashed border-2 hover:border-blue-500 hover:text-blue-600 transition-all">
              <Import className="h-4 w-4" />
              IMPORTAR cURL
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            <Button variant="ghost" size="icon" onClick={handleClear} className="h-9 w-9 text-muted-foreground hover:text-primary transition-all rounded-xl">
              <Eraser className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="flex-1 flex p-4 gap-4 bg-muted/10 overflow-hidden">
          <Card className="flex-1 flex flex-col rounded-xl border-border/50 shadow-sm overflow-hidden bg-card">
            <div className="p-3 border-b bg-muted/30 flex items-center gap-2 shrink-0">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="w-[100px] h-9 font-black bg-background border-none text-[10px] uppercase tracking-widest rounded-xl px-4 shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET" className="font-bold text-blue-600">GET</SelectItem>
                  <SelectItem value="POST" className="font-bold text-green-600">POST</SelectItem>
                  <SelectItem value="PUT" className="font-bold text-amber-600">PUT</SelectItem>
                  <SelectItem value="DELETE" className="font-bold text-red-600">DELETE</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="URL da API..." value={url} onChange={(e) => setUrl(e.target.value)} className="flex-1 h-9 bg-background border-none text-xs font-mono shadow-sm rounded-xl placeholder:text-slate-300" />
            </div>
            <Tabs defaultValue="params" className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 border-b bg-muted/10">
                <TabsList className="h-10 bg-transparent gap-6 p-0">
                  <TabsTrigger value="params" className="h-10 font-black text-[9px] uppercase tracking-[0.2em] data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none shadow-none">Params</TabsTrigger>
                  <TabsTrigger value="headers" className="h-10 font-black text-[9px] uppercase tracking-[0.2em] data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none shadow-none">Headers</TabsTrigger>
                  <TabsTrigger value="body" className="h-10 font-black text-[9px] uppercase tracking-[0.2em] data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none shadow-none">Body</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="params" className="flex-1 overflow-auto p-4 m-0 space-y-3">
                {queryParams.map((q) => (
                  <div key={q.id} className="flex gap-2">
                    <Input placeholder="Key" value={q.key} onChange={(e) => updateQueryParam(q.id, 'key', e.target.value)} className="h-9 text-[10px] font-bold uppercase tracking-widest rounded-xl bg-background border-none shadow-sm" />
                    <Input placeholder="Value" value={q.value} onChange={(e) => updateQueryParam(q.id, 'value', e.target.value)} className="h-9 text-[10px] font-mono rounded-xl bg-background border-none shadow-sm" />
                    <Button variant="ghost" size="icon" onClick={() => removeQueryParam(q.id)} className="h-9 w-9 text-slate-300 hover:text-destructive transition-all rounded-xl"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addQueryParam} className="w-full border-dashed border-2 rounded-xl text-[9px] font-black uppercase tracking-widest h-9 hover:bg-slate-50 transition-all">ADICIONAR PARAM</Button>
              </TabsContent>
              <TabsContent value="headers" className="flex-1 overflow-auto p-4 m-0 space-y-3">
                {headers.map((h) => (
                  <div key={h.id} className="flex gap-2">
                    <Input placeholder="Key" value={h.key} onChange={(e) => updateHeader(h.id, 'key', e.target.value)} className="h-9 text-[10px] font-bold uppercase tracking-widest rounded-xl bg-background border-none shadow-sm" />
                    <Input placeholder="Value" value={h.value} onChange={(e) => updateHeader(h.id, 'value', e.target.value)} className="h-9 text-[10px] font-mono rounded-xl bg-background border-none shadow-sm" />
                    <Button variant="ghost" size="icon" onClick={() => removeHeader(h.id)} className="h-9 w-9 text-slate-300 hover:text-destructive transition-all rounded-xl"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addHeader} className="w-full border-dashed border-2 rounded-xl text-[9px] font-black uppercase tracking-widest h-9 hover:bg-slate-50 transition-all">ADICIONAR HEADER</Button>
              </TabsContent>
              <TabsContent value="body" className="flex-1 m-0 relative bg-[#1e1e1e]">
                <Editor
                  height="100%"
                  language="json"
                  theme="vs-dark"
                  value={body}
                  onChange={(val) => setBody(val || '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 11,
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    wordWrap: 'on',
                    automaticLayout: true,
                    padding: { top: 12, bottom: 12 },
                    scrollBeyondLastLine: false,
                  }}
                />
              </TabsContent>
            </Tabs>
          </Card>

          <Card className="flex-1 flex flex-col rounded-xl border-border/50 shadow-sm overflow-hidden bg-zinc-950">
            <Tabs defaultValue="curl" className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 border-b border-white/5 bg-white/5">
                <TabsList className="h-10 bg-transparent gap-6 p-0">
                  <TabsTrigger value="curl" className="h-10 font-black text-[9px] uppercase tracking-[0.2em] text-zinc-500 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none shadow-none">cURL</TabsTrigger>
                  <TabsTrigger value="fetch" className="h-10 font-black text-[9px] uppercase tracking-[0.2em] text-zinc-500 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 rounded-none shadow-none">Fetch</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="curl" className="flex-1 m-0 relative">
                <div className="absolute top-4 right-4 z-10"><Button size="sm" onClick={() => handleCopy(snippets.curl, 'cURL')} className="h-8 px-4 text-[9px] font-black uppercase tracking-widest bg-white/10 hover:bg-white/20 text-white border-white/10 rounded-xl backdrop-blur-md">COPIAR</Button></div>
                <pre className="absolute inset-0 p-8 font-mono text-[11px] text-blue-400 overflow-auto selection:bg-blue-500/30 selection:text-white"><code>{snippets.curl}</code></pre>
              </TabsContent>
              <TabsContent value="fetch" className="flex-1 m-0 relative">
                <div className="absolute top-4 right-4 z-10"><Button size="sm" onClick={() => handleCopy(snippets.fetchSnippet, 'Fetch')} className="h-8 px-4 text-[9px] font-black uppercase tracking-widest bg-white/10 hover:bg-white/20 text-white border-white/10 rounded-xl backdrop-blur-md">COPIAR</Button></div>
                <pre className="absolute inset-0 p-8 font-mono text-[11px] text-emerald-400 overflow-auto selection:bg-emerald-500/30 selection:text-white"><code>{snippets.fetchSnippet}</code></pre>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
          <DialogContent className="sm:max-w-[640px] rounded-2xl border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Importar cURL</DialogTitle>
              <DialogDescription className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-1">Cole um comando cURL bruto para parse automático</DialogDescription>
            </DialogHeader>
            <Textarea placeholder="curl -X POST 'https://api...'" value={curlInput} onChange={(e) => setCurlInput(e.target.value)} className="min-h-[240px] font-mono text-xs bg-slate-50 border-none rounded-2xl p-6 focus-visible:ring-1 focus-visible:ring-blue-500 transition-all" />
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setIsImportModalOpen(false)} className="rounded-xl font-black uppercase text-[10px] tracking-widest">CANCELAR</Button>
              <Button onClick={() => parseCurlCommand(curlInput)} className="rounded-xl font-black uppercase text-[10px] tracking-widest bg-slate-900 hover:bg-blue-600 transition-all px-8">IMPORTAR_ENGINE</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    </div>
  );
}
