'use client';

// Aba "Consultas do Jira (JQL)": gráficos feitos com a JQL que a pessoa escreve. Cada painel fica salvo neste
// navegador ou na squad (servidor); o cartão diz onde. Só aparece uma vez, na própria aba (antes repetia sob cada papel).
import * as React from 'react';
import { useState } from 'react';
import { Code2, Plus } from 'lucide-react';
import { ConfirmDialog, IconTile, ModalButton, StatusChip } from '@/components/room-kit';
import type { SquadIssueSnapshot } from '@/lib/types';
import { JqlPanelCard } from './JqlPanelCard';
import { JqlPanelModal } from './JqlPanelModal';
import { type PanelCardModel } from './jql-model';
import { useJqlPanels } from './useJqlPanels';
import { PAGE_CARD } from '@/components/page/styles';
import { cn } from '@/lib/utils';

interface Props {
  squadId: string;
  /** Quem está logado: o token do Jira é o dela e só ela edita os painéis que criou na squad. */
  userId: string;
  userName: string;
  squadIssues: SquadIssueSnapshot[];
  issuesReady: boolean;
}

export function JqlPanelsSection({ squadId, userId, userName, squadIssues, issuesReady }: Props) {
  const { cards, running, serverLoading, serverUnavailable, refresh, save, remove } = useJqlPanels({
    squadId,
    userId,
    userName,
    squadIssues,
    issuesReady,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PanelCardModel | null>(null);
  const [deleting, setDeleting] = useState<PanelCardModel | null>(null);

  const localCount = cards.filter((c) => c.storage === 'local').length;
  const squadCount = cards.filter((c) => c.storage === 'squad').length;

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className={cn(PAGE_CARD, 'flex flex-wrap items-center justify-between gap-3.5 px-5 py-[18px]')}>
        <div className="flex min-w-0 items-center gap-3">
          <IconTile icon={Code2} size="lg" />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-bold text-foreground">Painéis personalizados por JQL (consultas ad-hoc)</h2>
              {localCount > 0 && <StatusChip tone="neutral">Neste navegador: {localCount}</StatusChip>}
              {squadCount > 0 && <StatusChip tone="brand">Na squad: {squadCount}</StatusChip>}
            </div>
            <p className="text-[13px] text-muted-foreground">Crie, personalize e salve gráficos consultando as métricas do Jira da sua squad.</p>
          </div>
        </div>
        <ModalButton variant="primary" onClick={openNew}>
          <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          Criar painel JQL
        </ModalButton>
      </div>

      {serverLoading && cards.length === 0 && <p role="status" className="text-[13px] text-muted-foreground">Carregando os painéis da squad…</p>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {cards.map((card) => (
          <JqlPanelCard
            key={card.key}
            card={card}
            running={running.has(card.key)}
            onRefresh={refresh}
            onEdit={(c) => {
              setEditing(c);
              setModalOpen(true);
            }}
            onDelete={setDeleting}
          />
        ))}
      </div>

      <JqlPanelModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        squadId={squadId}
        editing={editing}
        serverUnavailable={serverUnavailable}
        onSave={save}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        tone="danger"
        title="Excluir este painel?"
        description={
          deleting?.storage === 'squad'
            ? `“${deleting.title}” sai da squad e ninguém mais o vê.`
            : deleting
              ? `“${deleting.title}” sai deste navegador.`
              : undefined
        }
        confirmLabel="Excluir painel"
        onConfirm={() => {
          if (deleting) void remove(deleting);
        }}
      />
    </div>
  );
}
