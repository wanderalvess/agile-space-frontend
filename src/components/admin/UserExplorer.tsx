'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Info, KeyRound, Lock, RefreshCw, ShieldCheck, UserX, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { DataTable, DataToolbar, EmptyState, ErrorState, LoadingSkeleton, type DataColumn } from '@/components/page';
import { IconButton, Modal, ModalButton, SelectField, StatusChip } from '@/components/room-kit';
import { ConfirmDialog } from '@/components/room-kit/ConfirmDialog';
import { BRAND_TEXT, FOCUS_RING, TONES } from '@/components/room-kit/tokens';
import { AUTH_ROLES, ROLES, type UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { userApi } from '@/app/users/api';
import { adminApi } from '@/app/admin/api';
import { useUserContext } from '@/context/UserContext';
import { resetLinkFrom, type ResetLink } from './approvals/approvals-utils';
import { ResetLinkDialog } from './approvals/ResetLinkParts';
import { Segmented } from './Segmented';
import { adminTabHref } from './admin-tabs';
import { LeadMigrationPanel } from './LeadMigrationPanel';
import { UserLinksCell, type UserLinksState } from './UserLinksCell';
import {
  ACCESS_LEVEL_HINT,
  ACCESS_LEVEL_INFO,
  ACCESS_LEVEL_LABEL,
  CARGO_FILTER_OPTIONS,
  accessLevelOf,
  activeAdminCount,
  apiErrorMessage,
  describeLastAccess,
  filterUsers,
  hasActiveFilters,
  hasLegacyLeadLevel,
  isActiveUser,
  isAdminUser,
  lockReasons,
  needsAdminConfirm,
  squadsSummary,
  usersCountLabel,
  type AccessLevel,
  type StatusFilter,
} from './user-admin';

const PAGE_SIZE = 30;
const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Ativos' },
  { value: 'inactive', label: 'Inativos' },
] as const;

