'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MANUAL_CATEGORIES, MANUAL_TOPICS } from './data/topics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  Search, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Terminal, 
  Zap,
  CheckCircle2,
  Compass
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ManualOverviewPage() {
  const router = useRouter();
  const [filterQuery, setFilterQuery] = useState('');

  // Retrocompatibilidade automática: se o usuário entrar em /manual#poker, redireciona suavemente para /manual/poker
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        const found = MANUAL_TOPICS.find((t) => t.id === hash);
        if (found) {
          router.replace(`/manual/${found.id}`);
        }
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [router]);

  const filteredTopics = MANUAL_TOPICS.filter((t) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.subtitle.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      {/* Hero Central */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-8 md:p-14 text-white shadow-2xl border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest w-fit">
            <Sparkles className="h-3 w-3" /> Manual de Engenharia & Agilidade
          </div>

          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter italic leading-[0.9] text-white">
            O seu guia de <br />
            <span className="text-primary not-italic">Alta Performance</span>
          </h1>

          <p className="text-slate-300 font-medium text-sm md:text-base leading-relaxed">
            Documentação tática completa das cerimônias, motores de transformação e utilitários da plataforma Espaço Ágil. Cada módulo possui sua página dedicada com passo a passo de operação.
          </p>

          {/* Quick Search */}
          <div className="relative max-w-md pt-2">
            <Search className="absolute left-4 top-5 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Pesquise por cerimônia, ferramenta ou palavra-chave..."
              className="pl-11 pr-4 h-12 rounded-2xl bg-white/10 border-white/15 text-white placeholder:text-slate-400 focus-visible:ring-primary text-xs font-medium"
            />
          </div>
        </div>
      </div>

      {/* Grid of Categories */}
      <div className="space-y-12">
        {MANUAL_CATEGORIES.map((category) => {
          const topicsInCategory = filteredTopics.filter((t) => t.category === category.id);
          if (topicsInCategory.length === 0) return null;

          return (
            <div key={category.id} className="space-y-5">
              <div className="flex flex-col gap-1 border-b border-slate-200/80 dark:border-slate-800 pb-3">
                <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>{category.label}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {topicsInCategory.length}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {category.description}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {topicsInCategory.map((topic) => {
                  const Icon = topic.icon;
                  return (
                    <Link
                      key={topic.id}
                      href={`/manual/${topic.id}`}
                      className="group flex flex-col justify-between p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                            topic.badgeBg
                          )}>
                            <Icon className={cn("h-6 w-6", topic.color)} />
                          </div>
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowRight className="h-4 w-4 text-slate-700 dark:text-slate-300 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>

                        <div>
                          <h3 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors">
                            {topic.title}
                          </h3>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                            {topic.subtitle}
                          </p>
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-3 leading-relaxed">
                          {topic.description}
                        </p>
                      </div>

                      <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
                          Acessar Guia
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
