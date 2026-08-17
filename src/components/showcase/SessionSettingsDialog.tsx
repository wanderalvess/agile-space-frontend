'use client';

import React, { useState } from 'react';
import { 
  Settings, Sparkles, Link as LinkIcon, Check, AlertTriangle, 
  Layout, Target, Users, Palette, Globe, ChevronRight, Video, SortAsc
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ShowcaseSession, PRESETS, PRESENTATION_PRESETS } from './types';
import { getDirectImageUrl } from './utils';

interface SessionSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  session: ShowcaseSession | null;
  onUpdate: (updates: Partial<ShowcaseSession>) => void;
}

type TabType = 'geral' | 'identidade' | 'apresentacao' | 'squad';

export function SessionSettingsDialog({ open, onClose, session: initialSession, onUpdate: onCommit }: SessionSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>('geral');
  const [session, setSession] = useState<Partial<ShowcaseSession>>({});
  const [coverUrl, setCoverUrl] = useState('');
  const [previewError, setPreviewError] = useState(false);
  
  React.useEffect(() => {
    if (open && initialSession) {
      setSession(initialSession);
      setCoverUrl(initialSession.coverImage || '');
      setPreviewError(false);
    }
  }, [open, initialSession]);

  const onUpdate = (updates: Partial<ShowcaseSession>) => {
    setSession(prev => ({ ...prev, ...updates }));
  };

  const handleSave = () => {
    if (Object.keys(session).length > 0) {
      onCommit(session);
    }
    onClose();
  };
  
  const tabs = [
    { id: 'geral', label: 'Geral', icon: Layout, description: 'Informações básicas' },
    { id: 'identidade', label: 'Capa & Início', icon: Palette, description: 'Visual da Capa' },
    { id: 'apresentacao', label: 'Modo Teatro', icon: Video, description: 'Fundo & Temas' },
    { id: 'squad', label: 'Squad', icon: Users, description: 'Nome do time' },
  ];

  const renderGeral = () => (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Card 1: Identificação Básica */}
        <div className="md:col-span-6 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Layout className="h-4 w-4 text-violet-500" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">Identificação</h3>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-1">Título da Review</label>
            <Input 
              value={session?.name || ''} 
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="Ex: Review Sprint 42"
              className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 font-semibold text-xs focus:ring-violet-500/20 dark:text-slate-100 transition-all"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-1">Data / Ciclo</label>
            <Input 
              value={session?.period || ''} 
              onChange={(e) => onUpdate({ period: e.target.value })}
              placeholder="Ex: 2026 / Q1"
              className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 font-semibold text-xs focus:ring-violet-500/20 dark:text-slate-100 transition-all"
            />
          </div>
        </div>

        {/* Card 2: Preferências & Status */}
        <div className="md:col-span-6 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Globe className="h-4 w-4 text-violet-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">Configurações & Status</h3>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-1 flex items-center gap-1">
                <SortAsc className="h-3.5 w-3.5 text-violet-500" /> Ordenação Padrão dos Cards
              </label>
              <Select 
                value={session?.defaultSort || 'key'} 
                onValueChange={(v) => onUpdate({ defaultSort: v as any })}
              >
                <SelectTrigger className="h-10 w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 rounded-xl text-xs font-semibold focus:ring-0 text-slate-800 dark:text-slate-250">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 dark:bg-slate-900">
                  <SelectItem value="key" className="text-xs font-semibold">Chave Jira</SelectItem>
                  <SelectItem value="type" className="text-xs font-semibold">Tipo de Issue</SelectItem>
                  <SelectItem value="dev" className="text-xs font-semibold">Desenvolvedor</SelectItem>
                  <SelectItem value="qa" className="text-xs font-semibold">Validador / QA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-1">Status Global da Sessão</label>
            <div className="h-10 flex items-center px-3.5 rounded-xl bg-violet-500/10 dark:bg-violet-500/5 border border-violet-500/25 text-violet-600 dark:text-violet-400 font-bold text-xs gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest">Sessão Ativa</span>
            </div>
          </div>
        </div>

        {/* Card 3: Objetivos da Sprint */}
        <div className="md:col-span-12 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 space-y-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-violet-500" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">Objetivos da Sprint</h3>
          </div>
          <Textarea 
            value={session?.description || ''} 
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Destaque as principais entregas e valor gerado para o cliente nesta sprint..."
            className="w-full h-24 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 font-semibold text-xs focus:ring-violet-500/20 dark:text-slate-100 transition-all resize-none p-3"
          />
        </div>
      </div>
    </motion.div>
  );

  const renderIdentidade = () => (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Column: Galeria & Custom link */}
        <div className="md:col-span-7 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">Galeria Premium</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map(p => (
                <button 
                  key={p.id}
                  onClick={() => { onUpdate({ coverImage: p.url }); setCoverUrl(p.url); }}
                  className={cn(
                    "group relative aspect-video rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.02] hover:shadow-md",
                    session?.coverImage === p.url ? "border-violet-600 shadow-md shadow-violet-600/20" : "border-transparent"
                  )}
                >
                  <img src={p.url} className="w-full h-full object-cover" alt={p.name} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-2 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity text-left">
                    <p className="text-[9px] font-black text-white uppercase tracking-wider">{p.name}</p>
                    <p className="text-[7.5px] text-white/80 uppercase font-bold tracking-tight line-clamp-1 mt-0.5">{p.description}</p>
                  </div>
                  {session?.coverImage === p.url && (
                    <div className="absolute top-1.5 right-1.5 bg-violet-600 text-white p-0.5 rounded-md shadow-lg">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-150 dark:border-slate-800/60">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-violet-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">Link Customizado</h3>
            </div>
            <div className="flex gap-2">
              <Input 
                value={coverUrl}
                onChange={(e) => { setCoverUrl(e.target.value); setPreviewError(false); }}
                placeholder="URL da Imagem..."
                className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 font-semibold text-xs focus:ring-violet-500/20 dark:text-slate-100 transition-all flex-1"
              />
              <Button 
                onClick={() => onUpdate({ coverImage: coverUrl })}
                disabled={!coverUrl}
                className="h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold uppercase tracking-wider text-[9px] shrink-0"
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="md:col-span-5 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-violet-500" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">Visualização da Capa</h3>
          </div>

          {previewError && coverUrl ? (
            <div className="flex-1 min-h-[160px] p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex flex-col items-center justify-center text-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">Erro no Preview</p>
              <p className="text-[9px] text-slate-400 leading-normal max-w-[180px]">Verifique a URL informada.</p>
            </div>
          ) : coverUrl ? (
            <div className="flex-1 min-h-[160px] rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 relative bg-slate-950/20 flex items-center justify-center shadow-inner">
              <img 
                src={getDirectImageUrl(coverUrl)} 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover animate-fade-in" 
                alt="Cover Preview" 
                onError={() => setPreviewError(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3.5 flex flex-col justify-end">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-violet-400">Preview</span>
                <h4 className="text-white text-xs font-black uppercase tracking-tight truncate leading-none mt-1">{session?.name || 'Sua Sprint Review'}</h4>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-[160px] border-2 border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-2 p-4 text-center">
              <Sparkles className="h-6 w-6 text-slate-350 dark:text-slate-700" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Nenhuma capa selecionada</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderApresentacao = () => (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Card 1: Fundo da Apresentação */}
        <div className="md:col-span-7 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">Presets de Fundo (Modo Teatro)</h3>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {PRESENTATION_PRESETS.map((p: any) => (
                <button 
                  key={p.id}
                  onClick={() => onUpdate({ presentationBackground: p.value })}
                  className={cn(
                    "group relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.05] hover:shadow-md",
                    session?.presentationBackground === p.value ? "border-violet-600 shadow-md shadow-violet-600/20" : "border-transparent"
                  )}
                >
                  {p.preview === 'url' ? (
                    <img src={p.value} className="w-full h-full object-cover" alt={p.name} />
                  ) : (
                    <div style={{ background: p.value }} className="w-full h-full" />
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1">
                     <p className="text-[7.5px] font-black text-white uppercase text-center leading-tight">{p.name}</p>
                  </div>
                  {session?.presentationBackground === p.value && (
                    <div className="absolute top-1 right-1 bg-violet-600 text-white p-0.5 rounded-md shadow-lg">
                      <Check className="h-2 w-2" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-150 dark:border-slate-800/60">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-violet-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">Cor ou Link Customizado</h3>
            </div>
            <Input 
              value={session?.presentationBackground || ''}
              onChange={(e) => onUpdate({ presentationBackground: e.target.value })}
              placeholder="Ex: #0f172a ou link da imagem..."
              className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 font-semibold text-xs focus:ring-violet-500/20 dark:text-slate-100 transition-all"
            />
          </div>
        </div>

        {/* Card 2: Temas de Interface */}
        <div className="md:col-span-5 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-violet-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">Temas de Interface</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['cinematic', 'minimalist', 'corporate', 'glass'] as const).map(t => (
                <button 
                  key={t}
                  onClick={() => onUpdate({ presentationTheme: t })}
                  className={cn(
                    "h-14 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all hover:scale-[1.02]",
                    session?.presentationTheme === t 
                      ? "border-violet-600 bg-violet-50/50 text-violet-600 dark:bg-violet-950/20 dark:text-violet-400 shadow-sm" 
                      : "border-slate-100 dark:border-slate-800 text-slate-400 hover:border-slate-200 dark:hover:border-slate-700 bg-white dark:bg-slate-900/40"
                  )}
                >
                  <div className={cn(
                    "w-7 h-3 rounded-sm shadow-inner transition-all",
                    t === 'glass' ? "bg-slate-200/50 backdrop-blur-sm dark:bg-slate-700/50 border border-white/10" : 
                    t === 'minimalist' ? "bg-white border dark:bg-slate-800 dark:border-slate-700" :
                    t === 'corporate' ? "bg-slate-800 dark:bg-slate-950" : "bg-[#050510]"
                  )} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">{t}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-violet-500/5 dark:bg-slate-950/40 p-2.5 rounded-xl border border-violet-500/10 dark:border-slate-800/60">
            <p className="text-[8.5px] font-semibold text-slate-500 dark:text-slate-400 leading-normal">
              O tema altera a visualização da tela principal do Showcase (Modo Apresentação).
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderSquad = () => (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="p-6 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 space-y-4 max-w-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">Nome do Squad / Time</h3>
            <p className="text-[9.5px] font-semibold text-slate-450 dark:text-slate-400 mt-0.5">Identifique o time responsável por esta Sprint Review.</p>
          </div>
        </div>

        <div className="space-y-1.5 pt-2">
          <Input 
            value={session?.squadName || ''} 
            onChange={(e) => onUpdate({ squadName: e.target.value })}
            placeholder="Ex: Squad Phoenix"
            className="h-11 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 font-bold text-sm focus:ring-violet-500/20 dark:text-slate-100 transition-all"
          />
        </div>

        <div className="pt-4 border-t border-slate-150 dark:border-slate-800/60 flex items-center gap-3">
          <div className="flex -space-x-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 bg-slate-150 dark:bg-slate-800 flex items-center justify-center text-[9px] font-black text-slate-450 dark:text-slate-400 uppercase">
                {String.fromCharCode(64 + i)}
              </div>
            ))}
          </div>
          <span className="text-[9px] font-semibold text-slate-450 dark:text-slate-400 tracking-normal">
            O nome do Squad aparecerá no topo do showcase e nos relatórios.
          </span>
        </div>
      </div>
    </motion.div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[920px] w-[95vw] h-[85vh] sm:h-[580px] rounded-[2rem] p-0 border-none shadow-2xl overflow-hidden bg-white dark:bg-slate-900 flex flex-col focus:outline-none">
        <div className="sr-only">
          <DialogTitle>Configurações da Sessão</DialogTitle>
          <DialogDescription>Ajuste o nome, identidade visual e squad da sua Sprint Review.</DialogDescription>
        </div>
        <div className="flex flex-1 h-full">
          {/* Sidebar */}
          <div className="w-[240px] bg-slate-900 dark:bg-slate-950 border-r dark:border-slate-800/80 flex flex-col shrink-0 p-6 justify-between">
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/20">
                  <Settings className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-tighter italic text-white leading-none">Setup</h3>
                  <p className="text-[7.5px] font-black text-white/30 uppercase tracking-[0.2em] mt-1">Configurações</p>
                </div>
              </div>

              <nav className="space-y-1.5">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={cn(
                      "w-full group flex items-center gap-3.5 p-3 rounded-2xl transition-all text-left relative overflow-hidden",
                      activeTab === tab.id 
                        ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20 scale-[1.01]" 
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <tab.icon className={cn("h-4.5 w-4.5", activeTab === tab.id ? "text-white" : "text-slate-500 group-hover:text-violet-400")} />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-wider leading-none">{tab.label}</span>
                      <span className={cn(
                        "text-[8.5px] font-bold mt-1 uppercase tracking-tight transition-colors",
                        activeTab === tab.id ? "text-white/70" : "text-slate-500 group-hover:text-slate-450"
                      )}>
                        {tab.description}
                      </span>
                    </div>
                    {activeTab === tab.id && (
                      <motion.div layoutId="tab-active" className="absolute right-3">
                        <ChevronRight className="h-3.5 w-3.5 text-white/40" />
                      </motion.div>
                    )}
                  </button>
                ))}
              </nav>
            </div>

            <div className="pt-6 border-t border-white/5">
               <div className="bg-white/5 rounded-xl p-3 border border-white/5 shadow-inner">
                  <p className="text-[9px] font-black text-violet-400 uppercase tracking-widest mb-1.5">Dica Elite</p>
                  <p className="text-[10px] text-slate-300 leading-normal italic">
                     Use imagens do Unsplash para um visual cinematográfico na sua show.
                  </p>
               </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
               <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 leading-none">
                      {tabs.find(t => t.id === activeTab)?.label}
                    </h2>
                    <div className="w-10 h-1 bg-violet-600 rounded-full mt-3" />
                  </div>
               </div>

               <AnimatePresence mode="wait">
                 {activeTab === 'geral' && renderGeral()}
                 {activeTab === 'identidade' && renderIdentidade()}
                 {activeTab === 'apresentacao' && renderApresentacao()}
                 {activeTab === 'squad' && renderSquad()}
               </AnimatePresence>
            </div>

            <div className="py-3 px-6 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-end gap-3 shrink-0">
               <Button onClick={onClose} variant="ghost" className="rounded-xl font-black text-[9px] uppercase tracking-widest text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-200">
                 Cancelar
               </Button>
               <Button onClick={handleSave} className="h-10 px-8 rounded-xl bg-slate-900 hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 text-white font-black uppercase tracking-widest text-[9px] shadow-xl shadow-slate-200 dark:shadow-none transition-all active:scale-95">
                 Salvar Alterações
               </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
