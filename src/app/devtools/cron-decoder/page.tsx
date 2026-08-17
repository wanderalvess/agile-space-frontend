'use client';

import React, { useState, useEffect } from 'react';
import cronstrue from 'cronstrue';
import 'cronstrue/locales/pt_BR';
import cronParser from 'cron-parser';
import { Clock, Calendar, AlertCircle, Info, Copy, Check, HelpCircle, Terminal, Hash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function CronDecoderPage() {
  const [expression, setExpression] = useState('* * * * *');
  const [humanReadable, setHumanReadable] = useState('');
  const [nextDates, setNextDates] = useState<Date[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    decodeCron(expression);
  }, [expression]);

  const decodeCron = (value: string) => {
    if (!value.trim()) {
      setError('Por favor, insira uma expressão cron.');
      setHumanReadable('');
      setNextDates([]);
      return;
    }

    try {
      // Tradução humana
      const translation = cronstrue.toString(value, { locale: 'pt_BR' });
      setHumanReadable(translation);

      // Próximas datas
      const interval = cronParser.parse(value);
      const dates: Date[] = [];
      for (let i = 0; i < 5; i++) {
        dates.push(interval.next().toDate());
      }
      setNextDates(dates);
      setError(null);
    } catch (err) {
      setError('Expressão Cron inválida ou incompleta');
      setHumanReadable('');
      setNextDates([]);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(expression);
    setCopied(true);
    toast.success('Expressão copiada!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col bg-background h-dvh overflow-hidden">
      {/* Standard Header */}
      <header className="px-6 py-4 border-b bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg shadow-lg shadow-primary/20 translate-y-[-1px]">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold leading-none">Interpretador de Agendamentos (Cron)</h1>
            <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-widest">TRADUÇÃO HUMANA DE EXPRESSÕES TEMPORAIS</p>
          </div>
        </div>

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
                <Clock className="h-6 w-6 text-white" />
              </div>
              <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-slate-800">
                Interpretador Cron
              </SheetTitle>
              <SheetDescription className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2 leading-relaxed">
                Tradução e simulação de agendamentos agnósticos
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-1 text-slate-600">
              <div className="p-8 space-y-10">
                <div className="space-y-4">
                  <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                    01. O que é uma Expressão Cron?
                  </h3>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">
                    Cron é uma linguagem de agendamento para sistemas Unix. É composta por 5 ou 6 campos separados por espaços, representando tempos específicos de execução (segundos, minutos, horas, dias, etc).
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                    02. Estrutura da Sintaxe
                  </h3>
                  <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 font-mono text-[10px] space-y-2 text-slate-400">
                    <div className="grid grid-cols-2 border-b border-slate-800 pb-2 mb-2 text-blue-400 font-black">
                      <span>CAMPO</span> <span>VALOR</span>
                    </div>
                    <div className="flex justify-between"><span>* Segundos (Opcional)</span> <span className="text-slate-200">0-59</span></div>
                    <div className="flex justify-between"><span>* Minuto</span> <span className="text-slate-200">0-59</span></div>
                    <div className="flex justify-between"><span>* Hora</span> <span className="text-slate-200">0-23</span></div>
                    <div className="flex justify-between"><span>* Dia do Mês</span> <span className="text-slate-200">1-31</span></div>
                    <div className="flex justify-between"><span>* Mês</span> <span className="text-slate-200">1-12</span></div>
                    <div className="flex justify-between"><span>* Dia da Semana</span> <span className="text-slate-200">0-6</span></div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                    03. Exemplos Rápidos
                  </h3>
                  <div className="grid gap-3">
                    {[
                      { exp: "*/15 * * * *", desc: "A cada 15 minutos de cada hora." },
                      { exp: "0 9 * * 1-5", desc: "Todo dia útil às 09:00 (Seg-Sex)." },
                      { exp: "0 0 1 1 *", desc: "Uma vez por ano (01 de Janeiro)." }
                    ].map((item, i) => (
                      <div key={i} className="p-4 border border-slate-100 rounded-2xl bg-slate-50/50 flex flex-col gap-1 group hover:bg-white hover:shadow-md transition-all cursor-pointer" onClick={() => setExpression(item.exp)}>
                        <code className="text-sm font-black text-blue-600 group-hover:underline">{item.exp}</code>
                        <p className="text-xs text-slate-400 font-bold">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 p-6 bg-blue-50/50 rounded-[2rem] border border-blue-100">
                  <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                    Nota sobre Fuso Horário
                  </h3>
                  <p className="text-[11px] text-blue-800/80 font-bold leading-relaxed">
                    As simulações de "Próximas Execuções" utilizam o fuso horário configurado no seu sistema local. Se o seu servidor rodar em UTC, os horários reais serão diferentes.
                  </p>
                </div>
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-10 scrollbar-thin scrollbar-thumb-muted">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Main Input Section */}
          <Card className="border-2 shadow-2xl shadow-primary/5 bg-card/10 backdrop-blur-xl transition-all duration-300">
            <CardContent className="pt-10 pb-10 px-6 md:px-12 flex flex-col items-center space-y-8">
              <div className="w-full max-w-2xl relative group">
                <Input
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  placeholder="* * * * *"
                  className="h-20 text-3xl md:text-5xl font-black text-center tracking-[0.2em] bg-background border-2 border-muted group-hover:border-primary/30 focus:border-primary/50 transition-all rounded-2xl shadow-inner uppercase"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 text-muted-foreground hover:text-primary transition-colors"
                  onClick={copyToClipboard}
                >
                  {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                </Button>
              </div>

              <div className="flex flex-col items-center text-center space-y-4 min-h-[100px] justify-center w-full px-4">
                {error ? (
                  <div className="flex items-center gap-2 text-rose-500 bg-rose-500/10 px-6 py-3 rounded-full animate-in fade-in zoom-in duration-300 border border-rose-500/20">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-bold text-sm uppercase tracking-wider">{error}</span>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <p className="text-2xl md:text-3xl font-bold text-primary tracking-tight leading-tight">
                      "{humanReadable}"
                    </p>
                    <Badge variant="outline" className="mt-4 border-primary/20 bg-primary/5 text-primary font-bold uppercase tracking-widest px-4 py-1">
                      Tradução em Português
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Next Executions */}
          {!error && nextDates.length > 0 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
              <div className="flex items-center gap-2 px-1">
                <Calendar className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/70">
                  Próximas 5 Execuções
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {nextDates.map((date, index) => (
                  <Card 
                    key={index} 
                    className="group border-2 hover:border-primary/30 transition-all duration-300 bg-card/30 backdrop-blur-sm overflow-hidden"
                  >
                    <div className="p-1 h-1 bg-primary/20 group-hover:bg-primary transition-colors" />
                    <CardContent className="p-4 flex flex-col items-center text-center">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 opacity-50">
                        Nº {index + 1}
                      </span>
                      <p className="text-sm font-bold text-foreground">
                        {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </p>
                      <p className="text-xl font-black text-primary tracking-tighter">
                        {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-[10px] font-medium text-muted-foreground mt-1 lowercase">
                        {date.toLocaleDateString('pt-BR', { weekday: 'short' })}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-muted/30 border border-muted flex gap-3 items-start">
                <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  As datas acima baseiam-se no fuso horário do seu navegador (<strong>{Intl.DateTimeFormat().resolvedOptions().timeZone}</strong>). 
                  A sintaxe suportada inclui padrão de 5 ou 6 campos (com segundos).
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
