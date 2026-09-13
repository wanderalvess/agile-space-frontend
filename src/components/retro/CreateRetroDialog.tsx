'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  ArrowRight as ArrowRightIcon,
  Trash2,
  User,
  Clock,
  ThumbsUp,
  ListPlus,
  LayoutTemplate,
  Zap,
  Plus,
  Sparkles,
  MessageCircleHeart,
} from 'lucide-react';
import { RetroTemplateKey, RetroColumnTheme } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_HEALTH_CHECK_QUESTION } from '@/components/retro/RetroSettingsDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { listTemplates, type RetroTemplate } from '@/lib/retro-templates';

// Cada toggle carrega seu grupo — agrupadas por categoria na renderização,
// mesmo padrão do modal "Configurar Sessão" do Planning Poker (SETUP_GROUPS
// em app/room/page.tsx).
export const SETUP_TOGGLES = [
  { key: 'isAuthorsRevealed', group: 'Visibilidade e ritmo', icon: User, title: 'Autores Abertos', desc: 'Mostra quem escreveu cada card' },
  { key: 'syncStageEnabled', group: 'Visibilidade e ritmo', icon: Users, title: 'Sincronizar Coluna Ativa', desc: 'Todos veem a coluna focada' },
  { key: 'healthCheckEnabled', group: 'Visibilidade e ritmo', icon: MessageCircleHeart, title: 'Check-in Inicial', desc: 'Pergunta antes de abrir o quadro' },
  { key: 'autoRevealOnTimerEnd', group: 'Automação de fim de sessão', icon: Clock, title: 'Auto-revelar ao fim do timer', desc: 'Revela cards quando o tempo zera' },
  { key: 'autoSortOnVoteEnd', group: 'Automação de fim de sessão', icon: ThumbsUp, title: 'Ordenar por votos ao encerrar', desc: 'Aplica em colunas de feedback' },
] as const;

export type SetupToggleKey = typeof SETUP_TOGGLES[number]['key'];
export type SetupSettings = Record<SetupToggleKey, boolean>;

export const DEFAULT_SETUP_SETTINGS: SetupSettings = Object.fromEntries(
  SETUP_TOGGLES.map(t => [t.key, false])
) as SetupSettings;

// Grupos na ordem de exibição — derivados de SETUP_TOGGLES para não duplicar dados.
export const SETUP_GROUPS = Array.from(new Set(SETUP_TOGGLES.map(t => t.group))).map(label => ({
  label,
  items: SETUP_TOGGLES.filter(t => t.group === label),
}));

export interface TemplateOption {
  key: RetroTemplateKey;
  name: string;
  tagline: string;
  desc: string;
  columns: string[];
}

