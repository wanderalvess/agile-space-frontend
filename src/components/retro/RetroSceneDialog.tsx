'use client';

import { ImageIcon, Lock } from 'lucide-react';
import { FOCUS_RING, Modal, ModalButton } from '@/components/room-kit';
import { retroFormatTheme as themeOf, retroSceneKey } from '@/lib/retro-format-themes';
import { cn } from '@/lib/utils';
import { SceneThumb } from './RetroScene';
import { RETRO_SCENE_OPTIONS, type RetroSceneMode } from './retro-scene-mode';

export const RETRO_SCENE_LOCKED_NOTICE =
  'Tema Leitura confortável: o cenário fica desligado, e as opções abaixo ficam bloqueadas. É o tema para quem quer a tela mais calma possível.';

interface RetroSceneChoiceProps {
  value: RetroSceneMode;
  onChange: (mode: RetroSceneMode) => void;
  /** Tema Leitura: as três opções ficam bloqueadas, com aviso. */
  locked?: boolean;
  /** Formato do quadro: a miniatura e o aviso do modo Completo dependem dele. */
  templateKey?: string | null;
}

/** As três opções do cenário (Completo, Suave, Desligado) como cartões de rádio, com a prévia do cenário do formato. */
export function RetroSceneChoice({ value, onChange, locked = false, templateKey }: RetroSceneChoiceProps) {
  const sceneKey = retroSceneKey(templateKey);
  const theme = themeOf(templateKey);
  return (
    <div className="flex flex-col gap-3">
      {locked && (
        <p role="status" className="m-0 flex items-start gap-2 rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-[13px] leading-snug text-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
          {RETRO_SCENE_LOCKED_NOTICE}
        </p>
      )}
      <div role="radiogroup" aria-label="Cenário da retro" className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {RETRO_SCENE_OPTIONS.map((opt) => {
          const selected = locked ? opt.id === 'off' : value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={locked}
              onClick={() => onChange(opt.id)}
              className={cn(
                'flex flex-col gap-2 rounded-xl border p-2.5 text-left transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-60',
                FOCUS_RING,
                selected ? 'border-primary bg-primary/10 dark:bg-primary/15' : 'border-border hover:bg-accent/40'
              )}
            >
              <SceneThumb sceneKey={opt.id === 'off' ? null : sceneKey} className="h-[72px] rounded-lg border border-border bg-background">
                {(opt.id === 'off' || !sceneKey) && <span className="room-halo absolute inset-0" />}
              </SceneThumb>
              <span className="flex items-center gap-2 text-[13px] font-bold">
                {opt.label}
                {opt.id === 'soft' && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Padrão</span>}
              </span>
              <span className="text-xs leading-snug text-muted-foreground">{opt.desc}</span>
            </button>
          );
        })}
      </div>
      {theme && !theme.animado && (
        <p className="m-0 text-xs text-muted-foreground">Neste formato, o Completo só dá profundidade às camadas: nada se move sozinho.</p>
      )}
      <p className="m-0 text-xs text-muted-foreground">
        Quem pede &ldquo;reduzir movimento&rdquo; no sistema nunca vê animação: o Completo se comporta como o Suave. Na apresentação, o cenário é sempre o Suave.
      </p>
    </div>
  );
}

interface RetroSceneDialogProps extends RetroSceneChoiceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** "Cenário da retro" no menu da sala: preferência pessoal, guardada neste navegador, que não muda a retro dos outros. */
export function RetroSceneDialog({ open, onOpenChange, ...choice }: RetroSceneDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      className="sm:max-w-[640px]"
      icon={ImageIcon}
      title="Cenário da retro"
      description="Só para você, neste navegador. Todos os formatos têm um cenário próprio atrás das colunas."
      footer={<ModalButton variant="primary" onClick={() => onOpenChange(false)}>Concluir</ModalButton>}
    >
      <div className="pt-1">
        <RetroSceneChoice {...choice} />
      </div>
    </Modal>
  );
}

