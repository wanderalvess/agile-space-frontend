'use client';

import * as React from 'react';
import { EditableName } from './EditableName';
import { PhotoMenu, type PhotoMenuProps } from './PhotoMenu';
import { usePhotoActions } from './usePhotoActions';

export interface IdentityHeroProps extends Omit<PhotoMenuProps, 'actions'> {
  userId?: string;
  onSaveName: (name: string) => void | Promise<void>;
  /** Avisa o modal quando há operação em andamento (envio da foto, gravação do nome). */
  onBusyChange?: (busy: boolean) => void;
}

/** Topo da ficha: avatar grande (botão do menu da foto), nome editável no lugar e e-mail em leitura. */
export function IdentityHero({ userId, onSaveName, onBusyChange, ...photo }: IdentityHeroProps) {
  const actions = usePhotoActions(userId);
  const photoBusy = actions.busy !== null;

  React.useEffect(() => {
    onBusyChange?.(photoBusy);
  }, [photoBusy, onBusyChange]);

  return (
    <div className="flex items-center gap-5 px-6 pb-6 pt-1 max-sm:flex-col max-sm:gap-3 max-sm:px-4 max-sm:pb-5">
      <PhotoMenu {...photo} actions={actions} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 max-sm:w-full max-sm:items-center">
        <EditableName value={photo.name} onSave={onSaveName} onBusyChange={onBusyChange} className="w-full" />
        {photo.email && <span className="truncate text-sm text-muted-foreground max-sm:max-w-full">{photo.email}</span>}
        {actions.error && (
          <p role="alert" className="pt-1 text-[13px] font-medium text-red-700 dark:text-red-300">
            {actions.error}
          </p>
        )}
      </div>
    </div>
  );
}