export const TEMPLATE_OPTIONS: TemplateOption[] = [
  {
    key: 'classic',
    name: 'Clássico',
    tagline: '3 Colunas',
    desc: 'O formato padrão de retrospectiva: o que funcionou, o que melhorar e ações.',
    columns: ['O que funcionou?', 'O que melhorar?', 'Plano de Ação'],
  },
  {
    key: 'start_stop_continue',
    name: 'Start / Stop / Continue',
    tagline: '3 Colunas',
    desc: 'Foco direto em comportamentos do time: começar, parar e continuar.',
    columns: ['Começar (Start)', 'Parar (Stop)', 'Continuar (Continue)'],
  },
  {
    key: 'four_ls',
    name: '4Ls',
    tagline: '5 Colunas',
    desc: 'Reflexão abrangente da sprint: Liked, Learned, Lacked e Longed For.',
    columns: ['Liked', 'Learned', 'Lacked', 'Longed For', 'Ações'],
  },
  {
    key: 'daki',
    name: 'DAKI',
    tagline: '5 Colunas',
    desc: 'Drop, Add, Keep, Improve — refinamento pragmático de práticas.',
    columns: ['Drop', 'Add', 'Keep', 'Improve', 'Ações'],
  },
  {
    key: 'sailboat',
    name: 'Sailboat',
    tagline: '5 Colunas',
    desc: 'Metáfora visual: ventos favoráveis, sol, âncoras e pedras adiante.',
    columns: ['Vento', 'Sol', 'Âncora', 'Pedras', 'Ações'],
  },
  {
    key: 'starfish',
    name: 'Starfish',
    tagline: '5 Colunas',
    desc: 'Estrela do mar: manter, fazer menos, fazer mais, começar e parar.',
    columns: ['Manter', 'Menos', 'Mais', 'Começar', 'Parar'],
  },
  {
    key: 'mad_sad_glad',
    name: 'Mad / Sad / Glad',
    tagline: '3 Colunas',
    desc: 'Foco no clima da squad: o que gerou alegria, tristeza ou frustração.',
    columns: ['Feliz (Glad)', 'Triste (Sad)', 'Irritado (Mad)'],
  },
  {
    key: 'three_little_pigs',
    name: '3 Porquinhos',
    tagline: '4 Colunas',
    desc: 'Nível de solidez dos processos: palha (frágil), madeira e tijolo (sólido).',
    columns: ['Palha (Frágil)', 'Madeira', 'Tijolo (Sólido)', 'Ações'],
  },
  {
    key: 'speed_car',
    name: 'Speed Car',
    tagline: '3 Colunas',
    desc: 'Metáfora de velocidade: motor (aceleradores) e paraquedas (freadores).',
    columns: ['Motor (Acelerador)', 'Paraquedas (Freador)', 'Ações'],
  },
  {
    key: 'custom',
    name: 'Personalizado',
    tagline: 'Custom',
    desc: 'Crie colunas exclusivas com nomes e temas definidos por você.',
    columns: ['Colunas configuráveis'],
  },
];

interface CreateRetroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onTitleChange: (value: string) => void;
  team: string;
  onTeamChange: (value: string) => void;
  template: RetroTemplateKey;
  onTemplateChange: (value: RetroTemplateKey) => void;
  customColumns: { title: string; theme: RetroColumnTheme }[];
  onCustomColumnsChange: (columns: { title: string; theme: RetroColumnTheme }[]) => void;
  setupSettings: SetupSettings;
  onSetupSettingsChange: (settings: SetupSettings) => void;
  healthCheckQuestion: string;
  onHealthCheckQuestionChange: (value: string) => void;
  isCreating: boolean;
  onCreate: () => void;
  onCancel: () => void;
}

