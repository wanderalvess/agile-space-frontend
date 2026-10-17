'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { BookOpen, Download, Link2, Trash2, Users } from 'lucide-react';
import {
  ConfirmDialog,
  ModalButton,
  PresenceList,
  ResponsivePanel,
  RoomTopBar,
  ShareDialog,
  type PresenceItem,
  type RoomTopBarAction,
  type RoomTopBarMenuItem,
  type TopBarPerson,
} from '@/components/room-kit';
import { buildInviteText } from '@/lib/health-check-export';
import { moduleIcon } from '@/lib/modules-registry';
import { TEAM_ROLE_DESCRIPTIONS, type HealthCheckParticipant, type TeamRole } from '@/lib/types';
import { presenceOnlineOf } from '@/lib/room-presence';
import { HealthGuide } from './HealthGuide';
import { ConnectionChip, type HealthConnection } from './health-ui';

export type HealthPhase = 'vote' | 'result';

const PHASES = [
  { id: 'vote', label: 'Votar' },
  { id: 'result', label: 'Resultado' },
] as const;

/** Grupos da lista de participantes (por papel). */
const GROUPS = [
  { id: 'management', label: 'Facilitação e produto' },
  { id: 'developer', label: 'Time de desenvolvimento' },
  { id: 'qa', label: 'Qualidade' },
  { id: 'ux', label: 'Design e UX' },
] as const;

const CATEGORY: Record<TeamRole, string | null> = { AM: 'management', PO: 'management', PL: 'management', DEV: 'developer', QA: 'qa', UX: 'ux', SME: null, OUTRO: null };

export interface HealthRoomShellProps {
  title: string;
  squadLabel: string;
  dimensionCount: number;
  phase: HealthPhase;
  isCreator: boolean;
  creatorId?: string;
  participants: HealthCheckParticipant[];
  /** Contas com a sala aberta agora; `null`/ausente = o servidor não informa: só o total, sem ponto de online. */
  onlineIds?: ReadonlySet<string> | null;
  currentUserId?: string;
  connection: HealthConnection;
  onOpenFeedback: () => void;
  /** Apaga o radar (só o criador); deve lançar erro se falhar. */
  onDeleteBoard: () => Promise<void>;
  /** Ação principal do cabeçalho (Encerrar votação, Apresentar). */
  primaryAction?: ReactNode;
  /** Abre a exportação (só no resultado). */
  onExport?: () => void;
  /** Modo apresentação: a barra da sala dá lugar a esta faixa. */
  presentationBar?: ReactNode;
  children: ReactNode;
}

/**
 * Casca da sala do Radar de clima: cabeçalho único (RoomTopBar) com Votar e Resultado, painel de participantes,
 * compartilhar, guia e apagar. A votação e o resultado só montam o conteúdo da fase dentro dela.
 */