/** Cadeado que explica por que o controle ao lado está travado (foca com Tab e aparece ao passar o mouse). */
function LockHint({ prefix, reason }: { prefix: string; reason: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${prefix}: ${reason}`}
          className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground', FOCUS_RING)}
        >
          <Lock className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-xs">
        {prefix}: {reason}
      </TooltipContent>
    </Tooltip>
  );
}

const SELECT_TRIGGER = 'h-8 w-full gap-1.5 rounded-lg border-transparent bg-muted px-2.5 text-[13px] font-semibold ring-offset-0 focus:ring-offset-0';

export function UserExplorer({ pendingResets = null }: { pendingResets?: number | null }) {
  const { userProfile: currentUser } = useUserContext();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [detailUser, setDetailUser] = useState<UserProfile | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<UserProfile | null>(null);
  const [confirmAdmin, setConfirmAdmin] = useState<UserProfile | null>(null);
  const [confirmReset, setConfirmReset] = useState<UserProfile | null>(null);
  const [resetLink, setResetLink] = useState<ResetLink | null>(null);
  // Vínculos por conta, pedidos sob demanda (a lista de usuários só traz a squad ativa).
  const [linksByUser, setLinksByUser] = useState<Record<string, UserLinksState>>({});
  const linksInFlight = useRef(new Set<string>());

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await userApi.listUsersOrThrow());
      setLoadError(null);
      // Os vínculos podem ter mudado fora daqui: recarregar a lista descarta o que estava guardado.
      setLinksByUser({});
    } catch (e) {
      const message = apiErrorMessage(e, 'Não foi possível carregar a lista de usuários.');
      setLoadError(message);
      toast.error('Erro ao carregar usuários', { description: message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial da aba
    void fetchUsers();
  }, [fetchUsers]);

  const filtered = useMemo(() => filterUsers(users, { search, status, role }), [users, search, status, role]);
  const visible = useMemo(() => filtered.slice(0, visibleLimit), [filtered, visibleLimit]);
  const adminCount = useMemo(() => activeAdminCount(users), [users]);

  const patchUser = async (
    userId: string,
    patch: { role?: string; active?: boolean; jobTitle?: string },
    okMessage = 'Usuário atualizado',
  ) => {
    setUpdatingId(userId);
    try {
      const updated = await userApi.adminPatchUser(userId, patch);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updated } : u)));
      toast.success(okMessage);
    } catch (error) {
      toast.error('Não foi possível alterar', { description: apiErrorMessage(error) });
      // Recarrega para os seletores voltarem ao valor real do servidor.
      void fetchUsers();
    } finally {
      setUpdatingId(null);
    }
  };

  /** Busca os vínculos de uma conta uma vez só (chamadas em voo se juntam; o resultado fica guardado). */
  const loadLinks = useCallback(async (userId: string) => {
    if (linksInFlight.current.has(userId)) return;
    linksInFlight.current.add(userId);
    setLinksByUser((prev) => ({ ...prev, [userId]: 'loading' }));
    try {
      const links = await userApi.getUserSquads(userId);
      setLinksByUser((prev) => ({ ...prev, [userId]: Array.isArray(links) ? links : [] }));
    } catch {
      setLinksByUser((prev) => ({ ...prev, [userId]: null }));
    } finally {
      linksInFlight.current.delete(userId);
    }
  }, []);

  const openDetails = (u: UserProfile) => {
    setDetailUser(u);
    if (!Array.isArray(linksByUser[u.id])) void loadLinks(u.id);
  };

  const resetPassword = async (u: UserProfile) => {
    setUpdatingId(u.id);
    try {
      const result = await adminApi.resetUserPassword(u.id);
      const link = resetLinkFrom(result, u.email || u.name, window.location.origin);
      if (link) setResetLink(link);
      toast.success('Link de redefinição gerado', { description: 'Repasse à pessoa fora do sistema. Ele vale uma vez só.' });
    } catch (error) {
      toast.error('Não foi possível redefinir a senha', { description: apiErrorMessage(error) });
    } finally {
      setUpdatingId(null);
      setConfirmReset(null);
    }
  };

  const changeLevel = (u: UserProfile, next: string) => {
    if (accessLevelOf(u) === next) return;
    if (needsAdminConfirm(u, next)) {
      // O seletor é controlado: continua mostrando o nível de antes até a confirmação.
      setConfirmAdmin(u);
      return;
    }
    void patchUser(u.id, { role: next }, 'Nível de acesso alterado');
  };

  const clearFilters = () => {
    setSearch('');
    setRole('all');
    setStatus('all');
    setVisibleLimit(PAGE_SIZE);
  };

  const filtering = hasActiveFilters({ search, status, role });
  const detailState = detailUser ? linksByUser[detailUser.id] : undefined;
  const summary = squadsSummary(detailState === 'loading' ? undefined : detailState, detailUser?.squadId);

  const columns: DataColumn<UserProfile>[] = [
    {
      id: 'user',
      header: 'Usuário / Identidade',
      width: 'minmax(0,1.5fr)',
      primary: true,
      cell: (u) => {
        const self = u.id === currentUser?.id;
        return (
          <div className={cn('flex min-w-0 items-center gap-3', !isActiveUser(u) && 'opacity-60')}>
            <span className="relative shrink-0">
              <InitialsAvatar name={u.name} email={u.email} className="h-9 w-9 text-xs" />
              {isAdminUser(u) && (
                <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Zap className="h-2.5 w-2.5" strokeWidth={2} aria-label="Administrador" />
                </span>
              )}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-bold text-foreground">{u.name || 'Sem nome'}</span>
                {self && <StatusChip className="h-5">Você</StatusChip>}
              </span>
              <span className="truncate text-xs text-muted-foreground">{u.email}</span>
            </span>
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      width: '128px',
      cell: (u) => {
        const label = u.name || u.email || 'usuário';
        const lock = lockReasons(u, { currentUserId: currentUser?.id, adminCount }).status;
        const on = isActiveUser(u);
        return (
          <span className="flex items-center gap-2">
            <Switch
              checked={on}
              disabled={updatingId === u.id || !!lock}
              aria-label={`${on ? 'Desativar' : 'Ativar'} ${label}`}
              onCheckedChange={(checked) => (checked ? void patchUser(u.id, { active: true }, 'Conta ativada') : setConfirmDeactivate(u))}
            />
            <span className={cn('text-xs font-bold', on ? TONES.success.text : 'text-muted-foreground')}>{on ? 'Ativo' : 'Inativo'}</span>
            {lock && <LockHint prefix="Status" reason={lock} />}
          </span>
        );
      },
    },
    {
      id: 'last',
      header: 'Último acesso',
      width: '104px',
      cell: (u) => (
        <span
          className="text-[13px] text-muted-foreground"
          title={u.createdAt ? `Conta criada em ${new Date(u.createdAt).toLocaleDateString('pt-BR')}` : undefined}
        >
          {describeLastAccess(u.lastLoginAt)}
        </span>
      ),
    },
    {
      id: 'cargo',
      header: 'Cargo',
      width: '156px',
      cell: (u) => {
        const label = u.name || u.email || 'usuário';
        return (
          // Cargo de negócio: só o admin grava; não muda permissão de acesso.
          <Select
            value={u.jobTitle || ''}
            onValueChange={(val) => void patchUser(u.id, { jobTitle: val }, 'Cargo atualizado')}
            disabled={updatingId === u.id}
          >
            <SelectTrigger aria-label={`Cargo de ${label}`} className={cn(SELECT_TRIGGER, 'text-foreground')}>
              <SelectValue placeholder={<span className="text-muted-foreground">Sem cargo</span>} />
            </SelectTrigger>
            <SelectContent className="border-border bg-popover text-popover-foreground">
              {ROLES.map((r) => (
                <SelectItem key={r} value={r} className="text-[13px]">
                  {r}
                </SelectItem>
              ))}
              <div className="mt-1 border-t border-border px-2.5 pb-1 pt-2 text-xs text-muted-foreground">O acesso vem do Nível, não do cargo</div>
            </SelectContent>
          </Select>
        );
      },
    },
    {
      id: 'nivel',
      header: 'Nível de acesso',
      width: '156px',
      cell: (u) => {
        const label = u.name || u.email || 'usuário';
        const level = accessLevelOf(u);
        const lock = lockReasons(u, { currentUserId: currentUser?.id, adminCount }).nivel;
        return (
          <span className="flex min-w-0 flex-col items-start gap-1">
            <span className="flex w-full items-center gap-1">
              {/* Nível de autorização real: controla o acesso a /admin no servidor. */}
              <Select value={level} onValueChange={(val) => changeLevel(u, val)} disabled={updatingId === u.id || !!lock}>
                <SelectTrigger
                  aria-label={`Nível de acesso de ${label}`}
                  className={cn(SELECT_TRIGGER, level === 'ADMIN' ? cn('bg-primary/10', BRAND_TEXT) : 'text-foreground')}
                >
                  <SelectValue>{ACCESS_LEVEL_LABEL[level]}</SelectValue>
                </SelectTrigger>
                <SelectContent className="min-w-[280px] border-border bg-popover text-popover-foreground">
                  {AUTH_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="items-start py-2">
                      <span className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-bold">{ACCESS_LEVEL_LABEL[r as AccessLevel]}</span>
                        <span className="text-xs text-muted-foreground">{ACCESS_LEVEL_INFO[r as AccessLevel]}</span>
                      </span>
                    </SelectItem>
                  ))}
                  <div className="mt-1 max-w-[280px] border-t border-border px-2.5 pb-1 pt-2 text-xs text-muted-foreground">{ACCESS_LEVEL_HINT}</div>
                </SelectContent>
              </Select>
              {lock && <LockHint prefix="Nível de acesso" reason={lock} />}
            </span>
            {hasLegacyLeadLevel(u) && <StatusChip tone="warn" className="h-5">Nível antigo (LEAD)</StatusChip>}
          </span>
        );
      },
    },
    {
      id: 'squad',
      header: 'Squad',
      width: '200px',
      cell: (u) => (
        <UserLinksCell
          name={u.name || u.email || 'usuário'}
          activeSquadId={u.squadId}
          state={linksByUser[u.id]}
          onLoad={() => void loadLinks(u.id)}
        />
      ),
    },
    {
      id: 'acoes',
      header: 'Ações',
      width: '80px',
      cell: (u) => {
        const label = u.name || u.email || 'usuário';
        return (
          <span className="flex items-center gap-1">
            <IconButton size="sm" label={`Detalhes de ${label}`} icon={Info} className="border-transparent" onClick={() => openDetails(u)} />
            <IconButton
              size="sm"
              label={`Redefinir a senha de ${label}`}
              icon={KeyRound}
              className="border-transparent"
              pressed={confirmReset?.id === u.id}
              disabled={updatingId === u.id}
              onClick={() => setConfirmReset(u)}
            />
          </span>
        );
      },
    },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-1">
          <h2 className="text-[22px] font-bold text-foreground">Usuários &amp; Acesso</h2>
          <p className="text-sm text-muted-foreground">
            {loading && users.length === 0 ? 'Carregando a lista…' : 'Quem entra, o nível de acesso e os vínculos com squads'}
          </p>
        </section>

        {!!pendingResets && pendingResets > 0 && (
          <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5">
            <KeyRound className={cn('h-[18px] w-[18px] shrink-0', TONES.warn.text)} strokeWidth={1.5} aria-hidden="true" />
            <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
              {pendingResets === 1
                ? '1 pedido de redefinição de senha aguardando aprovação'
                : `${pendingResets} pedidos de redefinição de senha aguardando aprovação`}
            </span>
            <Link
              href={adminTabHref('aprovacoes')}
              scroll={false}
              className={cn(
                'inline-flex h-[34px] items-center rounded-[10px] border border-border bg-transparent px-3 text-[13px] font-medium text-foreground hover:bg-accent max-sm:h-11',
                FOCUS_RING,
              )}
            >
              Ver Aprovações
            </Link>
          </div>
        )}

        <LeadMigrationPanel
          squadOfUser={(id) => users.find((u) => u.id === id)?.squadId || undefined}
          onChanged={() => void fetchUsers()}
        />

        <DataToolbar
          search={{
            value: search,
            onChange: (v) => { setSearch(v); setVisibleLimit(PAGE_SIZE); },
            placeholder: 'Buscar por nome, e-mail ou id do Jira...',
            ariaLabel: 'Buscar usuários',
          }}
          filters={
            <>
              <SelectField
                aria-label="Filtrar por cargo"
                value={role}
                onChange={(v) => { setRole(v); setVisibleLimit(PAGE_SIZE); }}
                options={CARGO_FILTER_OPTIONS}
                className="h-[38px] w-full sm:w-[210px] max-sm:h-11"
              />
              <Segmented
                label="Filtrar por status"
                value={status}
                onChange={(v) => { setStatus(v); setVisibleLimit(PAGE_SIZE); }}
                options={STATUS_OPTIONS}
              />
            </>
          }
          actions={
            <IconButton
              label="Recarregar usuários"
              icon={RefreshCw}
              disabled={loading}
              onClick={() => void fetchUsers()}
              className={cn('h-[38px] w-[38px]', loading && '[&_svg]:animate-spin [&_svg]:motion-reduce:animate-none')}
            />
          }
        />

        {!loadError && !(loading && users.length === 0) && (
          <p className="text-[13px] font-semibold text-muted-foreground" aria-live="polite">
            {usersCountLabel(visible.length, filtered.length, users.length)}
          </p>
        )}

        {loading && users.length === 0 ? (
          <LoadingSkeleton variant="table" rows={8} label="Buscando usuários" />
        ) : loadError && users.length === 0 ? (
          <ErrorState
            title="Não foi possível carregar os usuários"
            description={loadError}
            onRetry={() => void fetchUsers()}
            className="rounded-2xl border border-dashed border-border"
          />
        ) : (
          <DataTable
            ariaLabel="Usuários"
            columns={columns}
            rows={visible}
            getRowId={(u) => u.id}
            empty={
              filtering ? (
                <EmptyState
                  embedded
                  title="Nenhum usuário encontrado com esses filtros."
                  actions={<ModalButton onClick={clearFilters}>Limpar filtros</ModalButton>}
                />
              ) : (
                <EmptyState embedded title="Nenhum usuário cadastrado ainda" description="Quem entrar no portal aparece aqui." />
              )
            }
            footer={
              filtered.length > visibleLimit ? (
                <div className="flex justify-center border-t border-border p-3.5">
                  <ModalButton variant="ghost" className={cn('gap-1.5', BRAND_TEXT)} onClick={() => setVisibleLimit((n) => n + PAGE_SIZE)}>
                    Carregar mais usuários
                    <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                  </ModalButton>
                </div>
              ) : undefined
            }
          />
        )}

        <ConfirmDialog
          open={!!confirmDeactivate}
          onOpenChange={(open) => { if (!open) setConfirmDeactivate(null); }}
          tone="danger"
          icon={UserX}
          title={`Desativar ${confirmDeactivate?.name || confirmDeactivate?.email || ''}?`}
          description="A pessoa perde a sessão em até 30 segundos, não consegue entrar e as chaves de API dela deixam de valer. Nada é apagado; você pode reativar a conta quando quiser."
          confirmLabel="Desativar conta"
          onConfirm={() => confirmDeactivate && void patchUser(confirmDeactivate.id, { active: false }, 'Conta desativada')}
        />

        <ConfirmDialog
          open={!!confirmAdmin}
          onOpenChange={(open) => { if (!open) setConfirmAdmin(null); }}
          tone="warn"
          icon={ShieldCheck}
          title={`Dar acesso de administrador a ${confirmAdmin?.name || confirmAdmin?.email || ''}?`}
          description="A pessoa passa a abrir a Administração e a ver todas as squads. Você pode voltar o nível depois."
          confirmLabel="Dar acesso"
          onConfirm={() => confirmAdmin && void patchUser(confirmAdmin.id, { role: 'ADMIN' }, 'Nível de acesso alterado')}
        />

        <ConfirmDialog
          open={!!confirmReset}
          onOpenChange={(open) => { if (!open) setConfirmReset(null); }}
          tone="brand"
          icon={KeyRound}
          title={`Redefinir a senha de ${confirmReset?.name || confirmReset?.email || ''}?`}
          description="Será gerado um link de uso único (vale 2 horas), que você repassa à pessoa fora do sistema. Ela define a própria senha; a atual continua valendo até o link ser usado."
          confirmLabel="Gerar link de redefinição"
          loading={!!confirmReset && updatingId === confirmReset.id}
          loadingLabel="Gerando…"
          keepOpenOnConfirm
          onConfirm={() => confirmReset && void resetPassword(confirmReset)}
        />

        <ResetLinkDialog link={resetLink} onClose={() => setResetLink(null)} />

        <Modal
          open={!!detailUser}
          onOpenChange={(open) => { if (!open) setDetailUser(null); }}
          size="md"
          title={detailUser?.name || 'Sem nome'}
          description={detailUser?.email}
        >
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-sm">
            <dt className="font-bold text-muted-foreground">Status</dt>
            <dd>{detailUser && isActiveUser(detailUser) ? 'Ativo' : 'Inativo'}</dd>
            <dt className="font-bold text-muted-foreground">Nível de acesso</dt>
            <dd className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {detailUser ? ACCESS_LEVEL_LABEL[accessLevelOf(detailUser)] : ''}
              {detailUser && accessLevelOf(detailUser) !== 'MEMBER' && (
                <span className="text-xs text-muted-foreground">{ACCESS_LEVEL_INFO[accessLevelOf(detailUser)]}</span>
              )}
              {detailUser && hasLegacyLeadLevel(detailUser) && <StatusChip tone="warn" className="h-5">Nível antigo (LEAD)</StatusChip>}
            </dd>
            <dt className="font-bold text-muted-foreground">Cargo</dt>
            <dd>{detailUser?.jobTitle || 'Sem cargo'}</dd>
            <dt className="font-bold text-muted-foreground">Conta criada em</dt>
            <dd>{detailUser?.createdAt ? new Date(detailUser.createdAt).toLocaleDateString('pt-BR') : 'Sem registro'}</dd>
            <dt className="font-bold text-muted-foreground">Último acesso</dt>
            <dd>{describeLastAccess(detailUser?.lastLoginAt)}</dd>
            <dt className="font-bold text-muted-foreground">Id do Jira</dt>
            <dd className="font-mono text-[13px]">{detailUser?.jiraAccountId || '—'}</dd>
            <dt className="font-bold text-muted-foreground">Squads</dt>
            <dd>
              {summary.kind === 'loading' && <span className="text-muted-foreground">Carregando…</span>}
              {summary.kind === 'error' && (
                <span className="flex flex-wrap items-center gap-2" role="alert">
                  <span className={TONES.danger.text}>Não foi possível carregar as squads</span>
                  {detailUser && (
                    <ModalButton className="h-8 px-3 text-[13px]" onClick={() => void loadLinks(detailUser.id)}>
                      Tentar de novo
                    </ModalButton>
                  )}
                </span>
              )}
              {summary.kind === 'links' && (
                <ul className="flex flex-col gap-1">
                  {summary.links.map((s) => (
                    <li key={`${s.squadId}-${s.role ?? ''}`}>
                      <span className="font-semibold">{s.squadId}</span>
                      {s.role ? <span className="text-muted-foreground"> · {s.role}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
              {summary.kind === 'active' && <span>Squad ativa: {summary.squadId}</span>}
              {summary.kind === 'none' && <span className="text-muted-foreground">Sem vínculo com squads</span>}
            </dd>
          </dl>
        </Modal>
      </div>
    </TooltipProvider>
  );
}
