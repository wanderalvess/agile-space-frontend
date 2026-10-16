'use client';

import { ArrowLeft, ChevronRight, Download, Link2, Upload, UserPlus } from 'lucide-react';
import { ModalButton, StatusChip } from '@/components/room-kit';
import { ICON_STROKE } from './styles';

interface RosterHeaderProps {
  squadId: string;
  canManageTeam: boolean;
  canInvite: boolean;
  onBack: () => void;
  onExport: () => void;
  onImport: () => void;
  onAddMember: () => void;
  onInvite: () => void;
}

/** Cabeçalho do Time da squad: caminho, título e as quatro ações da página. */
export function RosterHeader({ squadId, canManageTeam, canInvite, onBack, onExport, onImport, onAddMember, onInvite }: RosterHeaderProps) {
  const icon = { className: 'h-4 w-4', strokeWidth: ICON_STROKE, 'aria-hidden': true } as const;
  return (
    <section className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        <nav aria-label="Caminho" className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-md transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} aria-hidden="true" />
            Squad
          </button>
          <ChevronRight className="h-3 w-3" strokeWidth={ICON_STROKE} aria-hidden="true" />
          <span className="text-foreground">Time da squad</span>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground sm:text-[32px]">Time da squad</h1>
          <StatusChip tone="brand" className="h-[26px] px-3 font-bold">
            Squad: {squadId}
          </StatusChip>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
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
      </div>
    </section>
  );
}
