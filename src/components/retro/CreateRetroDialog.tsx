'use client';

import React from 'react';
import {
  Users,
  ArrowRight as ArrowRightIcon,
  HeartPulse,
  Trash2,
  User,
  Clock,
  ThumbsUp
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleRow } from '@/components/retro/RetroSettingsDialog';

// Toggles do facilitador espelhados de RetroSettingsDialog — antes só
// apareciam depois de criar o quadro, sem o facilitador saber o que estava
// ligado sem entrar na sala (mesmo problema já resolvido no setup do poker).
export const SETUP_TOGGLES = [
  { key: 'isAuthorsRevealed', icon: User, title: 'Autores Abertos', desc: 'Mostra quem escreveu cada card' },
  { key: 'syncStageEnabled', icon: Users, title: 'Sincronizar Coluna Ativa', desc: 'Todos veem a coluna que você está focando' },
  { key: 'autoRevealOnTimerEnd', icon: Clock, title: 'Auto-revelar ao fim do timer', desc: 'Revela os cards sozinho quando o tempo zera' },
  { key: 'autoSortOnVoteEnd', icon: ThumbsUp, title: 'Ordenar por votos ao encerrar', desc: 'Aplica em todas as colunas de feedback' },
] as const;

export type SetupToggleKey = typeof SETUP_TOGGLES[number]['key'];
export type SetupSettings = Record<SetupToggleKey, boolean>;

export const DEFAULT_SETUP_SETTINGS: SetupSettings = Object.fromEntries(
  SETUP_TOGGLES.map(t => [t.key, false])
) as SetupSettings;

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
  isCreating,
  onCreate,
  onCancel,
}: CreateRetroDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto rounded-[3rem] border-none shadow-2xl bg-white/95 backdrop-blur-xl">
        <DialogHeader>
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-600/20 text-white">
             <HeartPulse className="h-6 w-6" />
          </div>
          <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-slate-800 leading-none">Novo Quadro</DialogTitle>
          <DialogDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Escolha o formato ideal para seu time</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6 font-sans">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Título da Retro</Label>
              <Input
                placeholder="Ex: Fim da Sprint #42"
                value={title}
                onChange={e => onTitleChange(e.target.value)}
                className="h-12 rounded-2xl border-slate-100 focus:border-emerald-500 font-bold bg-slate-50/50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Squad / Time</Label>
              <Input
                placeholder="Ex: Delta Force"
                value={team}
                onChange={e => onTeamChange(e.target.value)}
                className="h-12 rounded-2xl border-slate-100 focus:border-emerald-500 font-bold bg-slate-50/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Template de Colunas</Label>
            <Select value={template} onValueChange={(val: RetroTemplateKey) => onTemplateChange(val)}>
              <SelectTrigger className="h-14 rounded-2xl border-slate-100 bg-slate-50/50 font-bold">
                <SelectValue placeholder="Selecione um formato" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-100 p-2">
                <SelectItem value="classic" className="rounded-xl font-bold py-3 px-4">🏆 Clássico (Parar, Começar, Continuar)</SelectItem>
                <SelectItem value="start_stop_continue" className="rounded-xl font-bold py-3 px-4">🔄 Começar, Parar, Continuar</SelectItem>
                <SelectItem value="four_ls" className="rounded-xl font-bold py-3 px-4">🍃 4L (Liked, Learned, Lacked...)</SelectItem>
                <SelectItem value="daki" className="rounded-xl font-bold py-3 px-4">💎 DAKI (Drop, Add, Keep, Improve)</SelectItem>
                <SelectItem value="sailboat" className="rounded-xl font-bold py-3 px-4">⛵ Sailboat (Vento, Sol, Âncora...)</SelectItem>
                <SelectItem value="starfish" className="rounded-xl font-bold py-3 px-4">⭐ Starfish (5 Estágios: Manter, Menos, Mais...)</SelectItem>
                <SelectItem value="mad_sad_glad" className="rounded-xl font-bold py-3 px-4">😤 Glad, Sad, Mad (Feliz, Triste, Irritado)</SelectItem>
                <SelectItem value="three_little_pigs" className="rounded-xl font-bold py-3 px-4">🐷 Três Porquinhos (Palha, Madeira, Tijolo)</SelectItem>
                <SelectItem value="speed_car" className="rounded-xl font-bold py-3 px-4">🏎️ Speed Car (Motor e Paraquedas)</SelectItem>
                <SelectItem value="custom" className="rounded-xl font-bold py-3 px-4 text-emerald-600">🛠️ Personalizado...</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {template === 'custom' && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
               <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Definição de Colunas</Label>
               <div className="grid grid-cols-1 gap-2">
                  {customColumns.map((col, idx) => (
                    <div key={idx} className="flex gap-2">
                       <Input
                          value={col.title}
                          onChange={(e) => {
                            const newCols = [...customColumns];
                            newCols[idx].title = e.target.value;
                            onCustomColumnsChange(newCols);
                          }}
                          placeholder={`Coluna ${idx + 1}`}
                          className="h-11 rounded-xl border-slate-100 bg-slate-50/30 font-bold"
                       />
                       {customColumns.length > 2 && (
                          <Button
                            variant="ghost"
                            onClick={() => onCustomColumnsChange(customColumns.filter((_, i) => i !== idx))}
                            className="h-11 w-11 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50"
                          >
                             <Trash2 className="h-4 w-4" />
                          </Button>
                       )}
                    </div>
                  ))}
                  {customColumns.length < 5 && (
                     <Button
                       variant="outline"
                       onClick={() => onCustomColumnsChange([...customColumns, { title: '', theme: 'neutral' }])}
                       className="h-11 rounded-xl border-dashed border-2 text-[10px] font-black uppercase tracking-[0.2em]"
                     >
                        + Adicionar Coluna
                     </Button>
                  )}
               </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Configurações do Facilitador</Label>
            <div className="grid grid-cols-1 gap-2">
              {SETUP_TOGGLES.map(cfg => (
                <ToggleRow
                  key={cfg.key}
                  id={cfg.key}
                  icon={cfg.icon}
                  title={cfg.title}
                  desc={cfg.desc}
                  checked={setupSettings[cfg.key]}
                  onChange={(v) => onSetupSettingsChange({ ...setupSettings, [cfg.key]: v })}
                  accent="emerald"
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-6 border-t border-slate-100 flex-col gap-3">
           <Button
             disabled={isCreating}
             onClick={onCreate}
             className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-emerald-600/10 gap-3"
           >
             {isCreating ? 'Sincronizando...' : 'Abrir Sessão'}
             <ArrowRightIcon className="h-4 w-4" />
           </Button>
           <Button
             type="button"
             variant="ghost"
             onClick={onCancel}
             className="h-auto px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-transparent"
           >
              Cancelar
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
