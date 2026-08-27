'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  MapPin, 
  Search, 
  Copy, 
  ExternalLink, 
  Check, 
  Map as MapIcon, 
  Building2, 
  Hash,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface CepData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

export default function CepToolPage() {
  const { toast } = useToast();
  const [cep, setCep] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CepData | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSearch = async () => {
    const rawCep = cep.replace(/\D/g, '');
    if (rawCep.length !== 8) {
      toast({
        title: "CEP Inválido",
        description: "O CEP deve conter exatamente 8 dígitos.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o número e tente novamente.",
          variant: "destructive"
        });
      } else {
        setResult(data);
      }
    } catch (error) {
      toast({
        title: "Erro de Conexão",
        description: "Não foi possível consultar o ViaCEP agora.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const text = `${result.logradouro}, ${result.bairro}, ${result.localidade} - ${result.uf}, ${result.cep}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Endereço copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

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
              Consulta de <span className="text-orange-600">CEP</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Integração via API ViaCEP</p>
          </div>
        </div>
        <Badge variant="outline" className="h-6 px-3 text-[9px] font-black uppercase tracking-widest border-orange-200 text-orange-600 bg-orange-50">
          Utilidades
        </Badge>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-10 flex flex-col items-center justify-center relative">
        {/* Background blobs */}
        <div className="absolute top-[20%] left-[10%] w-64 h-64 bg-orange-200/20 blur-[100px] rounded-full -z-10" />
        <div className="absolute bottom-[20%] right-[10%] w-64 h-64 bg-blue-200/20 blur-[100px] rounded-full -z-10" />

        <div className="w-full max-w-2xl space-y-6">
          <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[2rem] overflow-hidden bg-white/80 backdrop-blur-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Localizador de Endereço</CardTitle>
              <CardDescription className="text-xs font-semibold text-slate-400">Insira o CEP de 8 dígitos para buscar as informações.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <div className="relative flex-1 group">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-orange-500 transition-colors" />
                  <Input
                    placeholder="00000-000"
                    maxLength={9}
                    value={cep}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, '');
                      if (val.length > 5) val = val.slice(0, 5) + '-' + val.slice(5, 8);
                      setCep(val);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="h-14 pl-12 bg-slate-50/50 border-none rounded-2xl font-mono text-lg font-bold text-slate-700 shadow-inner"
                  />
                </div>
                <Button 
                  onClick={handleSearch} 
                  disabled={loading}
                  className="h-14 px-8 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-orange-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          {result && (
            <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[2rem] overflow-hidden bg-white animate-in zoom-in-95 duration-300">
              <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 shadow-sm shadow-orange-500/10">
                      <MapPin className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black italic uppercase tracking-tighter text-slate-800">{result.localidade} - {result.uf}</h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">CEP Encontrado: {result.cep}</p>
                    </div>
                  </div>
                  <Button variant="ghost" onClick={handleCopy} className="h-10 px-4 rounded-xl font-black text-[9px] uppercase tracking-widest gap-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-all">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copiado" : "Copiar Completo"}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoItem icon={MapIcon} label="Logradouro" value={result.logradouro || 'N/A'} />
                  <InfoItem icon={Building2} label="Bairro" value={result.bairro || 'N/A'} />
                  <InfoItem icon={Hash} label="IBGE" value={result.ibge || 'N/A'} />
                  <InfoItem icon={ExternalLink} label="DDD" value={result.ddd ? `(${result.ddd})` : 'N/A'} />
                </div>

                <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                   <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Fonte: ViaCEP Brasil</p>
                   <Link href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${result.logradouro}, ${result.localidade}, ${result.uf}`)}`} target="_blank">
                     <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl font-black text-[9px] uppercase tracking-widest gap-2 border-slate-200 text-slate-500 hover:bg-slate-50">
                       Abrir Maps
                       <ExternalLink className="h-3 w-3" />
                     </Button>
                   </Link>
                </div>
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100/50 flex flex-col gap-1.5 transition-all hover:bg-white hover:shadow-md hover:border-slate-100 group">
      <div className="flex items-center gap-2">
        <Icon className="h-3 w-3 text-slate-400 group-hover:text-orange-500 transition-colors" />
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <p className="text-[11px] font-bold text-slate-700 truncate">{value}</p>
    </div>
  );
}
