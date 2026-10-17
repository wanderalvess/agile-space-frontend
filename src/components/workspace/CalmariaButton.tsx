'use client';

import { useEffect, useState } from 'react';
import { Headphones } from 'lucide-react';
import { IconButton } from '@/components/room-kit';
import { useCalmariaStore } from '@/store/useCalmariaStore';

/**
 * Abre e fecha a Calmaria (modo de foco, widget global do layout raiz). O cabeçalho novo não tem esse botão,
 * então ele mora na barra do Meu espaço. Fica "pressionado" enquanto há som ou cronômetro rodando.
 */
export function CalmariaButton() {
  const toggleOpen = useCalmariaStore((s) => s.toggleOpen);
  const isOpen = useCalmariaStore((s) => s.isOpen);
  const isTimerRunning = useCalmariaStore((s) => s.isTimerRunning);
  const activeSounds = useCalmariaStore((s) => s.activeSounds);
  // O estado persiste no navegador: só confia nele depois de montar, para o HTML do servidor bater.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const focusActive = mounted && (isTimerRunning || Object.keys(activeSounds).length > 0);

  return (
    <IconButton
      icon={Headphones}
      label="Modo de foco (Calmaria)"
      onClick={toggleOpen}
      pressed={focusActive || (mounted && isOpen)}
      className="h-10 w-10"
    />
  );
}
