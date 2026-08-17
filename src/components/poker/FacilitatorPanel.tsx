'use client';

import { useState } from 'react';
import { DeckType, DECKS } from '@/lib/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Settings, Users, Eye, WalletCards, AlertTriangle, Save, BarChart3, ShieldCheck, HelpCircle, Clock, FileText, Bell, TrendingUp, CheckCircle2, RotateCcw, Smile, Search, Pin, Layers, Sparkles, Hourglass } from 'lucide-react';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { cn } from "@/lib/utils";
import type { LucideIcon } from 'lucide-react';

type DivergenceThresholds = { warn: number; high: number };
type FacilitatorSettings = { allowManagementToVote?: boolean; autoReveal?: boolean; divergenceThresholds?: DivergenceThresholds; outlierPrompt?: boolean; confidenceVote?: boolean; showVelocity?: boolean; anonymousReveal?: boolean; turnNotification?: boolean; showDistribution?: boolean; decisionNotes?: boolean; perTopicTime?: boolean; autoTimer?: boolean; groomingFlag?: boolean; autoConsensus?: boolean; suggestRevote?: boolean; reactions?: boolean; groupVotesByRole?: boolean; referenceStory?: boolean; roundNudge?: boolean; maxRounds?: number; refinementNotes?: boolean; parkTask?: boolean };

interface FacilitatorPanelProps {
  deck: DeckType;
  allowManagementToVote?: boolean;
  autoReveal?: boolean;
  outlierPrompt?: boolean;
  confidenceVote?: boolean;
  showVelocity?: boolean;
  anonymousReveal?: boolean;
  turnNotification?: boolean;
  showDistribution?: boolean;
  decisionNotes?: boolean;
  perTopicTime?: boolean;
  autoTimer?: boolean;
  groomingFlag?: boolean;
  autoConsensus?: boolean;
  suggestRevote?: boolean;
  reactions?: boolean;
  groupVotesByRole?: boolean;
  referenceStory?: boolean;
  roundNudge?: boolean;
  maxRounds?: number;
  refinementNotes?: boolean;
  parkTask?: boolean;
  divergenceThresholds?: DivergenceThresholds;
  onUpdateSettings: (settings: Partial<FacilitatorSettings>) => void;
  onSetDeck?: (deck: DeckType) => void;
  onSaveTemplate?: () => void;
  // Auto-reveal/auto-timer só fazem sentido no modo síncrono; escondidos no async.
  showAutoReveal?: boolean;
  // Limites de divergência só são aplicados no cálculo síncrono; escondidos no async.
  showDivergence?: boolean;
  // Referência e aviso de rodadas só estão implementados no síncrono por
  // enquanto; escondidos no async pra não expor toggle inerte.
  showRoundFeatures?: boolean;
  isEmbeddedInSheet?: boolean;
}

const DECK_LABELS: Record<string, string> = {
  fibonacci: 'Fibonacci',
  hours: 'Horas Reais',
  tshirt: 'Camisetas',
};

// Linha de toggle compacta e reutilizável.
function ToggleRow({ icon: Icon, id, title, desc, checked, onChange }: {
  icon: LucideIcon; id: string; title: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className={cn(
      "p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all",
      checked ? "border-indigo-300 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/20" : "border-slate-100 dark:border-border/40 bg-slate-50 dark:bg-slate-900/40"
    )}>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1.5 bg-white dark:bg-card rounded-lg border border-slate-100 dark:border-border/40 shrink-0">
          <Icon className="h-4 w-4 text-indigo-500" />
        </div>
        <div className="min-w-0">
          <Label htmlFor={id} className="text-[13px] font-bold text-slate-800 dark:text-foreground tracking-tight italic cursor-pointer block truncate">{title}</Label>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">{desc}</p>
        </div>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="shrink-0" />
    </div>
  );
}

