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
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function ManualOverviewPage() {
  const router = useRouter();
  const [filterQuery, setFilterQuery] = useState('');
  useDocumentTitle('Manual');

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
    <div className="space-y-12">
      {/* Hero Central */}
      <div className="relative overflow-hidden rounded-2xl bg-card p-8 md:p-12 text-foreground shadow-sm border border-border">
                
        <div className="relative z-10 max-w-4xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-foreground text-xs font-bold tracking-normal w-fit">
            <Sparkles className="h-3 w-3" /> Manual de Agilidade & Ferramentas
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight text-foreground">
            O seu guia de <br />
            <span className="text-primary [.theme-totvs:not(.dark)_&]:text-foreground">Alta Performance</span>
          </h2>

          <p className="text-muted-foreground font-medium text-sm md:text-base leading-relaxed max-w-3xl">
            Documentação tática completa das cerimônias, motores de transformação e utilitários da plataforma Portal Tech V&D. Cada módulo possui sua página dedicada com passo a passo de operação.
          </p>

          {/* Quick Search */}
          <div className="relative max-w-lg pt-2">
            <Search className="absolute left-4 top-5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Pesquise por cerimônia, ferramenta ou palavra-chave..."
              className="pl-11 pr-4 h-12 rounded-2xl bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary text-xs font-medium"
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
              <div className="flex flex-col gap-1 border-b border-border/80 dark:border-border pb-3">
                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span>{category.label}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted/60 dark:bg-muted text-muted-foreground">
                    {topicsInCategory.length}
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground font-medium">
                  {category.description}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {topicsInCategory.map((topic) => {
                  const Icon = topic.icon;
                  return (
                    <Link
                      key={topic.id}
                      href={`/manual/${topic.id}`}
                      className="group flex flex-col justify-between p-6 bg-card rounded-2xl border border-border/80 dark:border-border shadow-sm hover:shadow-xl hover:border-border transition-all"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                            topic.badgeBg
                          )}>
                            <Icon className={cn("h-6 w-6", topic.color)} />
                          </div>
                          <div className="w-8 h-8 rounded-full bg-muted/60 dark:bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowRight className="h-4 w-4 text-foreground dark:text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>

                        <div>
                          <h3 className="text-base font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                            {topic.title}
                          </h3>
                          <p className="text-xs font-bold tracking-normal text-muted-foreground mt-0.5">
                            {topic.subtitle}
                          </p>
                        </div>

                        <p className="text-xs text-muted-foreground font-medium line-clamp-3 leading-relaxed">
                          {topic.description}
                        </p>
                      </div>

                      <div className="pt-4 mt-4 border-t border-border dark:border-border/60 flex items-center justify-between">
                        <span className="text-xs font-bold tracking-normal text-primary [.theme-totvs:not(.dark)_&]:text-foreground flex items-center gap-1">
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
