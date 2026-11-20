'use client';

import { moduleIcon } from '@/lib/modules-registry';
import React, { useCallback, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronRight, HelpCircle, History, Plus, RefreshCw, Trash2, UserCheck, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/context/AuthContext';
import { pokerApi } from './api';
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/UserContext';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { PageShell } from '@/components/page';
import { PokerGuide } from '@/components/poker/PokerGuide';
import { useToolHistory } from '@/hooks/useToolHistory';
import { ModuleIntegrationButton } from '@/components/shared/ModuleIntegrationDialog';
import { CreateSessionModal } from '@/components/poker/CreateSessionModal';
import { ConfirmDialog, FOCUS_RING, IconTile, OUTLINE_BUTTON, StatusChip } from '@/components/room-kit';
import { roomLobbyStatus, ROOM_LOBBY_STATUS_LABEL, stripNewSessionParam, wantsNewSession, type RoomLobbyStatus } from '@/lib/poker-lobby';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | RoomLobbyStatus;

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'live', label: 'Em andamento' },
  { id: 'waiting', label: 'Aguardando' },
  { id: 'ended', label: 'Encerradas' },
];

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
  failed = false,
  onRetry,
  rooms,
  totalCount,
  emptyLabel,
  onOpen,
  canDelete,
  onDelete,
}: {
  icon: React.ReactNode;
  title: string;
  loading: boolean;
  /** A busca das salas falhou: não dá para afirmar que a lista está vazia. */
  failed?: boolean;
  /** "Tentar de novo" do aviso de falha; o botão fica ocupado enquanto `loading`. */
  onRetry?: () => void;
  rooms: any[];
  /** Total sem filtro: distingue "nada aqui" de "nada neste filtro". */
  totalCount: number;
  emptyLabel: string;
  onOpen: (id: string) => void;
  /** Quem pode excluir a sala (quem a criou); o servidor confere de novo. */
  canDelete?: (room: any) => boolean;
  onDelete?: (room: any) => void;
}) {
  return (
    <section className="flex min-h-[360px] flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
      <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </h2>

      <ul className="m-0 flex min-h-0 flex-1 list-none flex-col gap-2.5 overflow-y-auto p-0 pr-1">
        {loading && !(failed && rooms.length === 0) ? (
          <li aria-hidden="true" className="flex flex-col gap-2 py-1 motion-safe:animate-pulse">
            <span className="h-14 rounded-xl bg-muted" />
            <span className="h-14 rounded-xl bg-muted" />
            <span className="h-14 rounded-xl bg-muted" />
          </li>
        ) : failed && rooms.length === 0 ? (
          <li aria-live="polite" className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
            <IconTile icon={moduleIcon('poker')} tone="neutral" />
            <p className="text-sm text-muted-foreground">Não foi possível carregar as sessões.</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={loading}
                aria-busy={loading}
                className={cn(
                  'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors disabled:opacity-60',
                  OUTLINE_BUTTON,
                  FOCUS_RING,
                )}
              >
                <RefreshCw aria-hidden="true" className={cn('h-3.5 w-3.5', loading && 'motion-safe:animate-spin')} strokeWidth={1.5} />
                Tentar de novo
              </button>
            )}
          </li>
        ) : rooms.length === 0 ? (
          <li className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
            <IconTile icon={moduleIcon('poker')} tone="neutral" />
            <p className="text-sm text-muted-foreground">{totalCount > 0 ? 'Nenhuma sessão neste filtro' : emptyLabel}</p>
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
                    'flex w-full items-center gap-3 rounded-xl border border-border bg-muted/40 px-3.5 py-3 pr-12 text-left transition-[transform,background-color,border-color] duration-fast hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/50',
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
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-fast group-hover/item:translate-x-0.5" strokeWidth={1.5} />
                </button>
                {onDelete && canDelete?.(r) && (
                  <button
                    type="button"
                    onClick={() => onDelete(r)}
                    className={cn(
                      'absolute right-9 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity duration-fast hover:bg-red-500/10 hover:text-red-700 focus-visible:opacity-100 group-hover/item:opacity-100 dark:hover:text-red-300',
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
  const { requestIdentity, userProfile } = useUserContext();
  const { squadId: activeSquadId } = useActiveSquad();

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [rooms, setRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomsFailed, setRoomsFailed] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<any | null>(null);
  const [deletingRoom, setDeletingRoom] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [joinId, setJoinId] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const { history: localHistory, loading: loadingHistory, removeRoom: removeLocalRoom } = useToolHistory('poker');

  const currentSquadId = activeSquadId;

  const loadRooms = useCallback(async () => {
    if (!currentSquadId) {
      // Sem squad não há o que listar: sem isto o esqueleto ficava para sempre.
      setLoadingRooms(false);
      return;
    }
    setLoadingRooms(true);
    try {
      const data = await pokerApi.listRooms(currentSquadId);
      setRooms(data);
      setRoomsFailed(false);
    } catch (err) {
      console.error('Erro ao listar salas', err);
      setRoomsFailed(true);
    } finally {
      setLoadingRooms(false);
    }
  }, [currentSquadId]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

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

  // A Home linka /room?nova=1: abre o diálogo assim que o perfil carrega (antes disso o pedido caía na janela de
  // identidade e se perdia) e limpa o parâmetro da URL. Como na Retro.
  const novaHandledRef = useRef(false);
  useEffect(() => {
    if (novaHandledRef.current || !userProfile) return;
    if (!wantsNewSession(window.location.search)) return;
    novaHandledRef.current = true;
    window.history.replaceState(null, '', stripNewSessionParam(window.location.pathname, window.location.search, window.location.hash));
    setIsSetupOpen(true);
  }, [userProfile]);

  // Atalhos deste navegador que o servidor não lista: confere cada um uma vez e tira o que já foi apagado (404).
  const checkedLocalRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (loadingRooms || roomsFailed || loadingHistory) return;
    const listed = new Set(rooms.map((r) => r.id));
    const pending = localHistory.filter((r) => !listed.has(r.roomId) && !checkedLocalRef.current.has(r.roomId)).slice(0, 10);
    if (pending.length === 0) return;
    pending.forEach((r) => checkedLocalRef.current.add(r.roomId));
    void Promise.allSettled(pending.map((r) => pokerApi.getRoom(r.roomId))).then((settled) => {
      settled.forEach((result, i) => {
        if (result.status === 'rejected' && (result.reason as { status?: number } | undefined)?.status === 404) removeLocalRoom(pending[i].roomId);
      });
    });
  }, [rooms, localHistory, loadingRooms, roomsFailed, loadingHistory, removeLocalRoom]);

  const confirmDeleteRoom = async () => {
    if (!roomToDelete) return;
    setDeletingRoom(true);
    try {
      await pokerApi.deleteRoom(roomToDelete.id);
      setRooms((prev) => prev.filter((r) => r.id !== roomToDelete.id));
      removeLocalRoom(roomToDelete.id);
      toast({ title: 'Sala excluída', description: `"${roomToDelete.title || 'Sem título'}" e o histórico dela foram apagados.` });
      setRoomToDelete(null);
    } catch (err: any) {
      toast({ title: 'Não foi possível excluir a sala', description: err?.message, variant: 'destructive' });
    } finally {
      setDeletingRoom(false);
    }
  };

  const applyFilter = (list: any[]) => (filter === 'all' ? list : list.filter((r) => roomLobbyStatus(r) === filter));
  const countOf = (id: StatusFilter) => (id === 'all' ? rooms.length : rooms.filter((r) => roomLobbyStatus(r) === id).length);

  const joinRoom = () => {
    const id = joinId.trim();
    if (id) router.push(`/room/${id.toUpperCase()}`);
  };

  const openRoom = (id: string) => router.push(`/room/${id}`);

  // Sessão ao vivo em destaque: a mais recente da squad em andamento (entrar é o que quase todo mundo vem fazer aqui).
  const liveRoom = rooms.find((r) => roomLobbyStatus(r) === 'live') ?? null;

  return (
    <PageShell documentTitle="Scrum Poker">
      <section
        aria-labelledby="poker-hub-title"
        className="relative flex flex-wrap items-center gap-x-8 gap-y-5 overflow-hidden rounded-[22px] border border-border bg-card px-6 py-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] sm:px-8"
      >
        <div aria-hidden="true" className="room-halo pointer-events-none absolute -right-20 top-1/2 h-[320px] w-[620px] -translate-y-1/2" />
        <div className="relative flex min-w-0 flex-1 basis-[520px] flex-col gap-3">
          <nav aria-label="Trilha" className="text-[13px] text-muted-foreground">
            <Link href="/" className={cn('rounded hover:text-foreground', FOCUS_RING)}>Home</Link>
            <span aria-hidden="true" className="mx-1.5">›</span>
            <span aria-current="page">Scrum Poker</span>
          </nav>
          <h1 id="poker-hub-title" className="m-0 text-[34px] font-extrabold leading-tight tracking-[-0.02em]">Scrum Poker</h1>
          <p className="m-0 text-[15px] text-muted-foreground">Estimativas em horas por papel, com votação às cegas.</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={openNewSession}
              disabled={isCreating}
              className={cn('room-glow inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-bold text-primary-foreground transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] disabled:opacity-60', FOCUS_RING)}
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Nova sessão
            </button>
            <form
              onSubmit={(e) => { e.preventDefault(); joinRoom(); }}
              className="flex h-11 items-center overflow-hidden rounded-xl border border-border bg-background focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-ring/30"
            >
              <label htmlFor="join-room-id" className="sr-only">Entrar com o ID da sala</label>
              <input
                id="join-room-id"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                placeholder="Entrar com o ID da sala"
                autoComplete="off"
                className="h-11 w-52 bg-transparent px-3.5 text-sm uppercase tracking-wider text-foreground outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={!joinId.trim()}
                aria-label="Entrar na sala"
                className={cn('inline-flex h-11 w-11 items-center justify-center border-l border-border text-foreground transition-colors hover:bg-accent disabled:opacity-40', FOCUS_RING)}
              >
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </form>
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className={cn('inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent/50', FOCUS_RING)}
            >
              <HelpCircle className="h-4 w-4" strokeWidth={1.5} />
              Guia
            </button>
            <ModuleIntegrationButton moduleId="poker" variant="ghost" className="hidden sm:inline-flex" />
          </div>
        </div>

        {/* Arte: três cartas, a do meio na cor da marca. */}
        <div aria-hidden="true" className="relative hidden h-[170px] w-[300px] shrink-0 md:block">
          <span className="absolute left-10 top-[30px] flex h-[118px] w-[84px] -rotate-12 items-center justify-center rounded-[14px] border border-border bg-muted text-[30px] font-extrabold text-muted-foreground shadow-[0_16px_30px_rgba(0,0,0,0.25)]">?</span>
          <span className="absolute left-[176px] top-[30px] flex h-[118px] w-[84px] rotate-12 items-center justify-center rounded-[14px] border border-border bg-muted text-[30px] font-extrabold text-muted-foreground shadow-[0_16px_30px_rgba(0,0,0,0.25)]">13</span>
          <span className="room-glow absolute left-[106px] top-3 flex h-[130px] w-[92px] flex-col justify-between rounded-2xl bg-primary px-3 py-2.5 text-primary-foreground">
            <span className="text-sm font-bold">8</span>
            <span className="self-center text-[40px] font-extrabold leading-none">8</span>
            <span className="rotate-180 self-end text-sm font-bold">8</span>
          </span>
        </div>
      </section>

      {liveRoom && (
        <button
          type="button"
          onClick={() => openRoom(liveRoom.id)}
          className={cn('group flex w-full flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border-[1.5px] border-emerald-500/45 bg-emerald-500/5 px-5 py-4 text-left transition-colors hover:bg-emerald-500/10', FOCUS_RING)}
        >
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
            <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_0_6px_rgb(16_185_129/0.18)] motion-safe:animate-pulse" />
          </span>
          <span className="flex min-w-0 flex-1 basis-[240px] flex-col gap-0.5">
            <span className="text-xs font-bold tracking-wide text-emerald-700 dark:text-emerald-300">AO VIVO AGORA</span>
            <span className="truncate text-[17px] font-bold">{liveRoom.title || 'Sem título'}</span>
            <span className="truncate text-[13px] text-muted-foreground">
              {liveRoom.team || 'Squad Geral'}
              {liveRoom.sessionStartedAt ? ` · começou ${formatDistanceToNow(new Date(liveRoom.sessionStartedAt), { addSuffix: true, locale: ptBR })}` : ''}
            </span>
          </span>
          <span className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-[11px] bg-emerald-600 px-4 text-sm font-bold text-white transition-transform group-hover:translate-x-0.5 dark:bg-emerald-500 dark:text-emerald-950">
            Entrar na sala <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </span>
        </button>
      )}

        <div role="group" aria-label="Filtrar por situação" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'inline-flex h-8 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors',
                  // Ativo: texto em foreground (o laranja sobre o tom laranja claro dava 4,39:1 no tema padrão claro); a borda e o fundo marcam a seleção.
                  active ? 'border-primary/50 bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent/40',
                  FOCUS_RING
                )}
              >
                {f.label}
                <span className="text-xs font-normal tabular-nums">{countOf(f.id)}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_340px]">
          <SessionListCard
            icon={<Users className="h-4 w-4" strokeWidth={1.5} />}
            title="Sessões da minha squad"
            loading={loadingRooms}
            failed={roomsFailed}
            onRetry={loadRooms}
            rooms={applyFilter(rooms)}
            totalCount={rooms.length}
            emptyLabel="Nenhuma sessão da squad ainda"
            onOpen={openRoom}
            canDelete={canDeleteRoom}
            onDelete={setRoomToDelete}
          />
          <SessionListCard
            icon={<UserCheck className="h-4 w-4" strokeWidth={1.5} />}
            title="Sessões em que participei"
            loading={loadingRooms}
            failed={roomsFailed}
            onRetry={loadRooms}
            rooms={applyFilter(myParticipatedRooms)}
            totalCount={myParticipatedRooms.length}
            emptyLabel="Você ainda não participou de nenhuma sessão"
            onOpen={openRoom}
            canDelete={canDeleteRoom}
            onDelete={setRoomToDelete}
          />

          <section aria-label="Neste navegador" className="flex min-h-[360px] flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] lg:col-span-2 xl:col-span-1">
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <span className="text-muted-foreground"><History className="h-4 w-4" strokeWidth={1.5} /></span>
              Abertas neste navegador
            </h2>
            <ul className="m-0 flex flex-1 list-none flex-col gap-2 p-0">
              {loadingHistory ? (
                <li aria-hidden="true" className="flex flex-col gap-2 py-1 motion-safe:animate-pulse">
                  <span className="h-12 rounded-xl bg-muted" />
                  <span className="h-12 rounded-xl bg-muted" />
                </li>
              ) : localHistory.length === 0 ? (
                <li className="flex flex-1 items-center justify-center py-10 text-center text-sm text-muted-foreground">Nenhuma sessão aberta aqui</li>
              ) : (
                localHistory.slice(0, 6).map((room) => (
                  <li key={room.roomId}>
                    <button
                      type="button"
                      onClick={() => openRoom(room.roomId)}
                      className={cn('flex w-full items-center gap-3 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/50', FOCUS_RING)}
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold text-foreground">{room.title}</span>
                        <span className="truncate text-xs text-muted-foreground">{room.team || 'Squad Geral'}</span>
                      </span>
                      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                    </button>
                  </li>
                ))
              )}
            </ul>
            <p className="border-t border-border pt-2 text-center text-xs text-muted-foreground">Salvo só neste navegador</p>
          </section>
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

      <PokerGuide open={guideOpen} onOpenChange={setGuideOpen} />
      <CreateSessionModal open={isSetupOpen} onOpenChange={setIsSetupOpen} onCreatingChange={setIsCreating} />
    </PageShell>
  );
}