export function FacilitatorPanel({
  deck,
  allowManagementToVote,
  autoReveal,
  outlierPrompt,
  confidenceVote,
  showVelocity,
  anonymousReveal,
  turnNotification,
  showDistribution,
  decisionNotes,
  perTopicTime,
  autoTimer,
  groomingFlag,
  autoConsensus,
  suggestRevote,
  reactions,
  groupVotesByRole,
  referenceStory,
  roundNudge,
  maxRounds,
  refinementNotes,
  parkTask,
  divergenceThresholds,
  onUpdateSettings,
  onSetDeck,
  onSaveTemplate,
  showAutoReveal = true,
  showDivergence = true,
  showRoundFeatures = true,
  isEmbeddedInSheet = false,
}: FacilitatorPanelProps) {
  const warn = divergenceThresholds?.warn ?? 2;
  const high = divergenceThresholds?.high ?? 5;
  const [tab, setTab] = useState('votacao');
  const [search, setSearch] = useState('');

  const TAB_DEFS = [
    { v: 'votacao', label: 'Votação' },
    { v: 'revelacao', label: 'Revelação' },
    { v: 'tempo', label: 'Tempo' },
    { v: 'relatorios', label: 'Relatórios' },
    { v: 'sessao', label: 'Sessão' },
  ];

  // Toggles como dados: renderiza por aba E permite buscar entre todas as abas
  // sem duplicar JSX. `visible: false` esconde (ex.: auto-reveal só no síncrono).
  type ToggleDef = { id: string; icon: LucideIcon; title: string; desc: string; tab: string; value: boolean; key: keyof FacilitatorSettings; visible?: boolean };
  const toggleDefs: ToggleDef[] = [
    { id: 'allow-management-vote', icon: Users, title: 'Gestão pode votar', desc: 'Inclui papéis de gestão', tab: 'votacao', value: !!allowManagementToVote, key: 'allowManagementToVote' },
    { id: 'confidence-vote', icon: ShieldCheck, title: 'Voto de confiança', desc: 'Baixa / média / alta', tab: 'votacao', value: !!confidenceVote, key: 'confidenceVote' },
    { id: 'grooming-flag', icon: HelpCircle, title: 'Enviar p/ grooming', desc: 'Ação nos votos "?"', tab: 'votacao', value: !!groomingFlag, key: 'groomingFlag' },
    { id: 'auto-consensus', icon: CheckCircle2, title: 'Auto-consenso', desc: 'Salva/avança no consenso', tab: 'votacao', value: !!autoConsensus, key: 'autoConsensus' },
    { id: 'reactions', icon: Smile, title: 'Reações (emoji)', desc: 'Barra durante a votação', tab: 'votacao', value: !!reactions, key: 'reactions' },
    { id: 'reference-story', icon: Pin, title: 'História de referência', desc: 'Régua visível na votação', tab: 'votacao', value: !!referenceStory, key: 'referenceStory', visible: showRoundFeatures },
    { id: 'round-nudge', icon: Layers, title: 'Aviso de rodadas', desc: 'Sugere quebrar/adiar após N', tab: 'votacao', value: !!roundNudge, key: 'roundNudge', visible: showRoundFeatures },
    { id: 'park-task', icon: Hourglass, title: 'Adiar tarefa', desc: 'Volta o item pro fim da fila', tab: 'votacao', value: !!parkTask, key: 'parkTask', visible: showRoundFeatures },
    { id: 'auto-reveal', icon: Eye, title: 'Revelar automaticamente', desc: 'Quando todos votarem', tab: 'revelacao', value: !!autoReveal, key: 'autoReveal', visible: showAutoReveal },
    { id: 'anonymous-reveal', icon: Eye, title: 'Revelação anônima', desc: 'Esconde quem votou o quê', tab: 'revelacao', value: !!anonymousReveal, key: 'anonymousReveal' },
    { id: 'outlier-prompt', icon: AlertTriangle, title: 'Explicar votos extremos', desc: 'Destaca maior e menor', tab: 'revelacao', value: !!outlierPrompt, key: 'outlierPrompt' },
    { id: 'show-distribution', icon: BarChart3, title: 'Histograma de votos', desc: 'Distribuição por valor', tab: 'revelacao', value: !!showDistribution, key: 'showDistribution' },
    { id: 'suggest-revote', icon: RotateCcw, title: 'Sugerir revotação', desc: 'Na divergência crítica', tab: 'revelacao', value: !!suggestRevote, key: 'suggestRevote' },
    { id: 'group-votes-by-role', icon: Users, title: 'Agrupar votos por papel', desc: 'Detalhamento em blocos por cargo', tab: 'revelacao', value: !!groupVotesByRole, key: 'groupVotesByRole' },
    { id: 'auto-timer', icon: Clock, title: 'Iniciar timer automático', desc: 'Ao abrir cada tarefa', tab: 'tempo', value: !!autoTimer, key: 'autoTimer', visible: showAutoReveal },
    { id: 'turn-notification', icon: Bell, title: 'Avisar "sua vez"', desc: 'Toast/som ao abrir rodada', tab: 'tempo', value: !!turnNotification, key: 'turnNotification' },
    { id: 'decision-notes', icon: FileText, title: 'Nota de decisão', desc: '"Por que estimamos X"', tab: 'relatorios', value: !!decisionNotes, key: 'decisionNotes' },
    { id: 'refinement-notes', icon: Sparkles, title: 'Notas de refinamento', desc: 'Painel Dev/QA por item', tab: 'relatorios', value: !!refinementNotes, key: 'refinementNotes', visible: showRoundFeatures },
    { id: 'per-topic-time', icon: Clock, title: 'Tempo por tópico', desc: 'Tempo real de cada item', tab: 'relatorios', value: !!perTopicTime, key: 'perTopicTime' },
    { id: 'show-velocity', icon: TrendingUp, title: 'Histórico do time', desc: 'Velocity das últimas sessões', tab: 'relatorios', value: !!showVelocity, key: 'showVelocity' },
  ];

  const renderToggle = (d: ToggleDef) => (
    <ToggleRow key={d.id} icon={d.icon} id={d.id} title={d.title} desc={d.desc} checked={d.value} onChange={(v) => onUpdateSettings({ [d.key]: v } as Partial<FacilitatorSettings>)} />
  );

  // Busca insensível a acento/caixa sobre os toggles visíveis.
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const q = norm(search.trim());
  const visibleDefs = toggleDefs.filter(d => d.visible !== false);
  const matched = q ? visibleDefs.filter(d => norm(d.title).includes(q) || norm(d.desc).includes(q)) : [];

  const gridCls = "grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-4 animate-in fade-in duration-300";
  const isSpecialVal = (v: string) => v === '?' || v === '☕';

  const deckPreview = (
    <div className="p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 bg-white dark:bg-card rounded-lg border border-indigo-100 dark:border-border/40 shrink-0"><WalletCards className="h-4 w-4 text-indigo-500" /></div>
          <div className="min-w-0">
            <Label className="text-[13px] font-bold text-slate-800 dark:text-foreground tracking-tight italic block">Escala de estimativa</Label>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Trocar reinicia os votos</p>
          </div>
        </div>
        {onSetDeck ? (
          <Select value={deck} onValueChange={(v: DeckType) => onSetDeck(v)}>
            <SelectTrigger className="h-9 w-32 rounded-xl border-slate-200 dark:border-border bg-white dark:bg-card font-bold text-xs shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl font-bold">
              <SelectItem value="fibonacci">Fibonacci</SelectItem>
              <SelectItem value="hours">Horas Reais</SelectItem>
              <SelectItem value="tshirt">Camisetas</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm font-black text-indigo-600 uppercase italic tracking-tighter shrink-0">{DECK_LABELS[deck] || deck}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {DECKS[deck].map(v => (
          <span key={v} className={cn(
            "min-w-[1.75rem] h-7 px-1.5 inline-flex items-center justify-center rounded-lg border text-[11px] font-black italic",
            isSpecialVal(v)
              ? "border-violet-200 dark:border-violet-900/40 text-violet-500 bg-violet-500/5"
              : "border-slate-200 dark:border-border bg-white dark:bg-card text-slate-700 dark:text-foreground"
          )}>{v}</span>
        ))}
      </div>
    </div>
  );

  const content = (
    <div className={cn(isEmbeddedInSheet ? "px-0 pb-0" : "px-6 pb-8 pt-4")}>
      {deckPreview}

      <div className="relative mt-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar ajuste..."
          className="h-9 pl-9 pr-16 text-xs font-medium rounded-xl bg-white dark:bg-card border-slate-200 dark:border-border"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Limpar</button>
        )}
      </div>

      {q ? (
        matched.length > 0 ? (
          <div className={gridCls}>
            {matched.map(renderToggle)}
          </div>
        ) : (
          <div className="mt-6 py-8 text-center text-slate-400">
            <Search className="h-6 w-6 mx-auto mb-2 opacity-40" />
            <p className="text-[11px] font-bold uppercase tracking-widest">Nenhum ajuste encontrado</p>
            <p className="text-[10px] mt-1 opacity-70">para "{search}"</p>
          </div>
        )
      ) : (
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full flex gap-1 overflow-x-auto bg-slate-100/70 dark:bg-slate-900/50 rounded-2xl p-1 h-auto scrollbar-none mt-3">
          {TAB_DEFS.map(t => (
            <TabsTrigger
              key={t.v}
              value={t.v}
              className="flex-1 min-w-fit whitespace-nowrap rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="votacao" className={gridCls}>
          {visibleDefs.filter(d => d.tab === 'votacao').map(renderToggle)}
          {showRoundFeatures && roundNudge && (
            <div className="md:col-span-2 p-3 rounded-2xl border border-slate-100 dark:border-border/40 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 bg-white dark:bg-card rounded-lg border border-slate-100 dark:border-border/40 shrink-0"><Layers className="h-4 w-4 text-indigo-500" /></div>
                <div className="min-w-0">
                  <Label htmlFor="max-rounds" className="text-[13px] font-bold text-slate-800 dark:text-foreground tracking-tight italic block">Teto de rodadas</Label>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Avisa ao passar disso sem consenso</p>
                </div>
              </div>
              <Input id="max-rounds" type="number" min={1} value={maxRounds ?? 3}
                onChange={(e) => onUpdateSettings({ maxRounds: Math.max(1, Number(e.target.value) || 3) })}
                className="h-10 w-20 rounded-xl bg-white dark:bg-card font-bold text-sm shrink-0" />
            </div>
          )}
        </TabsContent>

        <TabsContent value="revelacao" className={gridCls}>
          {visibleDefs.filter(d => d.tab === 'revelacao').map(renderToggle)}
          {deck === 'hours' && showDivergence && (
            <div className="md:col-span-2 p-3 rounded-2xl border border-slate-100 dark:border-border/40 bg-slate-50 dark:bg-slate-900/40 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white dark:bg-card rounded-lg border border-slate-100 dark:border-border/40"><AlertTriangle className="h-4 w-4 text-indigo-500" /></div>
                <div>
                  <Label className="text-[13px] font-bold text-slate-800 dark:text-foreground tracking-tight italic">Limites de divergência</Label>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Diferença de horas por papel que gera alerta</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="div-warn" className="text-[9px] font-black uppercase tracking-widest text-amber-600">Aviso acima de</Label>
                  <Input id="div-warn" type="number" min={0} value={warn}
                    onChange={(e) => { const w = Math.max(0, Number(e.target.value) || 0); onUpdateSettings({ divergenceThresholds: { warn: w, high: Math.max(w, high) } }); }}
                    className="h-10 rounded-xl bg-white dark:bg-card font-bold text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="div-high" className="text-[9px] font-black uppercase tracking-widest text-destructive">Crítico acima de</Label>
                  <Input id="div-high" type="number" min={0} value={high}
                    onChange={(e) => { const h = Math.max(0, Number(e.target.value) || 0); onUpdateSettings({ divergenceThresholds: { warn: Math.min(warn, h), high: h } }); }}
                    className="h-10 rounded-xl bg-white dark:bg-card font-bold text-sm" />
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="tempo" className={gridCls}>
          {visibleDefs.filter(d => d.tab === 'tempo').map(renderToggle)}
          {!showAutoReveal && (
            <p className="text-[10px] font-medium text-slate-400 italic px-1 self-center">Timer automático só no modo síncrono.</p>
          )}
        </TabsContent>

        <TabsContent value="relatorios" className={gridCls}>
          {visibleDefs.filter(d => d.tab === 'relatorios').map(renderToggle)}
        </TabsContent>

        <TabsContent value="sessao" className="mt-4 space-y-2.5 animate-in fade-in duration-300">
          {onSaveTemplate ? (
            <Button variant="outline" onClick={onSaveTemplate} className="w-full h-11 rounded-2xl border-slate-200 dark:border-border font-black uppercase text-[10px] tracking-widest gap-2">
              <Save className="h-4 w-4" /> Salvar como template
            </Button>
          ) : (
            <p className="text-[10px] font-medium text-slate-400 italic px-1">A escala de estimativa fica no topo do painel.</p>
          )}
        </TabsContent>
      </Tabs>
      )}
    </div>
  );

  if (isEmbeddedInSheet) {
    return content;
  }

  return (
    <Accordion type="single" collapsible className="w-full bg-white/40 backdrop-blur-xl rounded-[2rem] border border-white/80 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] overflow-hidden transition-all hover:shadow-[0_32px_64px_-16px_rgba(79,70,229,0.08)]" >
      <AccordionItem value="item-1" className="border-b-0">
        <AccordionTrigger className="px-6 py-4 hover:no-underline group">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors">
              <Settings className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none mb-1">Painel Master</p>
              <p className="text-sm font-bold text-slate-800 tracking-tight italic">Configurações da Cerimônia</p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="px-1">
            {content}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
