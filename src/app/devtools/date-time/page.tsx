'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Clock, 
  Calendar, 
  ArrowLeft, 
  RefreshCcw, 
  Copy, 
  History,
  Timer,
  CalendarRange,
  Zap,
  Globe
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function DateTimePage() {
  const { toast } = useToast();
  const [now, setNow] = useState(new Date());
  const [diffStart, setDiffStart] = useState('');
  const [diffEnd, setDiffEnd] = useState('');
  const [diffResult, setDiffResult] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!" });
  };

  const calculateDiff = () => {
    if (!diffStart || !diffEnd) return;
    const d1 = new Date(diffStart);
    const d2 = new Date(diffEnd);
    const diffMs = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    setDiffResult(`${diffDays} dias e ${diffHours} horas`);
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
              Chrono <span className="text-orange-600">Engine</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Sincronização e Cálculos Temporais</p>
          </div>
        </div>
        <Badge variant="outline" className="h-6 px-3 text-[9px] font-black uppercase tracking-widest border-orange-200 text-orange-600 bg-orange-50">
          Relógio & Data
        </Badge>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Real-time Clock */}
          <Card className="lg:col-span-2 border-none shadow-2xl shadow-slate-200/40 rounded-[2.5rem] bg-slate-900 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-[100px] rounded-full pointer-events-none" />
            <div className="p-10 relative z-10 space-y-8">
              <div className="flex items-center justify-between">
                <Badge className="bg-orange-600 text-[8px] font-black uppercase tracking-widest px-3 border-none">Live Session</Badge>
                <div className="flex items-center gap-2 text-slate-400">
                  <Globe className="h-3.5 w-3.5" />
                  <span className="text-[9px] font-bold uppercase tracking-widest">UTC {now.getTimezoneOffset() / -60}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-500">Hora do Sistema</p>
                <h2 className="text-7xl font-light tracking-tighter italic">
                  {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </h2>
                <p className="text-xl font-bold text-orange-500 uppercase tracking-tighter">
                  {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-white/5">
                <TimestampItem label="Unix (Seconds)" value={Math.floor(now.getTime() / 1000)} onCopy={() => handleCopy(String(Math.floor(now.getTime() / 1000)))} />
                <TimestampItem label="Millisecons" value={now.getTime()} onCopy={() => handleCopy(String(now.getTime()))} />
                <TimestampItem label="ISO 8601" value={now.toISOString().split('T')[0]} onCopy={() => handleCopy(now.toISOString())} />
                <TimestampItem label="Local Time" value={now.toLocaleTimeString()} onCopy={() => handleCopy(now.toLocaleTimeString())} />
              </div>
            </div>
          </Card>

          {/* Diff Calculator */}
          <Card className="border-none shadow-2xl shadow-slate-200/40 rounded-[2.5rem] bg-white overflow-hidden p-8 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                  <CalendarRange className="h-4 w-4 text-orange-600" /> Calculador de Período
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Descubra o intervalo entre duas datas</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">Início</span>
                  <Input type="datetime-local" value={diffStart} onChange={(e) => setDiffStart(e.target.value)} className="h-12 bg-slate-50 border-none rounded-2xl font-bold text-slate-700" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">Fim</span>
                  <Input type="datetime-local" value={diffEnd} onChange={(e) => setDiffEnd(e.target.value)} className="h-12 bg-slate-50 border-none rounded-2xl font-bold text-slate-700" />
                </div>
              </div>

              <Button 
                onClick={calculateDiff}
                className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
              >
                Calcular Diferença
              </Button>
            </div>

            {diffResult && (
              <div className="mt-8 p-6 bg-orange-50 rounded-3xl border border-orange-100 flex flex-col items-center justify-center gap-1 animate-in zoom-in-95">
                <span className="text-[9px] font-black uppercase text-orange-400 tracking-widest">Resultado do Período</span>
                <span className="text-lg font-black text-orange-600 italic text-center">{diffResult}</span>
              </div>
            )}
          </Card>

        </div>

        {/* Actionable Grid */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
          <ActionCard icon={RefreshCcw} title="Conversor de Timestamp" description="Converta timestamps Unix para datas legíveis." color="text-blue-500" />
          <ActionCard icon={History} title="Fusos Horários Local" description="Compare o horário atual com os principais datacenters." color="text-emerald-500" />
          <ActionCard icon={Zap} title="Próximo Feriado" description="Visualize rapidamente a distância para o próximo recesso." color="text-amber-500" />
        </div>
      </main>
    </div>
  );
}

function TimestampItem({ label, value, onCopy }: { label: string, value: string | number, onCopy: () => void }) {
  return (
    <div className="space-y-2 group cursor-pointer" onClick={onCopy}>
      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest truncate">{label}</p>
      <div className="flex items-center gap-2">
        <p className="text-xs font-bold text-slate-200 group-hover:text-orange-400 transition-colors">{value}</p>
        <Copy className="h-3 w-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

function ActionCard({ icon: Icon, title, description, color }: { icon: any, title: string, description: string, color: string }) {
  return (
    <Card className="p-6 border-none shadow-xl shadow-slate-200/50 rounded-[2rem] bg-white hover:bg-slate-50 transition-all cursor-pointer group">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-2xl bg-white shadow-sm border border-slate-100 group-hover:scale-110 transition-transform ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-800">{title}</h4>
          <p className="text-[9px] font-bold text-slate-400 leading-tight">{description}</p>
        </div>
      </div>
    </Card>
  );
}
