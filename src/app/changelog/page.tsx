'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  GitBranch, 
  Flag, 
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
import { DataToolbar, EmptyState, LoadingSkeleton, PageHeader, PageShell } from '@/components/page';
import { StatusChip } from '@/components/room-kit';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { changelogApi, AppReleaseItem } from '@/services/changelogApi';

const iconMap: Record<string, React.ComponentType<any>> = {
  ArrowLeft, 
  GitBranch, 
  Flag,
  Rocket: Flag, // alias: releases já gravados com o ícone antigo
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

import rawVersions from './versions.json';
import { mergeReleases } from './merge';

const DEFAULT_VERSIONS: AppReleaseItem[] = (rawVersions as any[]).map((v) => ({
  tag: v.tag,
  title: v.title,
  description: v.description,
  changes: v.changes || [],
  type: v.type || 'patch',
  displayDate: v.date || v.displayDate,
  date: v.date || v.displayDate,
  iconName: v.icon?.name || 'Sparkles',
  iconClass: v.icon?.className || 'h-5 w-5 text-primary',
}));

export default function ChangelogPage() {
  const [versions, setVersions] = useState<AppReleaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    const loadData = async () => {
      try {
        const remoteReleases = await changelogApi.getPublishedReleases();
        if (remoteReleases && remoteReleases.length > 0) {
          // O backend guarda só o que foi cadastrado no admin; as versões geradas a cada entrega
          // ficam em versions.json. Mostra as duas, sem repetir tag.
          setVersions(mergeReleases(remoteReleases, DEFAULT_VERSIONS));
        } else {
          setVersions(DEFAULT_VERSIONS);
        }
      } catch (err) {
        console.warn('Erro ao carregar changelog do backend, utilizando versões padrões:', err);
        setVersions(DEFAULT_VERSIONS);
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
    <PageShell documentTitle="Versões">
      <PageHeader
        title="Versões"
        module="changelog"
        subtitle="O que mudou em cada versão do portal."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Versões' }]}
        badges={<StatusChip tone="brand">{latestTag}</StatusChip>}
      />

      <DataToolbar
        search={{ value: search, onChange: setSearch, placeholder: 'Buscar por versão, recurso ou correção', ariaLabel: 'Buscar nas versões' }}
        filters={
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="Tipo de versão">
            {[
              { id: 'all', label: 'Todas as versões' },
              { id: 'major', label: 'Grandes versões' },
              { id: 'minor', label: 'Novos recursos' },
              { id: 'patch', label: 'Correções' },
            ].map((f) => (
              <Button
                key={f.id}
                variant={activeFilter === f.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveFilter(f.id)}
                aria-pressed={activeFilter === f.id}
                className="h-9 rounded-xl px-3 text-xs font-semibold max-sm:min-h-11"
              >
                {f.label}
              </Button>
            ))}
          </div>
        }
        count={{ shown: filteredVersions.length, total: versions.length, noun: 'versões' }}
      />

    {loading ? (
      <LoadingSkeleton variant="cards" rows={3} label="Carregando o histórico de versões" />
    ) : filteredVersions.length === 0 ? (
      <EmptyState
        icon={History}
        title="Nenhuma versão encontrada"
        description="Nenhuma versão corresponde aos termos de busca. Tente outro termo ou limpe o filtro."
      />
    ) : (
      <div className="relative">
        <div className="absolute left-8 md:left-[51px] top-0 bottom-0 w-[4px] bg-border rounded-full opacity-50" />

        <div className="space-y-8">
          {filteredVersions.map((version, idx) => (
            <div key={`${version.tag}-${idx}`} className="relative pl-20 md:pl-32 group">
              <div className="absolute left-4 md:left-[39px] top-0 w-10 h-10 bg-card border-4 border-border rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:border-primary group-hover:rotate-12 transition-all duration-500 z-10 overflow-hidden">
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="text-primary group-hover:scale-110 transition-transform">
                    {renderVersionIcon(version.icon || { name: version.iconName, className: version.iconClass })}
                  </span>
              </div>

              <div className="mb-2 flex items-center gap-4">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground bg-background px-3 py-1 rounded-full border border-border shadow-sm">
                    {version.displayDate || version.date}
                  </span>
                  <div className="h-[1px] flex-1 bg-background md:hidden" />
              </div>

              <div className="space-y-4">
                <Card className="border border-border/80 bg-card/80 backdrop-blur-xl shadow-lg rounded-3xl overflow-hidden hover:shadow-xl transition-all">
                  <CardHeader className="border-b border-border p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-black font-headline uppercase tracking-tight italic text-foreground">
                            {version.title}
                          </h3>
                          <Badge className="bg-primary/10 text-primary border-none text-xs font-black uppercase tracking-widest px-2.5 py-0.5 rounded-lg">
                            {version.tag}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-medium">
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
                          <span className="text-xs font-medium text-muted-foreground leading-relaxed group-hover/item:text-foreground transition-colors">
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
    </PageShell>
  );
}
