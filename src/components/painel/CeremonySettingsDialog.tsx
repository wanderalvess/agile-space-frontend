'use client';

/**
 * Configuração da fonte do card "Próxima cerimônia" (/painel): a squad escolhe UMA fonte
 * — Google Calendar (cada membro conecta a própria agenda) ou cadastro manual (a squad
 * registra o horário recorrente uma vez) — nunca as duas ao mesmo tempo, porque são duas
 * respostas pra mesma pergunta e misturar convida a divergência.
 *
 * Qualquer membro da squad pode editar (mesmo nível de confiança de outras telas
 * colaborativas do Espaço Ágil hoje — ver requireSquadWriteAccess no backend).
 */

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CEREMONY_DAY_LABEL } from '@/lib/ceremony-schedule';
import type { CeremonyDayOfWeek, SquadCeremony, SquadConfig } from '@/lib/types';
import { cn } from '@/lib/utils';

// Ordem de exibição segunda→domingo — CEREMONY_DAY_INDEX (ceremony-schedule.ts) começa em
// domingo pra bater com Date#getDay(), mas isso é só um detalhe de cálculo, não de UI.
const DISPLAY_DAYS: CeremonyDayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function newCeremony(): SquadCeremony {
  return {
    id: `ceremony_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: '',
    daysOfWeek: [],
    startTime: '09:00',
    durationMinutes: 15,
    meetLink: '',
  };
}

export function CeremonySettingsDialog({
  open,
  onOpenChange,
  mode,
  ceremonies,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'google_calendar' | 'manual';
  ceremonies: SquadCeremony[];
  onSave: (patch: Partial<Pick<SquadConfig, 'ceremonyMode' | 'ceremonies'>>) => Promise<void>;
}) {
  const { toast } = useToast();
  const [draftMode, setDraftMode] = useState<'google_calendar' | 'manual'>(mode);
  const [draftCeremonies, setDraftCeremonies] = useState<SquadCeremony[]>(ceremonies);
  const [isSaving, setIsSaving] = useState(false);

  // Sempre lê o valor salvo mais recente, sem precisar re-sincronizar o rascunho toda vez
  // que ele muda (ver useRef abaixo) — só na transição fechado -> aberto.
  const latestSavedRef = useRef({ mode, ceremonies });
  latestSavedRef.current = { mode, ceremonies };

  // Reabre sempre a partir do estado salvo — evita levar rascunho não salvo de uma
  // abertura anterior pra próxima. Depende só de `open`: com mode/ceremonies também nas
  // deps, qualquer re-render do pai enquanto o dialog está aberto (ex: o tick de 30s do
  // countdown no card) recriava a referência de `ceremonies` e resetava o formulário no
  // meio da edição.
  useEffect(() => {
    if (open) {
      setDraftMode(latestSavedRef.current.mode);
      setDraftCeremonies(latestSavedRef.current.ceremonies.length ? latestSavedRef.current.ceremonies : []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateCeremony = (id: string, patch: Partial<SquadCeremony>) => {
    setDraftCeremonies((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const toggleDay = (id: string, day: CeremonyDayOfWeek) => {
    setDraftCeremonies((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const has = c.daysOfWeek.includes(day);
        return { ...c, daysOfWeek: has ? c.daysOfWeek.filter((d) => d !== day) : [...c.daysOfWeek, day] };
      })
    );
  };

  const removeCeremony = (id: string) => {
    setDraftCeremonies((prev) => prev.filter((c) => c.id !== id));
  };

  const canSave =
    draftMode === 'google_calendar' ||
    draftCeremonies.every((c) => c.title.trim() && c.daysOfWeek.length > 0 && c.durationMinutes > 0);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        ceremonyMode: draftMode,
        ceremonies: draftMode === 'manual' ? draftCeremonies : ceremonies,
      });
      toast({ title: 'Configuração salva', description: 'A fonte da próxima cerimônia foi atualizada pra squad toda.' });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Não consegui salvar',
        description: err?.message || 'Tente de novo em instantes.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Próxima cerimônia da squad</DialogTitle>
          <DialogDescription>
            Escolha de onde o card do painel lê a próxima cerimônia. Vale pra squad inteira.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Fonte</Label>
            <Select value={draftMode} onValueChange={(v) => setDraftMode(v as 'google_calendar' | 'manual')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google_calendar">Google Calendar (cada membro conecta a própria agenda)</SelectItem>
                <SelectItem value="manual">Cadastro manual (a squad registra o horário)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {draftMode === 'manual' && (
            <div className="space-y-3">
              {draftCeremonies.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Nenhuma cerimônia cadastrada ainda. Adicione a daily, planning, review, retro ou
                  refinement do time.
                </p>
              )}

              {draftCeremonies.map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <Input
                      value={c.title}
                      onChange={(e) => updateCeremony(c.id, { title: e.target.value })}
                      placeholder="Nome (ex: Daily)"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCeremony(c.id)}
                      aria-label="Remover cerimônia"
                      className="shrink-0 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {DISPLAY_DAYS.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(c.id, day)}
                        className={cn(
                          'h-7 w-9 rounded-lg text-[10px] font-black uppercase transition-colors',
                          c.daysOfWeek.includes(day)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        )}
                      >
                        {CEREMONY_DAY_LABEL[day]}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] uppercase text-slate-500">Horário</Label>
                      <Input
                        type="time"
                        value={c.startTime}
                        onChange={(e) => updateCeremony(c.id, { startTime: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase text-slate-500">Duração (min)</Label>
                      <Input
                        type="number"
                        min={5}
                        step={5}
                        value={c.durationMinutes}
                        onChange={(e) => updateCeremony(c.id, { durationMinutes: Number(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[10px] uppercase text-slate-500">Link do Meet (opcional)</Label>
                    <Input
                      value={c.meetLink || ''}
                      onChange={(e) => updateCeremony(c.id, { meetLink: e.target.value })}
                      placeholder="https://meet.google.com/..."
                    />
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDraftCeremonies((prev) => [...prev, newCeremony()])}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar cerimônia
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !canSave}>
            {isSaving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
