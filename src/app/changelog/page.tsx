'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  GitBranch, 
  Rocket, 
  Zap, 
  ShieldCheck, 
  Layers, 
  Sparkles,
  RefreshCw,
  History,
  Code2,
  Cpu,
  Globe,
  Monitor,
  Layout,
  Lock,
  Database,
  Search,
  Users,
  MessageSquareHeart,
  Shield,
  ListChecks
} from 'lucide-react';
import { FeedbackWidget } from '@/components/feedback-widget';
import { Footer } from '@/components/layout/Footer';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import versionsData from './versions.json';

const iconMap: Record<string, React.ComponentType<any>> = {
  ArrowLeft, 
  GitBranch, 
  Rocket, 
  Zap, 
  ShieldCheck, 
  Layers, 
  Sparkles,
  RefreshCw,
  History,
  Code2,
  Cpu,
  Globe,
  Monitor,
  Layout,
  Lock,
  Database,
  Search,
  Users,
  MessageSquareHeart,
  Shield,
  ListChecks
};

const renderVersionIcon = (iconData: { name: string; className: string } | any) => {
  if (!iconData) return null;
  const iconName = typeof iconData === 'object' ? iconData.name : iconData;
  const className = typeof iconData === 'object' ? iconData.className : "h-5 w-5 text-primary";
  
  const IconComponent = iconMap[iconName] || Sparkles;
  return <IconComponent className={className} />;
};

const versions = versionsData;

