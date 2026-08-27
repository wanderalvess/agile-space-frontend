'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  ShieldCheck, 
  Lock, 
  Unlock, 
  Clock, 
  User, 
  Server,
  Key,
  Info,
  AlertTriangle,
  ArrowLeft,
  Copy,
  Hash,
  Eye,
  EyeOff,
  SearchCode
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function JwtInspectorPage() {
  const { toast } = useToast();
  const [token, setToken] = useState('');
  const [decoded, setDecoded] = useState<any>({
    header: null,
    payload: null,
    signature: null,
    isValid: false,
    error: null
  });

  useEffect(() => {
    if (!token) {
      setDecoded({ header: null, payload: null, signature: null, isValid: false, error: null });
      return;
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error("Formato JWT Inválido. Deve conter Header, Payload e Signature.");
      }

      const header = JSON.parse(atob(parts[0]));
      const payload = JSON.parse(atob(parts[1]));
      const signature = parts[2];

      setDecoded({
        header,
        payload,
        signature,
        isValid: true,
        error: null
      });
    } catch (e: any) {
      // state is useState<any>; annotate updater param to satisfy noImplicitAny
      setDecoded((prev: any) => ({ ...prev, error: e.message, isValid: false }));
    }
  }, [token]);

  const handleCopy = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    toast({ title: "JSON copiado para a área de transferência!" });
  };

  const isExpired = decoded.payload?.exp ? (Date.now() / 1000) > decoded.payload.exp : false;

  return (
    <div className="flex flex-col h-screen bg-background font-sans overflow-hidden">
      {/* Header */}
      <header className="px-8 py-5 border-b bg-white/60 backdrop-blur-xl flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Link href="/devtools">
            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-slate-400 hover:text-slate-900 transition-all">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex flex-col">
            <h1 className="text-lg font-black italic uppercase tracking-tighter text-slate-800">
              JWT <span className="text-emerald-600">Inspector</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Depurador de Tokens de Autenticação</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="h-6 px-3 text-[9px] font-black uppercase tracking-widest border-emerald-200 text-emerald-600 bg-emerald-50">
            Segurança
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setToken('')}
            className="h-9 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest gap-2 bg-white shadow-sm hover:bg-red-50 border-slate-200 hover:text-red-500"
          >
            Limpar
          </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Token Input Section */}
        <section className="w-[450px] border-r bg-slate-50/30 p-8 flex flex-col gap-6 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
              <Lock className="h-4 w-4" /> Token Encoded
            </h2>
            {decoded.isValid ? (
              <Badge className="bg-emerald-500 text-[8px] uppercase tracking-widest px-2 py-0.5">Válido para Parse</Badge>
            ) : token && (
              <Badge variant="destructive" className="text-[8px] animate-pulse">Formato Inválido</Badge>
            )}
          </div>
          
          <Card className="flex-1 border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white p-6">
            <Textarea 
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Cole seu JWT aqui (eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...)"
              className="w-full h-full resize-none border-none font-mono text-[13px] leading-relaxed break-all focus-visible:ring-0 placeholder:italic"
            />
          </Card>

          <div className="p-5 bg-white border border-slate-100 rounded-[2rem] shadow-sm space-y-3">
             <div className="flex items-center gap-2 text-slate-500">
                <Info className="h-3.5 w-3.5" />
                <span className="text-[9px] font-black uppercase tracking-widest">Sobre o Inspector</span>
             </div>
             <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase tracking-tight">
               Este inspetor realiza o decode local via Base64. A assinatura não é verificada criptograficamente por segurança.
             </p>
          </div>
        </section>

        {/* Decoded Data Section */}
        <section className="flex-1 p-8 overflow-y-auto space-y-8 bg-white">
          {!token ? (
            <div className="h-full flex flex-col items-center justify-center gap-6 opacity-30 select-none">
              <div className="w-32 h-32 rounded-[3.5rem] bg-slate-100 flex items-center justify-center">
                 <SearchCode className="h-16 w-16 text-slate-300" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black uppercase tracking-tighter italic text-slate-400">Aguardando Token</h3>
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Insira um JWT para inspecionar os claims</p>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
              
              {/* Analysis Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard 
                  label="Status" 
                  value={isExpired ? "Expirado" : "Ativo"} 
                  icon={Clock} 
                  color={isExpired ? "text-red-500" : "text-emerald-500"} 
                />
                <SummaryCard 
                  label="Algoritmo" 
                  value={decoded.header?.alg || "---"} 
                  icon={Hash} 
                  color="text-blue-500" 
                />
                <SummaryCard 
                  label="Emissor" 
                  value={decoded.payload?.iss || "Desconhecido"} 
                  icon={Server} 
                  color="text-slate-400" 
                />
              </div>

              {/* Header Section */}
              <div className="space-y-4">
                 <div className="flex items-center justify-between px-2">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2 italic">
                       <div className="w-1.5 h-6 bg-red-500 rounded-full mr-2" />
                       HEADER: <span className="text-slate-400 not-italic">Algorithm & Token Type</span>
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => handleCopy(decoded.header)} className="h-8 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500">
                       <Copy className="h-3 w-3 mr-2" /> Copiar JSON
                    </Button>
                 </div>
                 <CodePane data={decoded.header} color="red" />
              </div>

              {/* Payload Section */}
              <div className="space-y-4">
                 <div className="flex items-center justify-between px-2">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2 italic">
                       <div className="w-1.5 h-6 bg-emerald-500 rounded-full mr-2" />
                       PAYLOAD: <span className="text-slate-400 not-italic">Claims & Data</span>
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => handleCopy(decoded.payload)} className="h-8 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-600">
                       <Copy className="h-3 w-3 mr-2" /> Copiar JSON
                    </Button>
                 </div>
                 <CodePane data={decoded.payload} color="emerald" />
              </div>

              {/* Signature (Redacted) */}
              <div className="space-y-4">
                 <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2 italic px-2">
                    <div className="w-1.5 h-6 bg-blue-500 rounded-full mr-2" />
                    SIGNATURE
                 </h3>
                 <div className="p-8 bg-blue-50/50 rounded-[2.5rem] border-2 border-dashed border-blue-100 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3 text-blue-300">
                       <Unlock className="h-8 w-8" />
                       <span className="text-[10px] font-black uppercase tracking-[0.2em]">Signature parsing not required for display</span>
                    </div>
                 </div>
              </div>

            </div>
          )}
        </section>
      </main>

      {/* Error Toast replacement */}
      {decoded.error && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-500 text-white rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-10 fade-in duration-300">
           <AlertTriangle className="h-4 w-4" />
           <span className="text-[11px] font-black uppercase tracking-widest">{decoded.error}</span>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, color }: { label: string, value: string, icon: any, color: string }) {
  return (
    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center gap-4 transition-all hover:bg-slate-100/50 border-b-4 border-b-slate-200">
       <div className={cn("p-3 bg-white rounded-2xl shadow-sm", color)}>
          <Icon className="h-5 w-5" />
       </div>
       <div className="flex flex-col">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
          <span className={cn("text-sm font-black italic uppercase tracking-tight", color)}>{value}</span>
       </div>
    </div>
  );
}

function CodePane({ data, color }: { data: any, color: 'red' | 'emerald' | 'blue' }) {
  const colors = {
    red: 'bg-red-50/30 text-red-700 selection:bg-red-100',
    emerald: 'bg-emerald-50/30 text-emerald-700 selection:bg-emerald-100',
    blue: 'bg-blue-50/30 text-blue-700 selection:bg-blue-100'
  };

  return (
    <Card className={cn("border-none shadow-inner rounded-[2.5rem] overflow-hidden p-8 font-mono text-xs leading-relaxed", colors[color])}>
       <pre className="overflow-auto max-h-[400px]">
          {JSON.stringify(data, null, 2)}
       </pre>
    </Card>
  );
}