export function HealthRoomShell(p: HealthRoomShellProps) {
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [deleteAsk, setDeleteAsk] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [inviteDraft, setInviteDraft] = useState<string | null>(null);

  const people: TopBarPerson[] = useMemo(() => p.participants.map((x) => ({ id: x.id, name: x.nickname, online: presenceOnlineOf(p.onlineIds, x.id) })), [p.participants, p.onlineIds]);
  const items: PresenceItem[] = useMemo(
    () =>
      p.participants.map((x) => ({
        id: x.id,
        name: x.nickname,
        roleLabel: `${TEAM_ROLE_DESCRIPTIONS[x.role]?.name ?? 'Outro'}${x.id === p.creatorId ? ' · facilitador' : ''}`,
        category: CATEGORY[x.role] ?? null,
        online: presenceOnlineOf(p.onlineIds, x.id),
        isYou: x.id === p.currentUserId,
        isHost: x.id === p.creatorId,
      })),
    [p.participants, p.onlineIds, p.creatorId, p.currentUserId]
  );

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
  const inviteText = inviteDraft ?? buildInviteText({ title: p.title, squad: p.squadLabel, dimensionCount: p.dimensionCount, url: shareUrl });

  const actions: RoomTopBarAction[] = [
    { id: 'guide', label: 'Guia do radar', icon: BookOpen, onClick: () => setGuideOpen(true) },
    { id: 'share', label: 'Compartilhar o radar', icon: Link2, onClick: () => { setInviteDraft(null); setShareOpen(true); } },
    ...(p.onExport ? [{ id: 'export', label: 'Exportar o resultado', icon: Download, onClick: p.onExport }] : []),
  ];
  const menuItems: RoomTopBarMenuItem[] = p.isCreator
    ? [{ id: 'delete', label: 'Apagar este radar', icon: Trash2, onClick: () => { setDeleteFailed(false); setDeleteAsk(true); } }]
    : [];

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteFailed(false);
    try {
      await p.onDeleteBoard();
      setDeleteAsk(false);
    } catch {
      setDeleteFailed(true);
    } finally {
      setDeleting(false);
    }
  };

  const finished = p.phase === 'result';

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      {p.presentationBar ?? (
        <RoomTopBar
          toolName="Radar de clima"
          toolIcon={moduleIcon('health')}
          title={p.title}
          homeHref="/health-check"
          homeLabel="Voltar para o Radar de clima"
          status={finished ? 'done' : 'live'}
          statusLabel={finished ? 'Encerrada' : 'Coletando respostas'}
          chips={p.squadLabel ? [{ id: 'squad', label: p.squadLabel, secondary: true }] : []}
          phases={{ steps: PHASES, current: p.phase, label: 'Fases do radar' }}
          primaryAction={p.primaryAction}
          presence={{ people, open: participantsOpen, onClick: () => setParticipantsOpen((o) => !o) }}
          actions={actions}
          menuItems={menuItems}
          onOpenFeedback={p.onOpenFeedback}
        />
      )}

      {p.connection.state === 'reconnecting' || p.connection.state === 'offline' ? (
        <div className="flex shrink-0 justify-center border-b border-border bg-card px-4 py-2" aria-live="polite">
          <ConnectionChip connection={p.connection} />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <main id="conteudo" className="relative min-w-0 flex-1 overflow-y-auto scroll-smooth">
          {p.children}
        </main>
        <ResponsivePanel
          open={participantsOpen && !p.presentationBar}
          onOpenChange={setParticipantsOpen}
          side="right"
          title="Participantes"
          icon={Users}
          count={<span className="text-xs tabular-nums text-muted-foreground">{p.participants.length}</span>}
          subheader={<p className="m-0 px-4 pb-2 text-xs text-muted-foreground">Mostra quem entrou na sala, não quem já respondeu.</p>}
          footer={
            <ModalButton className="w-full gap-2" onClick={() => { setInviteDraft(null); setShareOpen(true); }}>
              <Link2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Convidar pelo link
            </ModalButton>
          }
        >
          <PresenceList items={items} groupOrder={GROUPS} emptyLabel="Ninguém na sala ainda" />
        </ResponsivePanel>
      </div>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Compartilhar o radar"
        description="Link, QR code e convite em texto."
        url={shareUrl}
        note="Quem receber o link e estiver logado entra como participante e responde. Não há bloqueio por squad, por decisão de produto."
        inviteText={inviteText}
        onInviteTextChange={setInviteDraft}
      />

      <HealthGuide open={guideOpen} onOpenChange={setGuideOpen} />

      <ConfirmDialog
        open={deleteAsk}
        onOpenChange={(o) => { if (!o) setDeleteFailed(false); setDeleteAsk(o); }}
        tone="danger"
        icon={Trash2}
        title="Apagar este radar?"
        description="O radar, as respostas e os comentários serão apagados para todos. Quem estiver na sala é avisado. Não dá para desfazer."
        confirmLabel="Apagar radar"
        loading={deleting}
        loadingLabel="Apagando…"
        keepOpenOnConfirm
        onConfirm={() => void confirmDelete()}
      >
        {deleteFailed && (
          <p role="alert" className="m-0 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-700 dark:text-red-300">
            Não foi possível apagar agora. Só quem criou o radar pode apagar; confira a conexão e tente de novo.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
