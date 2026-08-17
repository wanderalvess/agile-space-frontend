
"use client";

import { useState, useEffect } from 'react';
import { EliteNicknameDialog } from '@/components/shared/EliteNicknameDialog';

import { TeamRole } from '@/lib/types';

interface RetroNicknameDialogProps {
  onNameSubmit: (details: { name: string; role: TeamRole }) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  initialRole?: TeamRole;
  isInitialSetup?: boolean;
}

export function RetroNicknameDialog({ onNameSubmit, open, onOpenChange, initialName, initialRole, isInitialSetup = false }: RetroNicknameDialogProps) {
  return (
    <EliteNicknameDialog
      onSubmit={(details) => onNameSubmit({ name: details.nickname, role: details.role })}
      open={open}
      onOpenChange={onOpenChange}
      initialName={initialName}
      initialRole={initialRole}
      isInitialSetup={isInitialSetup}
      title={isInitialSetup ? 'Bem-vindo ao Quadro!' : 'Editar Perfil'}
      description={isInitialSetup ? 'Informe seu nome e papel para entrar na sessão de retrospectiva.' : undefined}
      theme="primary"
    />
  );
}
