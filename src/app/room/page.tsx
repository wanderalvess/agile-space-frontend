'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Lock, MessageSquare, Shield, Trash2, Trophy, UserCheck, Users, WalletCards, Zap, ListPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/context/AuthContext';
import { pokerApi } from './api';
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/UserContext';
import { ToolHubLayout } from '@/components/shared/ToolHubLayout';
import { ModuleIntegrationButton } from '@/components/shared/ModuleIntegrationDialog';
import { CreateSessionModal } from '@/components/poker/CreateSessionModal';
import { ConfirmDialog, FOCUS_RING, IconTile, StatusChip } from '@/components/room-kit';
import { roomLobbyStatus, ROOM_LOBBY_STATUS_LABEL, stripNewSessionParam, wantsNewSession, type RoomLobbyStatus } from '@/lib/poker-lobby';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<RoomLobbyStatus, 'brand' | 'success' | 'neutral'> = {
  live: 'success',
  waiting: 'brand',
  ended: 'neutral',
};

/** Lista de sessões do lobby (minha squad, participei). */
function SessionListCard({
  icon,
  title,
  loading,
  rooms,
  emptyLabel,
  onOpen,
  canDelete,
  onDelete,
}: {
  icon: React.ReactNode;
  title: string;
  loading: boolean;
  rooms: any[];
  emptyLabel: string;
  onOpen: (id: string) => void;
  /** Quem pode excluir a sala (quem a criou); o servidor confere de novo. */
  canDelete?: (room: any) => boolean;
  onDelete?: (room: any) => void;
}) {
  return (
    <section className="flex min-h-[320px] flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
      <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </h2>

      <ul className="m-0 flex min-h-0 flex-1 list-none flex-col gap-2.5 overflow-y-auto p-0 pr-1">
        {loading ? (
          <li aria-hidden="true" className="flex animate-pulse flex-col gap-2 py-1">
            <span className="h-14 rounded-xl bg-muted" />
            <span className="h-14 rounded-xl bg-muted" />
            <span className="h-14 rounded-xl bg-muted" />
          </li>
        ) : rooms.length === 0 ? (
          <li className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
            <IconTile icon={WalletCards} tone="neutral" />
            <p className="text-sm text-muted-foreground">{emptyLabel}</p>
          </li>
        ) : (
          rooms.map((r) => {
            const status = roomLobbyStatus(r);
            return (
              <li key={r.id} className="group/item relative">
                <button
                  type="button"
                  onClick={() => onOpen(r.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border border-border bg-muted/40 px-3.5 py-3 pr-12 text-left transition-[transform,background-color,border-color] duration-[140ms] hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/50',
                    FOCUS_RING
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-foreground">{r.title || 'Sem título'}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {r.team || 'Squad Geral'}
                      {r.createdAt ? ` · ${formatDistanceToNow(new Date(r.createdAt), { addSuffix: true, locale: ptBR })}` : ''}
                    </span>
                  </span>
                  <StatusChip tone={STATUS_TONE[status]}>{ROOM_LOBBY_STATUS_LABEL[status]}</StatusChip>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-[140ms] group-hover/item:translate-x-0.5" strokeWidth={1.5} />
                </button>
                {onDelete && canDelete?.(r) && (
                  <button
                    type="button"
                    onClick={() => onDelete(r)}
                    className={cn(
                      'absolute right-9 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity duration-[140ms] hover:bg-red-500/10 hover:text-red-700 focus-visible:opacity-100 group-hover/item:opacity-100 dark:hover:text-red-300',
                      FOCUS_RING
                    )}
                    title="Excluir sala"
                    aria-label={`Excluir a sala ${r.title || 'sem título'}`}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                )}
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}

export default function PokerHubPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { session } = useAuth();
  const { userProfile, requestIdentity } = useUserContext();

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [rooms, setRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomToDelete, setRoomToDelete] = useState<any | null>(null);
  const [deletingRoom, setDeletingRoom] = useState(false);

  const currentSquadId = session?.activeProjectId || userProfile?.squadId || userProfile?.team;

  useEffect(() => {
    if (!currentSquadId) return;
    const fetchRooms = async () => {
      try {
        const data = await pokerApi.listRooms(currentSquadId);
        setRooms(data);
      } catch (err) {
        console.error('Erro ao listar salas', err);
      } finally {
        setLoadingRooms(false);
      }
    };
    fetchRooms();
  }, [currentSquadId]);

  // Backend já devolve só as salas da squad atual — rooms É a lista "da minha squad".
  const myParticipatedRooms = rooms.filter((r) => session?.id && (r.participantIds?.includes(session.id) || r.creatorId === session.id));

  const canDeleteRoom = (r: any) => !!session?.id && r.creatorId === session.id;

  const openNewSession = () => {
    if (!session) {
      requestIdentity(() => setIsSetupOpen(true));
    } else {
      setIsSetupOpen(true);
    }
  };

  // A Home linka /room?nova=1: abre o diálogo uma vez e limpa o parâmetro da URL.
  useEffect(() => {
    if (!wantsNewSession(window.location.search)) return;
    window.history.replaceState(null, '', stripNewSessionParam(window.location.pathname, window.location.search, window.location.hash));
    openNewSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmDeleteRoom = async () => {
    if (!roomToDelete) return;
    setDeletingRoom(true);
    try {
      await pokerApi.deleteRoom(roomToDelete.id);
      setRooms((prev) => prev.filter((r) => r.id !== roomToDelete.id));
      toast({ title: 'Sala excluída', description: `"${roomToDelete.title || 'Sem título'}" e o histórico dela foram apagados.` });
      setRoomToDelete(null);
    } catch (err: any) {
      toast({ title: 'Não foi possível excluir a sala', description: err?.message, variant: 'destructive' });
    } finally {
      setDeletingRoom(false);
    }
  };

  const tips = [
    {
      title: 'Vote sem ver os outros votos',
      description: 'Enquanto todos não votarem, os votos ficam escondidos. O palpite de quem fala primeiro não influencia o resto do time.',
      icon: <Lock className="text-primary" />,
    },
    {
      title: 'Converse quando os votos divergirem',
      description: 'Se os votos ficarem muito distantes, peça para quem votou mais alto e mais baixo explicarem o raciocínio.',
      icon: <MessageSquare className="text-primary" />,
    },
    {
      title: 'O objetivo é o entendimento',
      description: 'Não é fazer média: continue conversando até o time concordar sobre o tamanho real da tarefa.',
      icon: <Trophy className="text-primary" />,
    },
  ];

  const referenceSections = [
    {
      title: '1. Monte a pauta',
      label: 'Preparação',
      description: 'Adicione as tarefas, links do Jira e notas técnicas. Uma pauta bem definida deixa o refinamento mais rápido.',
      icon: <ListPlus className="text-primary" />,
    },
    {
      title: '2. Escolha o baralho',
      label: 'Baralho',
      description: 'Horas funcionam bem para subtarefas; Fibonacci, para histórias de usuário. Dá para ajustar depois nas configurações.',
      icon: <Zap className="text-primary" />,
    },
    {
      title: '3. Votem em silêncio',
      label: 'Votação',
      description: 'Os votos ficam ocultos até a revelação, para cada pessoa decidir sem ser influenciada.',
      icon: <Shield className="text-primary" />,
    },
    {
      title: '4. Revele e decida',
      label: 'Revelação',
      description: 'Revele os votos, converse sobre as diferenças e copie a estimativa por papel para a issue pai.',
      icon: <Trophy className="text-primary" />,
    },
  ];

  return (
    <>
      <ToolHubLayout
        title="Planning Poker"
        description="Estimativas em horas por papel, com votação às cegas."
        icon={<WalletCards />}
        themeColor="primary"
        toolType="poker"
        actions={<ModuleIntegrationButton moduleId="poker" variant="ghost" className="hidden sm:inline-flex" />}
        tips={tips}
        referenceSections={referenceSections}
        onNewSession={openNewSession}
        onJoinSession={(id) => router.push(`/room/${id}`)}
        isCreating={isCreating}
      >
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <SessionListCard
            icon={<Users className="h-4 w-4" strokeWidth={1.5} />}
            title="Sessões da minha squad"
            loading={loadingRooms}
            rooms={rooms}
            emptyLabel="Nenhuma sessão da squad ainda"
            onOpen={(id) => router.push(`/room/${id}`)}
            canDelete={canDeleteRoom}
            onDelete={setRoomToDelete}
          />
          <SessionListCard
            icon={<UserCheck className="h-4 w-4" strokeWidth={1.5} />}
            title="Sessões em que participei"
            loading={loadingRooms}
            rooms={myParticipatedRooms}
            emptyLabel="Você ainda não participou de nenhuma sessão"
            onOpen={(id) => router.push(`/room/${id}`)}
            canDelete={canDeleteRoom}
            onDelete={setRoomToDelete}
          />
        </div>

        <ConfirmDialog
          open={!!roomToDelete}
          onOpenChange={(open) => { if (!open && !deletingRoom) setRoomToDelete(null); }}
          tone="danger"
          icon={Trash2}
          title="Excluir a sala?"
          description={<>A sala <strong className="text-foreground">{roomToDelete?.title || 'Sem título'}</strong> sai para todos, com os votos, o histórico de rodadas e o chat. Não dá para desfazer.</>}
          cancelLabel="Cancelar"
          confirmLabel="Excluir sala"
          loading={deletingRoom}
          loadingLabel="Excluindo…"
          keepOpenOnConfirm
          onConfirm={() => { void confirmDeleteRoom(); }}
        />
      </ToolHubLayout>

      <CreateSessionModal open={isSetupOpen} onOpenChange={setIsSetupOpen} onCreatingChange={setIsCreating} />
    </>
  );
}
