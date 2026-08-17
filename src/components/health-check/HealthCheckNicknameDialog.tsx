"use client";

import { useState, useEffect } from 'react';
import { EliteNicknameDialog } from '@/components/shared/EliteNicknameDialog';

import { TeamRole } from '@/lib/types';

interface HealthCheckNicknameDialogProps {
  onDetailsSubmit: (details: { nickname: string; role: TeamRole }) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  initialRole?: TeamRole;
  isInitialSetup?: boolean;
}

export function HealthCheckNicknameDialog({ onDetailsSubmit, open, onOpenChange, initialName, initialRole, isInitialSetup = false }: HealthCheckNicknameDialogProps) {
  return (
    <EliteNicknameDialog
      onSubmit={onDetailsSubmit}
      open={open}
      onOpenChange={onOpenChange}
      initialName={initialName}
      initialRole={initialRole}
      isInitialSetup={isInitialSetup}
      title={isInitialSetup ? 'Identificação' : 'Editar Perfil'}
      description={isInitialSetup ? 'Informe seu nome e papel para entrar na sessão. Seus votos serão anônimos para o time.' : undefined}
      theme="rose"
    />
  );
}
