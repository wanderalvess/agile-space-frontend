'use client';

import React, { useState, useEffect } from 'react';
import { Globe, Copy, Check, RefreshCw, MapPin, Building2, Flag, Navigation, ShieldAlert, HelpCircle, Info, ShieldCheck, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
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

interface IPData {
  ip: string;
  city: string;
  region: string;
  country_name: string;
  org: string;
  postal: string;
  latitude: number;
  longitude: number;
}

export default function IPAnalyzerPage() {
  const [data, setData] = useState<IPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchIPData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('https://ipapi.co/json/');
      if (!response.ok) throw new Error('Falha ao buscar dados do IP');
      const jsonData = await response.json();
      setData(jsonData);
    } catch (err) {
      setError('Não foi possível carregar os dados de rede. Verifique sua conexão.');
      toast.error('Erro ao buscar dados do IP');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIPData();
  }, []);

  const copyToClipboard = () => {
    if (data?.ip) {
      navigator.clipboard.writeText(data.ip);
      setCopied(true);
      toast.success('IP copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background h-dvh overflow-hidden">
      {/* Standard Header */}
      <header className="px-6 py-4 border-b bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg shadow-lg shadow-primary/20 translate-y-[-1px]">
            <Globe className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold leading-none">Analisador de Conexão e IP</h1>
            <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-widest">DIAGNÓSTICO DE REDE E LOCALIZAÇÃO DE MÁQUINA</p>
          </div>
        </div>

        <div className="flex items-center">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-10 px-4 font-black text-[9px] uppercase tracking-widest gap-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all rounded-xl">
                <HelpCircle className="h-4 w-4" />
                GUIA
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col p-0 border-none shadow-2xl">
              <SheetHeader className="shrink-0 border-b p-8 bg-white">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-slate-800">
                  Analisador de IP
                </SheetTitle>
                <SheetDescription className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2 leading-relaxed">
                  Identificação e geolocalização de rede pública
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-1 text-slate-600">
                <div className="p-8 space-y-10">
                  <div className="space-y-4">
                    <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                      01. O que é o IP Público?
                    </h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      É o endereço exclusivo que identifica sua conexão na internet global. Diferente do IP local da sua rede Wi-Fi, este é o endereço que os servidores (como AWS, Google ou Azure) veem quando você solicita um recurso.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                      02. VPNs e Mascaramento
                    </h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      Se você utiliza ferramentas como <strong>Netskope, Zscaler ou Cloudflare</strong>, a geolocalização mostrada aqui será a do data center da ferramenta, e não a da sua casa. Isso garante que sua navegação esteja protegida e centralizada.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                      03. Privacidade Total
                    </h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      O Espaço Ágil funciona como um pass-through. Nós não registramos, armazenamos ou rastreamos seu endereço IP. A consulta é feita em tempo real e os dados morrem ao fechar esta aba.
                    </p>
                  </div>

                  <div className="space-y-4 p-6 bg-blue-50/50 rounded-[2rem] border border-blue-100">
                    <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                      Uso Profissional
                    </h3>
                    <p className="text-[11px] text-blue-800/80 font-bold leading-relaxed">
                      Utilize esta ferramenta para validar se o seu tráfego está saindo pelo túnel correto antes de tentar acessar bancos de dados ou APIs restritas por firewall de IP.
                    </p>
                  </div>
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <Button 
            onClick={fetchIPData} 
            disabled={loading}
            variant="outline"
            size="sm"
            className="h-9 px-4 font-bold text-[10px] uppercase tracking-widest gap-2 bg-card border-2 shadow-sm hover:bg-muted/50 transition-all"
          >
            <RefreshCw className={loading ? "w-3 h-3 animate-spin" : "w-3 h-3"} />
            Atualizar
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-10 scrollbar-thin scrollbar-thumb-muted">
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
          {/* Main IP Display */}
          <Card className="border-2 shadow-2xl shadow-primary/5 bg-card/10 backdrop-blur-xl overflow-hidden mb-10">
            <div className="p-1 h-2 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />
            <CardContent className="pt-16 pb-16 px-6 md:px-12 flex flex-col items-center">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-6 animate-pulse">
                Seu Endereço de IP Público
              </span>
              
              <div className="flex flex-col md:flex-row items-center justify-center gap-6 w-full group">
                <div className="relative min-h-[220px] flex items-center justify-center">
                  {loading ? (
                    <div className="space-y-4 flex flex-col items-center">
                      <div className="h-16 w-64 bg-primary/10 animate-pulse rounded-2xl" />
                      <div className="h-4 w-32 bg-primary/5 animate-pulse rounded-full" />
                    </div>
                  ) : error ? (
                    <div className="text-rose-500 font-bold bg-rose-500/10 px-8 py-4 rounded-2xl border border-rose-500/20 text-center">
                      {error}
                    </div>
                  ) : (
                    <h2 className="text-5xl md:text-8xl font-black text-foreground tracking-tighter leading-normal drop-shadow-sm transition-all duration-500 group-hover:scale-[1.02]">
                      {data?.ip || '0.0.0.0'}
                    </h2>
                  )}
                </div>

                {!loading && !error && (
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-16 w-16 rounded-2xl border-2 border-primary/20 bg-background hover:bg-primary shadow-xl shadow-primary/10 hover:shadow-primary/30 transition-all group/btn"
                    onClick={copyToClipboard}
                  >
                    {copied ? (
                      <Check className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <Copy className="w-6 h-6 text-primary group-hover/btn:text-white transition-colors" />
                    )}
                  </Button>
                )}
              </div>

              {data?.org && !loading && !error && (
                <div className="mt-8 px-6 py-2 bg-primary/5 border border-primary/10 rounded-full animate-in zoom-in duration-300">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">
                    Provedor: {data.org}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Connection Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <DetailCard 
              label="Provedor (ISP)" 
              value={data?.org} 
              icon={Building2} 
              loading={loading} 
            />
            <DetailCard 
              label="Localização" 
              value={data ? `${data.city}, ${data.region}` : undefined} 
              icon={MapPin} 
              loading={loading} 
            />
            <DetailCard 
              label="País" 
              value={data?.country_name} 
              icon={Flag} 
              loading={loading} 
            />
            <DetailCard 
              label="Coordenadas" 
              value={data ? `${data.latitude}, ${data.longitude}` : undefined} 
              icon={Navigation} 
              loading={loading} 
            />
          </div>

          {/* Corporate VPN / Proxy Alert */}
          {!loading && !error && data && (
            <Card className="border-2 bg-blue-500/5 border-blue-500/10 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
              <CardContent className="p-4 flex gap-4 items-start">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm text-foreground">
                    Por que meu IP pode parecer diferente?
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Se o IP exibido acima pertence a serviços como <strong>Netskope, Zscaler, Cloudflare WARP</strong> ou uma VPN corporativa, significa que o tráfego do seu navegador está sendo roteado com segurança por esses provedores. Para integrações e liberações de firewall na nuvem, este IP mascarado é o que deve ser utilizado, pois é através dele que suas requisições saem para a internet.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && !error && data && (
            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Sua conexão está ativa e segura
                </span>
              </div>
              <span className="text-[10px] font-medium text-muted-foreground italic">
                Dados fornecidos por ipapi.co
              </span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function DetailCard({ label, value, icon: Icon, loading }: { label: string, value?: string, icon: any, loading: boolean }) {
  return (
    <Card className="border-2 bg-card/30 backdrop-blur-sm group hover:border-primary/30 transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
            <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
            {label}
          </span>
        </div>
        
        {loading ? (
          <Skeleton className="h-6 w-3/4 bg-muted/50" />
        ) : (
          <p className="text-lg font-bold text-foreground truncate">
            {value || 'N/A'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
