'use client';

import React, { useState } from 'react';
import {
  Sparkles, Link as LinkIcon, Check, AlertTriangle,
  Layout, Target, Palette, Video, SortAsc, Camera,
  Sun, Moon, Pipette
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ShowcaseSession, ShowcaseTask, PRESETS, PRESENTATION_PRESETS, PresentationPreset } from './types';
import { getDirectImageUrl, isLightBackground } from './utils';

interface SessionSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  session: ShowcaseSession | null;
  onUpdate: (updates: Partial<ShowcaseSession>) => void;
  // true quando o dialog foi reaberto porque o usuário tentou apresentar
  // sem preencher Objetivos/Capa — mostra o banner de aviso em vez de abrir
  // silencioso como o botão de Config normal.
  presentWarning?: boolean;
  onPresentAnyway?: () => void;
}

type TabType = 'geral' | 'identidade' | 'apresentacao';

/**
 * Réplica em miniatura do painel lateral do Modo Teatro (TeatroMode.tsx) —
 * mesma lógica de fundo/tema, só em escala menor. Sem isso a aba só deixava
 * escolher fundo/tema às cegas, o resultado real só aparecia abrindo a
 * apresentação inteira.
 */
function PresentationPreview({ background, theme, task }: { background?: string; theme?: ShowcaseSession['presentationTheme']; task?: ShowcaseTask }) {
  const isLight = isLightBackground(background);
  const isGlass = theme === 'glass';
  const isMinimalist = theme === 'minimalist';

  const bgStyle: React.CSSProperties = background
    ? {
        background: background.startsWith('http')
          ? `linear-gradient(rgba(5, 5, 16, 0.9), rgba(5, 5, 16, 0.95)), url(${background})`
          : background,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { background: 'linear-gradient(135deg, #050510 0%, #0d0d1f 50%, #050510 100%)' };

  const badgeKey = task?.key || 'DEMO-101';
  const title = task?.title || 'Assim seus cards vão aparecer na tela';
  const desc = task?.evidence?.problem || task?.description || 'Evidência, contexto do negócio e resultados da entrega.';

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl transition-all duration-500" style={bgStyle}>
      {/* Indicador de Modo Claro/Escuro */}
      <div className="absolute top-3 right-3 z-20">
        <span className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur-md border shadow-sm transition-colors",
          isLight
            ? "bg-white/90 text-slate-800 border-slate-200 shadow-slate-900/5"
            : "bg-slate-950/80 text-white/90 border-white/10"
        )}>
          {isLight ? <Sun className="h-3 w-3 text-amber-500 shrink-0" /> : <Moon className="h-3 w-3 text-violet-400 shrink-0" />}
          {isLight ? "Modo Claro Ativo" : "Modo Escuro Ativo"}
        </span>
      </div>

      {/* Painel lateral do card */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 w-[58%] max-w-[270px] p-5 flex flex-col justify-between border-r transition-all duration-300',
          isLight
            ? (isGlass ? 'bg-white/80 backdrop-blur-xl border-slate-200/90 shadow-sm' : 'bg-white/95 backdrop-blur-md border-slate-200 shadow-sm')
            : (isGlass ? 'bg-white/[0.03] backdrop-blur-2xl border-white/10' : 'bg-[#080812]/95 backdrop-blur-2xl border-white/10'),
          isMinimalist && 'border-r-0 shadow-none'
        )}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              'text-[9px] font-bold px-2.5 py-1 rounded-full shrink-0 tracking-wide',
              task ? 'bg-violet-600 text-white shadow-sm' : (isLight ? 'bg-violet-100 text-violet-700' : 'bg-white/10 text-white/70')
            )}>
              {badgeKey}
            </span>
            <span className={cn(
              "text-[9px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0",
              isLight ? "bg-emerald-100 text-emerald-700 border border-emerald-200/60" : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
            )}>
              <Check className="h-2.5 w-2.5" /> Aprovado
            </span>
          </div>
          <h4 className={cn('text-[14px] font-bold leading-tight line-clamp-2 transition-colors', isLight ? 'text-slate-900' : 'text-white')}>
            {title}
          </h4>
          <p className={cn('text-[10.5px] leading-relaxed line-clamp-3 transition-colors', isLight ? 'text-slate-600' : 'text-white/60')}>
            {desc}
          </p>
        </div>

        <div className={cn(
          'pt-3 border-t flex items-center justify-between text-[9px] font-bold uppercase tracking-wider transition-colors',
          isLight ? 'border-slate-100 text-slate-400' : 'border-white/5 text-white/40'
        )}>
          <span>Desenvolvedor</span>
          <span className={cn('font-black', isLight ? 'text-slate-800' : 'text-white/90')}>{task?.evidence?.dev || 'Ana Silva'}</span>
        </div>
      </div>

      {/* Área de evidência à direita */}
      <div className="absolute inset-y-0 right-0 left-[58%] flex items-center justify-center p-6">
        <div className={cn(
          'w-full max-w-[210px] aspect-video rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all shadow-sm',
          isLight
            ? 'bg-white/80 border-slate-200/90 text-slate-500 shadow-slate-200/50'
            : 'bg-white/[0.03] border-white/10 text-white/40'
        )}>
          <Camera className="h-7 w-7 opacity-70" />
          <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">Evidência / Demo</span>
        </div>
      </div>
    </div>
  );
}