export function CreateRetroDialog({
  open,
  onOpenChange,
  title,
  onTitleChange,
  team,
  onTeamChange,
  template,
  onTemplateChange,
  customColumns,
  onCustomColumnsChange,
  setupSettings,
  onSetupSettingsChange,
  healthCheckQuestion,
  onHealthCheckQuestionChange,
  isCreating,
  onCreate,
  onCancel,
}: CreateRetroDialogProps) {
  const [hoveredTemplate, setHoveredTemplate] = useState<RetroTemplateKey | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<RetroTemplate[]>([]);
  const [savedTemplateId, setSavedTemplateId] = useState('');
  const activeSetupCount = Object.values(setupSettings).filter(Boolean).length;

  // Carrega templates salvos (localStorage) toda vez que o modal abre.
  useEffect(() => {
    if (open) setSavedTemplates(listTemplates());
  }, [open]);

  const handleApplySavedTemplate = (id: string) => {
    if (id === 'none') { setSavedTemplateId(''); return; }
    setSavedTemplateId(id);
    const tpl = savedTemplates.find(t => t.id === id);
    if (!tpl) return;
    onTemplateChange(tpl.template);
    onCustomColumnsChange(tpl.customColumns);
    onSetupSettingsChange(tpl.setupSettings);
  };

  const currentOption = TEMPLATE_OPTIONS.find(t => t.key === (hoveredTemplate || template)) || TEMPLATE_OPTIONS[0];
  const previewColumns = template === 'custom'
    ? customColumns.map((c, i) => c.title.trim() || `Coluna ${i + 1}`)
    : currentOption.columns;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1100px] max-h-[94vh] overflow-y-auto gap-4 p-5 sm:p-6 rounded-[2rem] border border-border shadow-2xl bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-foreground leading-none">
            Configurar Retrospectiva
          </DialogTitle>
          <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1.5">
            Nomeie o quadro, escolha o formato das colunas e ajuste as permissões do facilitador
          </DialogDescription>
        </DialogHeader>

        {/* Começar de um template salvo — mesmo padrão do /room */}
        {savedTemplates.length > 0 && (
          <div className="space-y-2 px-1 pt-1">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Começar de um template
            </Label>
            <Select value={savedTemplateId || 'none'} onValueChange={handleApplySavedTemplate}>
              <SelectTrigger className="h-11 rounded-2xl border-border bg-muted/40 font-bold focus:ring-primary">
                <SelectValue placeholder="Retrospectiva em branco" />
              </SelectTrigger>
              <SelectContent className="rounded-xl font-bold">
                <SelectItem value="none">Retrospectiva em branco</SelectItem>
                {savedTemplates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Nome + squad */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
              <ListPlus className="h-3.5 w-3.5 text-primary" /> Título da Retrospectiva
            </Label>
            <Input
              placeholder="Ex: Fim da Sprint #42"
              value={title}
              onChange={e => onTitleChange(e.target.value)}
              className="h-11 rounded-2xl border-border focus:border-primary font-bold bg-muted/40 focus-visible:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" /> Squad / Time
            </Label>
            <Input
              placeholder="Ex: Delta Force"
              value={team}
              onChange={e => onTeamChange(e.target.value)}
              className="h-11 rounded-2xl border-border focus:border-primary font-bold bg-muted/40 focus-visible:ring-primary"
            />
          </div>
        </div>

        {/* Formatos de Colunas — Cartões Visuais (Estilo Poker) */}
        <div className="space-y-2 pt-1">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
            <LayoutTemplate className="h-3.5 w-3.5 text-primary" /> Formato das Colunas
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
            {TEMPLATE_OPTIONS.map(opt => {
              const selected = template === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onTemplateChange(opt.key)}
                  onMouseEnter={() => setHoveredTemplate(opt.key)}
                  onMouseLeave={() => setHoveredTemplate(null)}
                  onFocus={() => setHoveredTemplate(opt.key)}
                  className={cn(
                    "text-left p-3 rounded-2xl border-2 transition-all group flex flex-col justify-between min-h-[110px]",
                    selected
                      ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                      : "border-border bg-muted/30 hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-xs font-black uppercase tracking-tight text-foreground truncate">{opt.name}</span>
                      <span className={cn(
                        "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0",
                        selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {opt.tagline}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {opt.columns.slice(0, 3).map((col, idx) => (
                        <span
                          key={idx}
                          className={cn(
                            "h-5 px-1.5 flex items-center justify-center rounded-md text-[9px] font-bold border truncate max-w-[120px]",
                            selected ? "bg-background border-primary/30 text-primary" : "bg-background border-border text-muted-foreground"
                          )}
                        >
                          {col}
                        </span>
                      ))}
                      {opt.columns.length > 3 && (
                        <span className="h-5 px-1 flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                          +{opt.columns.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-[9px] font-medium text-muted-foreground leading-snug line-clamp-2">{opt.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Preview das colunas completas */}
          <div className="flex items-center gap-1.5 flex-wrap px-1 pt-1 min-h-[28px]">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mr-1">Colunas do quadro:</span>
            {previewColumns.map((colTitle, i) => (
              <span
                key={i}
                className="h-6 px-2 flex items-center justify-center rounded-md text-[10px] font-black bg-muted text-muted-foreground border border-border"
              >
                {colTitle}
              </span>
            ))}
          </div>
        </div>

        {/* Editor de colunas customizadas se selecionado */}
        {template === 'custom' && (
          <div className="space-y-3 p-4 rounded-2xl border border-dashed border-border bg-muted/20 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Definição das Colunas Customizadas</Label>
              <span className="text-[9px] font-medium text-muted-foreground">Mínimo 2, máximo 6</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {customColumns.map((col, idx) => (
                <div key={idx} className="flex gap-1.5 items-center">
                  <Input
                    value={col.title}
                    onChange={(e) => {
                      const newCols = [...customColumns];
                      newCols[idx].title = e.target.value;
                      onCustomColumnsChange(newCols);
                    }}
                    placeholder={`Coluna ${idx + 1}`}
                    className="h-10 rounded-xl border-border bg-background font-bold text-xs"
                  />
                  {customColumns.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onCustomColumnsChange(customColumns.filter((_, i) => i !== idx))}
                      className="h-10 w-10 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {customColumns.length < 6 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onCustomColumnsChange([...customColumns, { title: '', theme: 'neutral' }])}
                  className="h-10 rounded-xl border-dashed border-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Coluna
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Configurações do Facilitador — Grid com Switches idêntico ao Poker */}
        <div className="pt-2 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap ml-1">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" /> Configurações do Facilitador
              <span className="text-muted-foreground/70 normal-case tracking-normal font-medium">
                ({activeSetupCount} de {SETUP_TOGGLES.length} ativados)
              </span>
            </Label>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => onSetupSettingsChange(DEFAULT_SETUP_SETTINGS)}
                className="h-auto text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
              >
                Padrão
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onSetupSettingsChange(Object.fromEntries(SETUP_TOGGLES.map(t => [t.key, false])) as SetupSettings)}
                className="h-auto text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
              >
                Nenhum
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onSetupSettingsChange(Object.fromEntries(SETUP_TOGGLES.map(t => [t.key, true])) as SetupSettings)}
                className="h-auto text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
              >
                Todos
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            {SETUP_GROUPS.map(group => (
              <div key={group.label} className="space-y-1.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{group.label}</p>
                {group.items.map(cfg => {
                  const on = !!setupSettings[cfg.key];
                  const Icon = cfg.icon;
                  return (
                    <div key={cfg.key}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => onSetupSettingsChange({ ...setupSettings, [cfg.key]: !on })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSetupSettingsChange({ ...setupSettings, [cfg.key]: !on });
                          }
                        }}
                        title={cfg.desc}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-xl border-2 flex items-center justify-between gap-2.5 transition-all cursor-pointer select-none",
                          on ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-muted/30 hover:border-primary/30",
                          cfg.key === 'healthCheckEnabled' && on && "rounded-b-none border-b-0"
                        )}
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tight text-foreground leading-tight">
                            <Icon className="h-3 w-3 shrink-0 text-primary" />
                            {cfg.title}
                          </span>
                          <span className="block text-[9px] font-medium text-muted-foreground leading-tight mt-1 truncate max-w-[220px]">
                            {cfg.desc}
                          </span>
                        </span>
                        <Switch checked={on} className="pointer-events-none shrink-0 scale-90" />
                      </div>

                      {cfg.key === 'healthCheckEnabled' && on && (
                        <div
                          className="px-3 py-2.5 rounded-b-xl border-2 border-t-0 border-primary bg-primary/5 space-y-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Label className="text-[9px] font-black uppercase tracking-widest text-primary/80">Pergunta exibida</Label>
                          <Textarea
                            value={healthCheckQuestion}
                            onChange={(e) => onHealthCheckQuestionChange(e.target.value)}
                            placeholder={DEFAULT_HEALTH_CHECK_QUESTION}
                            className="min-h-[54px] text-xs font-bold bg-background rounded-xl focus-visible:ring-primary/20"
                          />
                          <p className="text-[9px] font-medium text-muted-foreground">vazio = usa a pergunta padrão</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="pt-4 mt-2 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="h-auto px-2 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-transparent text-center sm:text-left order-2 sm:order-1"
          >
            Cancelar
          </Button>
          <Button
            disabled={isCreating}
            onClick={onCreate}
            className="w-full sm:w-auto px-8 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-primary/10 gap-3 order-1 sm:order-2"
          >
            {isCreating ? 'Preparando...' : 'Iniciar Retrospectiva'}
            <ArrowRightIcon className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
