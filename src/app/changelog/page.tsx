'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { RoomHeader } from '@/components/layout/RoomHeader';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { changelogApi, AppReleaseItem } from '@/services/changelogApi';

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
  if (!iconData) return <Sparkles className="h-5 w-5 text-primary" />;
  const iconName = typeof iconData === 'object' ? iconData.name : iconData;
  const className = typeof iconData === 'object' ? iconData.className : "h-5 w-5 text-primary";
  
  const IconComponent = iconMap[iconName] || Sparkles;
  return <IconComponent className={className} />;
};

export default function ChangelogPage() {
  const router = useRouter();
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();
  const [versions, setVersions] = useState<AppReleaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    document.title = `Changelog & Evolução | Espaço Ágil`;

    const loadData = async () => {
      try {
        const remoteReleases = await changelogApi.getPublishedReleases();
        setVersions(remoteReleases || []);
      } catch (err) {
        console.warn('Erro ao carregar changelog do backend:', err);
        setVersions([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredVersions = useMemo(() => {
    return versions.filter((version) => {
      const matchSearch =
        search === '' ||
        version.tag?.toLowerCase().includes(search.toLowerCase()) ||
        version.title?.toLowerCase().includes(search.toLowerCase()) ||
        version.description?.toLowerCase().includes(search.toLowerCase()) ||
        version.changes?.some((c) => c.toLowerCase().includes(search.toLowerCase()));

      const matchFilter =
        activeFilter === 'all' || version.type?.toLowerCase() === activeFilter.toLowerCase();

      return matchSearch && matchFilter;
    });
  }, [versions, search, activeFilter]);

  const latestTag = versions[0]?.tag || 'v3.117.1';

  return (
    <div className="min-h-dvh flex flex-col justify-between w-full bg-[#fafafa] dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative overflow-x-hidden font-body selection:bg-primary/30">
      {/* Background Glow */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[160px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[140px]" />
      </div>

      <div className="w-full flex-1 flex flex-col">
        {/* ROOM HEADER */}
        <RoomHeader
          title="Changelog & Evolução"
          toolIcon={<GitBranch className="h-4 w-4" />}
          toolColorClass="text-primary"
          onOpenFeedback={() => setFeedbackSignal(Date.now())}
          badge={<Badge className="bg-primary/10 text-primary border-none font-black uppercase text-[9px] tracking-widest px-2.5 py-0.5 rounded-md">{latestTag}</Badge>}
        />

        <div className="relative z-10 p-4 md:p-6 lg:p-8 flex-1 w-full max-w-7xl mx-auto">
          <main className="w-full space-y-8">
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por versão, recurso ou correção..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-9 rounded-xl bg-slate-50/50 dark:bg-slate-950 border-slate-200/80 dark:border-slate-800 text-xs font-medium"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto no-scrollbar">
                {[
                  { id: 'all', label: 'Todas as Versões' },
                  { id: 'major', label: 'Majors' },
                  { id: 'minor', label: 'Minors (Features)' },
                  { id: 'patch', label: 'Patches (Fixes)' },
                ].map((f) => (
                  <Button
                    key={f.id}
                    variant={activeFilter === f.id ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveFilter(f.id)}
                    className={`h-8 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                      activeFilter === f.id
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="py-20 text-center text-slate-400 font-medium">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 text-primary" />
                Carregando histórico de engenharia...
              </div>
            ) : filteredVersions.length === 0 ? (
              <div className="py-16 text-center bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-400 text-sm font-medium">
                Nenhuma versão encontrada correspondente aos termos de busca.
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-8 md:left-[51px] top-0 bottom-0 w-[4px] bg-gradient-to-b from-primary/40 via-slate-200 dark:via-slate-800 to-transparent rounded-full opacity-50" />

                <div className="space-y-8">
                  {filteredVersions.map((version, idx) => (
                    <div key={`${version.tag}-${idx}`} className="relative pl-20 md:pl-32 group">
                      <div className="absolute left-4 md:left-[39px] top-0 w-10 h-10 bg-white dark:bg-slate-900 border-4 border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:border-primary group-hover:rotate-12 transition-all duration-500 z-10 overflow-hidden">
                          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span className="text-primary group-hover:scale-110 transition-transform">
                            {renderVersionIcon(version.icon || { name: version.iconName, className: version.iconClass })}
                          </span>
                      </div>

                      <div className="mb-2 flex items-center gap-4">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-800 shadow-sm">
                            {version.displayDate || version.date}
                          </span>
                          <div className="h-[1px] flex-1 bg-slate-50 dark:bg-slate-900 md:hidden" />
                      </div>

                      <div className="space-y-4">
                        <Card className="border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg rounded-3xl overflow-hidden hover:shadow-xl transition-all">
                          <CardHeader className="border-b border-slate-100 dark:border-slate-800/60 p-6">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                  <h3 className="text-xl font-black font-headline uppercase tracking-tight italic text-slate-900 dark:text-slate-100">
                                    {version.title}
                                  </h3>
                                  <Badge className="bg-primary/10 text-primary border-none text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-lg">
                                    {version.tag}
                                  </Badge>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                  {version.description}
                                </p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {version.changes?.map((change, cIdx) => (
                                <div key={cIdx} className="flex items-start gap-3 group/item">
                                  <div className="mt-1 w-1.5 h-1.5 bg-primary/20 border-2 border-primary rounded-full shrink-0 group-hover/item:scale-125 transition-all" />
                                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed group-hover/item:text-slate-950 dark:group-hover/item:text-slate-200 transition-colors">
                                    {change}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-800 text-center relative overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-900/60 shadow-lg p-6 md:p-8">
              <div className="inline-flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center border border-slate-100 dark:border-slate-700">
                  <RefreshCw className="h-4 w-4 text-slate-400 dark:text-slate-500 animate-spin-slow" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Squads de Alta Performance</span>
              </div>
              
              <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white italic font-headline mb-2 max-w-2xl mx-auto leading-tight">
                Acelerando o fluxo de engenharia <span className="text-primary not-italic">sem precedentes.</span>
              </h3>
              
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl mx-auto mb-6">
                O Espaço Ágil evolui diariamente para ser a fundação síncrona definitiva para times de alta performance.
              </p>
              
              <Button 
                className="rounded-xl h-10 px-8 bg-slate-900 dark:bg-white hover:bg-black dark:hover:bg-slate-100 text-white dark:text-slate-950 font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-md"
                onClick={() => router.push('/')}
              >
                Voltar para a Central
              </Button>
            </div>
          </main>
        </div>
      </div>

      <Footer className="mt-8 shrink-0" onOpenFeedback={() => setFeedbackSignal(Date.now())} />
      <FeedbackWidget toolName="Espaço Ágil - Changelog" triggerVariant="none" externalTriggerSignal={feedbackSignal} />
    </div>
  );
}