export function SessionSettingsDialog({ open, onClose, session: initialSession, onUpdate: onCommit, presentWarning, onPresentAnyway }: SessionSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>('geral');
  const [presetFilter, setPresetFilter] = useState<'all' | 'light' | 'dark'>('all');
  const [session, setSession] = useState<Partial<ShowcaseSession>>({});
  const [coverUrl, setCoverUrl] = useState('');
  const [previewError, setPreviewError] = useState(false);

  // A sessão do pai muda de referência a cada broadcast de WebSocket (SESSION_UPDATED),
  // disparado por QUALQUER save na sessão (editar um card, favoritar, etc.), não só
  // pelo que esse dialog controla. Sincronizar direto de `initialSession` a cada
  // mudança apagava edições locais não salvas se um broadcast concorrente chegasse
  // com o dialog aberto. Guardamos a versão mais recente numa ref (sem disparar
  // re-sync) e só carregamos no form quando o dialog efetivamente abre.
  const latestSessionRef = React.useRef(initialSession);
  React.useEffect(() => { latestSessionRef.current = initialSession; }, [initialSession]);

  React.useEffect(() => {
    if (open && latestSessionRef.current) {
      setSession(latestSessionRef.current);
      setCoverUrl(latestSessionRef.current.coverImage || '');
      setPreviewError(false);
    }
  }, [open]);

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
    { id: 'geral', label: 'Geral', icon: Layout, description: 'Nome, time e objetivos' },
    { id: 'identidade', label: 'Capa', icon: Palette, description: 'Tela de abertura da Review' },
    { id: 'apresentacao', label: 'Apresentação', icon: Video, description: 'Cores e fundo do Modo Teatro' },
  ];

  // Prontidão da sessão: os 3 campos que fazem diferença real numa
  // apresentação (o resto tem fallback razoável ou não é essencial).
  const checklist = [
    { key: 'squad', label: 'Squad / Time', done: !!session?.squadName?.trim(), tab: 'geral' as TabType },
    { key: 'objetivos', label: 'Objetivos da Sprint', done: !!session?.description?.trim(), tab: 'geral' as TabType },
    { key: 'capa', label: 'Capa da sessão', done: !!session?.coverImage, tab: 'identidade' as TabType },
  ];
  const doneCount = checklist.filter(c => c.done).length;

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
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Identificação</h3>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Título da Review</label>
            <Input 
              value={session?.name || ''} 
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="Ex: Review Sprint 42"
              className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 font-semibold text-xs focus:ring-violet-500/20 dark:text-slate-100 transition-all"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Squad / Time</label>
            <Input
              value={session?.squadName || ''}
              onChange={(e) => onUpdate({ squadName: e.target.value })}
              placeholder="Ex: Squad Phoenix"
              className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 font-semibold text-xs focus:ring-violet-500/20 dark:text-slate-100 transition-all"
            />
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium ml-1">Aparece no topo do showcase e nos relatórios.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Data / Ciclo</label>
            <Input
              value={session?.period || ''}
              onChange={(e) => onUpdate({ period: e.target.value })}
              placeholder="Ex: 2026 / Q1"
              className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 font-semibold text-xs focus:ring-violet-500/20 dark:text-slate-100 transition-all"
            />
          </div>
        </div>

        {/* Card 2: Ordem dos cards */}
        <div className="md:col-span-6 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 space-y-4">
          <div className="flex items-center gap-2">
            <SortAsc className="h-4 w-4 text-violet-500" />
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ordem dos cards</h3>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Ordenar por</label>
            <Select
              value={session?.defaultSort || 'key'}
              onValueChange={(v) => onUpdate({ defaultSort: v as any })}
            >
              <SelectTrigger className="h-10 w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 rounded-xl text-sm font-semibold focus:ring-0 text-slate-800 dark:text-slate-200">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 dark:bg-slate-900">
                <SelectItem value="key" className="text-sm font-semibold">Chave do Jira</SelectItem>
                <SelectItem value="type" className="text-sm font-semibold">Tipo de issue</SelectItem>
                <SelectItem value="dev" className="text-sm font-semibold">Desenvolvedor</SelectItem>
                <SelectItem value="qa" className="text-sm font-semibold">QA / validador</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium ml-1">Define a ordem em que os cards aparecem na lista e na apresentação.</p>
          </div>
        </div>

        {/* Card 3: Objetivos da Sprint */}
        <div className="md:col-span-12 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 space-y-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-violet-500" />
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Objetivos da sprint</h3>
          </div>
          <Textarea 
            value={session?.description || ''} 
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Ex: reduzimos o tempo de fechamento de pedido de 40s para 12s..."
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
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Fundos prontos</h3>
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
                    <p className="text-[11px] font-black text-white uppercase tracking-wider">{p.name}</p>
                    <p className="text-[10px] text-white/80 uppercase font-bold tracking-tight line-clamp-1 mt-0.5">{p.description}</p>
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

          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-violet-500" />
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Imagem de fundo por link</h3>
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
                className="h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold uppercase tracking-wider text-[11px] shrink-0"
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
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Visualização da Capa</h3>
          </div>

          {previewError && coverUrl ? (
            <div className="flex-1 min-h-[160px] p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex flex-col items-center justify-center text-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">Erro no Preview</p>
              <p className="text-[11px] text-slate-400 leading-normal max-w-[180px]">Essa imagem não carregou. Confira se o link está correto e é público — alguns sites bloqueiam exibir a imagem fora deles.</p>
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
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-400">Preview</span>
                <h4 className="text-white text-xs font-black uppercase tracking-tight truncate leading-none mt-1">{session?.name || 'Sua Sprint Review'}</h4>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-[160px] border-2 border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-2 p-4 text-center">
              <Sparkles className="h-6 w-6 text-slate-300 dark:text-slate-700" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Nenhuma capa selecionada</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderApresentacao = () => {
    const filteredPresets = PRESENTATION_PRESETS.filter(p => {
      if (presetFilter === 'light') return p.category === 'light';
      if (presetFilter === 'dark') return p.category === 'dark';
      return true;
    });

    const isLightBg = isLightBackground(session?.presentationBackground);

    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Coluna esquerda: Controles e Seleção de Fundo */}
          <div className="md:col-span-6 space-y-4">
            {/* Bloco 1: Presets Curados */}
            <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Cores do Modo Teatro
                  </h3>
                </div>
                {isLightBg && (
                  <span className="text-[11px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Sun className="h-2.5 w-2.5" /> Fundo Claro Ativo
                  </span>
                )}
              </div>

              {/* Filtros de Categoria */}
              <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPresetFilter('all')}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
                    presetFilter === 'all'
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  Todos ({PRESENTATION_PRESETS.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPresetFilter('light')}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1",
                    presetFilter === 'light'
                      ? "bg-amber-500 text-white shadow-sm"
                      : "text-slate-500 hover:text-amber-600 dark:hover:text-amber-400"
                  )}
                >
                  <Sun className="h-3 w-3" /> Fundo Claro ({PRESENTATION_PRESETS.filter(p => p.category === 'light').length})
                </button>
                <button
                  type="button"
                  onClick={() => setPresetFilter('dark')}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1",
                    presetFilter === 'dark'
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-violet-600 dark:hover:text-violet-400"
                  )}
                >
                  <Moon className="h-3 w-3" /> Escuros ({PRESENTATION_PRESETS.filter(p => p.category === 'dark').length})
                </button>
              </div>

              {/* Lista de Cards de Presets */}
              <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                {filteredPresets.map((p) => {
                  const isSelected = session?.presentationBackground === p.value;
                  const isLightPreset = p.isLight;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onUpdate({ presentationBackground: p.value })}
                      className={cn(
                        "group relative p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all hover:scale-[1.01] hover:shadow-md",
                        isSelected
                          ? "border-violet-600 bg-violet-50/60 dark:bg-violet-950/30 shadow-sm ring-2 ring-violet-500/20"
                          : "border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900/70 hover:border-slate-300 dark:hover:border-slate-700"
                      )}
                    >
                      {/* Swatch redondinho com anel de contraste */}
                      <div
                        style={{ background: p.value }}
                        className={cn(
                          "w-9 h-9 rounded-lg shrink-0 flex items-center justify-center relative shadow-inner overflow-hidden",
                          isLightPreset
                            ? "border-2 border-slate-300 dark:border-slate-600 shadow-sm"
                            : "border border-white/15"
                        )}
                      >
                        {isSelected && (
                          <div className={cn(
                            "w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-md",
                            isLightPreset ? "bg-violet-600 text-white" : "bg-white text-slate-900"
                          )}>
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      {/* Títulos e detalhes */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={cn(
                            "text-[10px] font-black truncate leading-tight",
                            isSelected ? "text-violet-700 dark:text-violet-300" : "text-slate-800 dark:text-slate-200"
                          )}>
                            {p.name}
                          </p>
                          {p.id === 'white' && (
                            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-1 py-0.2 rounded shrink-0">
                              PROJETOR
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium line-clamp-1 mt-0.5 leading-snug">
                          {p.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Seletor Customizado & Paleta Rápida */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Pipette className="h-3.5 w-3.5 text-violet-500" />
                    <h3 className="text-[9.5px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">
                      Cor Livre ou Link
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">Hexadecimal / CSS</span>
                </div>

                <div className="flex gap-2 items-center">
                  <label className="relative flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer overflow-hidden shrink-0 hover:scale-105 transition-transform shadow-inner" title="Abrir Seletor de Cores">
                    <input
                      type="color"
                      value={session?.presentationBackground?.startsWith('#') && session.presentationBackground.length === 7 ? session.presentationBackground : '#ffffff'}
                      onChange={(e) => onUpdate({ presentationBackground: e.target.value })}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                    />
                    <div
                      className="w-full h-full rounded-xl flex items-center justify-center"
                      style={{ background: session?.presentationBackground || '#050510' }}
                    >
                      <Palette className={cn("h-4 w-4 drop-shadow", isLightBg ? "text-slate-800" : "text-white")} />
                    </div>
                  </label>

                  <Input
                    value={session?.presentationBackground || ''}
                    onChange={(e) => onUpdate({ presentationBackground: e.target.value })}
                    placeholder="Ex: #ffffff, #0f172a ou https://..."
                    className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 font-semibold text-xs focus:ring-violet-500/20 dark:text-slate-100 transition-all flex-1"
                  />
                </div>

                {/* Chips de Atalho Rápido */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">Atalhos:</span>
                  {[
                    { label: 'Branco Puro', value: '#ffffff', border: true },
                    { label: 'Studio Off-White', value: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', border: true },
                    { label: 'Deep Space', value: 'linear-gradient(135deg, #050510 0%, #0d0d1f 50%, #050510 100%)' },
                    { label: 'Noite Índigo', value: 'linear-gradient(135deg, #0b0f19 0%, #1e1b4b 50%, #0f172a 100%)' },
                    { label: 'Tech Emerald', value: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #021a14 100%)' },
                  ].map((chip) => {
                    const isChipActive = session?.presentationBackground === chip.value;
                    return (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => onUpdate({ presentationBackground: chip.value })}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 border",
                          isChipActive
                            ? "border-violet-600 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/30 font-black shadow-sm"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                        )}
                      >
                        <span
                          className={cn("w-2.5 h-2.5 rounded-full shrink-0", chip.border && "border border-slate-300 dark:border-slate-600")}
                          style={{ background: chip.value }}
                        />
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bloco 2: Temas de Interface */}
            <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layout className="h-4 w-4 text-violet-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Estilo de Interface
                  </h3>
                </div>
                <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest">
                  {session?.presentationTheme || 'cinematic'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'cinematic', label: 'Cinematográfico', desc: 'Foco no conteúdo com bordas suaves e presença cênica' },
                  { id: 'minimalist', label: 'Minimalista', desc: 'Sem divisórias laterais, layout limpo e direto' },
                  { id: 'corporate', label: 'Corporativo', desc: 'Estrutura sólida executiva para stakeholders' },
                  { id: 'glass', label: 'Glassmorphism', desc: 'Painéis translúcidos com efeito de desfoque moderno' }
                ].map((t) => {
                  const isThemeSelected = (session?.presentationTheme || 'cinematic') === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onUpdate({ presentationTheme: t.id as any })}
                      className={cn(
                        "p-2.5 rounded-xl border-2 flex flex-col text-left gap-1 transition-all hover:scale-[1.01]",
                        isThemeSelected
                          ? "border-violet-600 bg-violet-50/50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-300 shadow-sm"
                          : "border-slate-100 dark:border-slate-800 text-slate-500 hover:border-slate-200 dark:hover:border-slate-700 bg-white dark:bg-slate-900/40"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9.5px] font-black uppercase tracking-wider">{t.label}</span>
                        {isThemeSelected && <Check className="h-3 w-3 text-violet-600" />}
                      </div>
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 line-clamp-1 leading-snug">
                        {t.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Coluna direita: Prévia ao vivo em tempo real */}
          <div className="md:col-span-6 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-violet-500" />
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Pré-visualização
                </h3>
              </div>
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                Como a audiência verá
              </span>
            </div>

            <div className="flex-1 min-h-[380px] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-inner bg-slate-950/5">
              <PresentationPreview
                background={session?.presentationBackground}
                theme={session?.presentationTheme}
                task={session?.tasks?.[0]}
              />
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[1000px] w-[96vw] h-[90vh] sm:h-[680px] max-h-[92vh] rounded-[2rem] p-0 border border-border shadow-2xl overflow-hidden bg-card text-card-foreground flex flex-col gap-0 focus:outline-none">
        {/* Cabeçalho: mesmo padrão dos modais do Poker (título, explicação, abas) */}
        <div className="px-6 pt-6 pb-0 shrink-0">
          <DialogTitle className="text-2xl font-black tracking-tight text-foreground leading-none pr-8">Configurações da Review</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1.5">
            Nome, capa e aparência da apresentação. Nada aqui é obrigatório, mas capa e objetivos deixam a Review mais completa.
          </DialogDescription>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-border">
            <nav className="flex items-center gap-1" role="tablist" aria-label="Seções das configurações">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  title={tab.description}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors",
                    activeTab === tab.id
                      ? "border-violet-500 text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <tab.icon className={cn("h-4 w-4", activeTab === tab.id ? "text-violet-500" : "")} />
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2 pb-2 text-xs" aria-label="Antes de apresentar">
              <span className="font-bold text-muted-foreground">Antes de apresentar · {doneCount}/{checklist.length}</span>
              {checklist.map(c => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setActiveTab(c.tab)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold transition-colors",
                    c.done
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-violet-500/50"
                  )}
                >
                  {c.done ? <Check className="h-3 w-3" /> : <span className="h-2.5 w-2.5 rounded-full border border-current opacity-60" />}
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          {presentWarning && (
            <div className="mb-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400">Esta Review ainda não tem objetivos nem capa</p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/70 font-medium">Complete agora ou apresente do jeito que está.</p>
              </div>
              <Button onClick={onPresentAnyway} variant="outline" className="h-9 px-4 rounded-xl border-amber-500/40 text-amber-600 dark:text-amber-400 font-bold text-xs shrink-0 hover:bg-amber-500/10">
                Apresentar mesmo assim
              </Button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {activeTab === 'geral' && renderGeral()}
            {activeTab === 'identidade' && renderIdentidade()}
            {activeTab === 'apresentacao' && renderApresentacao()}
          </AnimatePresence>
        </div>

        {/* Rodapé */}
        <div className="py-3 px-6 border-t border-border flex items-center justify-between gap-3 shrink-0">
          <p className="hidden md:block text-xs text-muted-foreground">
            Vai apresentar em projetor ou sala com muita luz? Em <strong className="font-semibold text-foreground">Apresentação</strong>, escolha o fundo Branco Puro.
          </p>
          <div className="flex items-center gap-3 ml-auto">
            <Button onClick={onClose} variant="ghost" className="rounded-xl font-bold text-sm text-muted-foreground hover:text-foreground">
              Cancelar
            </Button>
            <Button onClick={handleSave} className="h-10 px-8 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-lg shadow-violet-600/25 transition-all active:scale-95">
              Salvar alterações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
