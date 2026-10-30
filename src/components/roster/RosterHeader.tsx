'use client';

import { Download, Link2, Upload, UserPlus } from 'lucide-react';
import { ModalButton } from '@/components/room-kit';
import { PageHeader } from '@/components/page';
import { ICON_STROKE } from './styles';

interface RosterHeaderProps {
  canManageTeam: boolean;
  canInvite: boolean;
  onExport: () => void;
  onImport: () => void;
  onAddMember: () => void;
  onInvite: () => void;
}

/**
 * Cabeçalho do Time da squad: caminho, título e as quatro ações da página. O nome da squad não aparece aqui:
 * ele já está no seletor do cabeçalho do portal (uma fonte só).
 */
export function RosterHeader({ canManageTeam, canInvite, onExport, onImport, onAddMember, onInvite }: RosterHeaderProps) {
  const icon = { className: 'h-4 w-4', strokeWidth: ICON_STROKE, 'aria-hidden': true } as const;
  return (
    <PageHeader
      title="Time da squad"
      module="roster"
      breadcrumb={[{ label: 'Squad', href: '/squad' }, { label: 'Time da squad' }]}
      actions={
        <>
          <ModalButton onClick={onExport}>
            <Download {...icon} /> Exportar planilha
          </ModalButton>
          <ModalButton onClick={onImport}>
            <Upload {...icon} /> Importar planilha
          </ModalButton>
          {canManageTeam && (
            <ModalButton variant="primary" onClick={onAddMember}>
              <UserPlus {...icon} /> Adicionar integrante
            </ModalButton>
          )}
          {canInvite && (
            <ModalButton variant={canManageTeam ? 'secondary' : 'primary'} onClick={onInvite}>
              <Link2 {...icon} /> Convidar por link
            </ModalButton>
          )}
        </>
      }
    />
  );
}
