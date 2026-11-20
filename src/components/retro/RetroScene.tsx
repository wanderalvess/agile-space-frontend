'use client';

import { useEffect, useRef, useState } from 'react';
import { retroSceneKey, type RetroSceneKey } from '@/lib/retro-format-themes';
import { cn } from '@/lib/utils';
import { loadRetroScene } from './retro-scene-loaders';
import type { RetroSceneMode } from './retro-scene-mode';

/** Baixa o SVG do cenário (import dinâmico). `null` enquanto carrega, sem cenário ou se o pacote falhar: a sala segue sem ele. */
export function useSceneMarkup(key: RetroSceneKey | null): string | null {
  const [loaded, setLoaded] = useState<{ key: RetroSceneKey; markup: string } | null>(null);
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    loadRetroScene(key)
      .then((markup) => { if (!cancelled) setLoaded({ key, markup }); })
      .catch(() => { /* sem o cenário a sala continua igual */ });
    return () => { cancelled = true; };
  }, [key]);
  return key && loaded?.key === key ? loaded.markup : null;
}

export interface RetroSceneProps {
  /** `templateKey` do quadro: personalizado, quadro antigo ou chave desconhecida ficam sem ilustração. */
  templateKey?: string | null;
  mode: RetroSceneMode;
  className?: string;
}

/**
 * Cenário de fundo da sala: uma ilustração SVG por formato, atrás das colunas, nas cores do tema. É só uma camada
 * visual (`pointer-events: none`, `aria-hidden`, sem foco): nenhuma função da sala depende dela. No modo Completo,
 * o ponteiro desloca as três camadas poucos pixels (só `transform`, no máximo um quadro por vez).
 */
export function RetroScene({ templateKey, mode, className }: RetroSceneProps) {
  const key = retroSceneKey(templateKey);
  const active = mode !== 'off' && key !== null;
  const markup = useSceneMarkup(active ? key : null);
  const ref = useRef<HTMLDivElement>(null);

  // Paralaxe: só com ponteiro fino (celular não tem), e só no Completo.
  useEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (mode !== 'full' || !el || !host) return;
    if (typeof window.matchMedia !== 'function' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      el.style.setProperty('--mx', x.toFixed(3));
      el.style.setProperty('--my', y.toFixed(3));
    };
    const onMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
      x = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1));
      y = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1));
      if (!frame) frame = requestAnimationFrame(apply);
    };
    host.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      host.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
      el.style.removeProperty('--mx');
      el.style.removeProperty('--my');
    };
  }, [mode, markup]);

  if (!active || !markup) return null;
  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-retro-scene={key}
      data-mode={mode}
      className={cn('retro-scene pointer-events-none absolute inset-0 -z-10 select-none', className)}
    >
      <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice" focusable="false" dangerouslySetInnerHTML={{ __html: markup }} />
    </div>
  );
}

/**
 * Miniatura do cenário (seletor de formato e janela de preferência): o mesmo SVG, parado, recortado pelo
 * contêiner. Fica visível mesmo no tema Leitura, porque ali é uma prévia da escolha, não decoração da sala.
 */
export function SceneThumb({ sceneKey, className, children }: { sceneKey: RetroSceneKey | null; className?: string; children?: React.ReactNode }) {
  const markup = useSceneMarkup(sceneKey);
  return (
    <span aria-hidden="true" className={cn('relative block overflow-hidden', className)}>
      {markup && (
        <span className="retro-scene retro-scene-thumb" data-mode="soft" data-retro-scene={sceneKey ?? undefined}>
          <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice" focusable="false" dangerouslySetInnerHTML={{ __html: markup }} />
        </span>
      )}
      {children}
    </span>
  );
}