export default function ChangelogPage() {
  const router = useRouter();
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();

  React.useEffect(() => {
    document.title = `Changelog & Evolução | Espaço Ágil`;
  }, []);

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-slate-950 selection:bg-primary/10 transition-colors duration-300">
      <header className="w-full h-[72px] border-b border-slate-100 dark:border-slate-800/50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl flex items-center px-6 md:px-12 sticky top-0 z-50 transition-colors">
        <div className="max-w-[1600px] mx-auto w-full flex items-center justify-between pt-1">
          <div className="flex items-center gap-5">
            <Button 
              variant="ghost" 
              className="h-10 px-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all flex items-center gap-2 group"
              onClick={() => router.push('/')}
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest">Hub</span>
            </Button>
            
            <div className="flex items-center gap-4 group">
              <div className="w-10 h-10 bg-slate-900 dark:bg-slate-800 rounded-xl flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform duration-500">
                <GitBranch className="h-5 w-5 text-primary" />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-lg font-black font-headline uppercase tracking-tighter italic text-slate-900 dark:text-white leading-none">
                  Changelog <span className="text-primary">& Evolução</span>
                </span>
                <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 hidden md:block" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 leading-none hidden lg:block">
                  Histórico de Engenharia
                </span>
              </div>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 px-4 py-2 rounded-xl">
             <div className="flex flex-col items-end">
               <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Build Estável</span>
               <span className="text-sm font-black text-slate-900 dark:text-slate-100 leading-none">{versions[0]?.tag || 'v3.23.0'}</span>
             </div>
             <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
             <Rocket className="h-4 w-4 text-primary" />
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto py-4 px-6 md:px-12 lg:px-24">
        <div className="relative">
          <div className="absolute left-8 md:left-[51px] top-0 bottom-0 w-[4px] bg-gradient-to-b from-primary/40 via-slate-200 dark:via-slate-800 to-transparent rounded-full opacity-50" />

          <div className="space-y-8">
            {versions.map((version, idx) => (
              <div key={`${version.tag}-${idx}`} className="relative pl-20 md:pl-32 group">
                <div className="absolute left-4 md:left-[39px] top-0 w-10 h-10 bg-white dark:bg-slate-900 border-4 border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:border-primary group-hover:rotate-12 transition-all duration-500 z-10 overflow-hidden">
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="text-primary group-hover:scale-110 transition-transform">{renderVersionIcon(version.icon)}</span>
                </div>

                <div className="mb-2 flex items-center gap-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-800 shadow-sm">
                      {version.date}
                    </span>
                    <div className="h-[1px] flex-1 bg-slate-50 dark:bg-slate-900 md:hidden" />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                  <div className="xl:col-span-4 translate-y-1">
                    <div className="xl:sticky xl:top-24">
                      <Badge variant="outline" className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] border-slate-200 dark:border-slate-850 text-slate-400 dark:text-slate-400 py-0.5 px-3 rounded-lg bg-white dark:bg-slate-900/50 shadow-sm">
                        {version.tag}
                      </Badge>
                      <h2 className="text-xl md:text-2xl xl:text-2xl font-black uppercase tracking-tighter text-slate-950 dark:text-slate-50 leading-[0.95] italic font-headline mb-2 group-hover:text-primary transition-colors">
                        {version.title}
                      </h2>
                      <p className="text-base font-bold text-slate-800 dark:text-slate-300 leading-relaxed italic border-l-4 border-primary/40 pl-4 py-1 bg-gradient-to-r from-slate-50/50 dark:from-slate-900/50 to-transparent rounded-r-xl">
                        {version.description}
                      </p>
                    </div>
                  </div>

                  <div className="xl:col-span-8">
                    <Card className="border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900/60 rounded-[2.5rem] p-6 md:p-8 shadow-2xl shadow-slate-200/50 dark:shadow-none hover:shadow-primary/5 transition-all duration-700 overflow-hidden relative group-hover:border-primary/20">
                      <div className="absolute -bottom-20 -right-20 opacity-[0.02] group-hover:opacity-[0.06] transition-all duration-1000 text-slate-900 dark:text-white scale-[5] rotate-12">
                        {renderVersionIcon(version.icon)}
                      </div>

                      <CardHeader className="p-0 mb-4 border-b border-slate-50 dark:border-slate-800/50 pb-4">
                         <div className="flex items-center gap-4">
                           <div className="w-8 h-8 bg-primary/5 dark:bg-primary/10 rounded-xl flex items-center justify-center border border-primary/10 dark:border-primary/20">
                              <GitBranch className="h-4 w-4 text-primary" />
                           </div>
                           <div>
                             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 block mb-0.5">Log Detalhado</span>
                             <span className="text-[10px] font-black text-slate-900 dark:text-slate-200 uppercase tracking-widest">Build {version.tag}</span>
                           </div>
                         </div>
                      </CardHeader>
                      
                      <CardContent className="p-0 relative z-10">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">
                          {version.changes.map((change, cIdx) => (
                            <div key={cIdx} className="flex items-start gap-4 group/item">
                              <div className="mt-1.5 w-1.5 h-1.5 bg-primary/10 dark:bg-primary/20 border-2 border-primary/40 dark:border-primary/50 rounded-full shrink-0 group-hover/item:bg-primary group-hover/item:border-primary group-hover/item:scale-125 transition-all duration-300" />
                              <span className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-snug group-hover/item:text-slate-950 dark:group-hover/item:text-slate-200 transition-colors">
                                {change}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-800 text-center relative overflow-hidden rounded-[3rem] bg-white dark:bg-slate-900/60 shadow-3xl shadow-slate-200/50 dark:shadow-none p-8">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          
          <div className="inline-flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-100 dark:border-slate-850 shadow-inner">
              <RefreshCw className="h-5 w-5 text-slate-300 dark:text-slate-600 animate-spin-slow" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">Squads de Alta Performance</span>
          </div>
          
          <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white italic font-headline mb-4 max-w-2xl mx-auto leading-[0.85]">
            Acelerando o fluxo de engenharia <span className="text-primary not-italic">sem precedentes.</span>
          </h3>
          
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-xl mx-auto mb-6">
            O Espaço Ágil evolui diariamente para ser a fundação síncrona definitiva para times de alta performance.
          </p>
          
          <Button 
            className="rounded-full h-12 px-10 bg-slate-900 dark:bg-white hover:bg-black dark:hover:bg-slate-100 text-white dark:text-slate-950 font-black uppercase text-[12px] tracking-[0.3em] active:scale-95 transition-all shadow-3xl shadow-slate-400 dark:shadow-none transform hover:-translate-y-1"
            onClick={() => router.push('/')}
          >
            Voltar para a Central
          </Button>
        </div>
      </main>

      <Footer onOpenFeedback={() => setFeedbackSignal(Date.now())} />
      <FeedbackWidget toolName="Espaço Ágil - Changelog" triggerVariant="none" externalTriggerSignal={feedbackSignal} />
    </div>
  );
}
