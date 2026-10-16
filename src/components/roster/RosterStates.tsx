'use client';

import { AlertCircle, Loader2, RefreshCw, Search, Shield, UserPlus, Users } from 'lucide-react';
import { IconTile, ModalButton, StatusChip } from '@/components/room-kit';
import { SQUAD_PEOPLE_ADMIN_ROLES } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ICON_STROKE, ROSTER_CARD } from './styles';

const sk = 'rounded-md bg-muted motion-safe:animate-pulse';

/** Carregando: esqueleto dos quatro números e da lista (aparece no lugar do conteúdo, sem pular o layout). */
export function RosterSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div role="status" className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-[18px] w-[18px] animate-spin motion-reduce:animate-none" strokeWidth={ICON_STROKE} aria-hidden="true" />
        Carregando o time da squad
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn(ROSTER_CARD, 'h-[104px] rounded-[14px] motion-safe:animate-pulse')} />
        ))}
      </div>
      <section className={cn(ROSTER_CARD, 'overflow-hidden')}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 border-t border-border px-5 py-3.5 first:border-t-0">
            <span className={cn(sk, 'h-8 w-8 rounded-full')} />
            <span className={cn(sk, 'h-3 w-40 sm:w-56')} />
            <span className="flex-1" />
            <span className={cn(sk, 'h-3 w-20 sm:w-32')} />
          </div>
        ))}
      </section>
    </div>
  );
}

/** Erro ao carregar o time: antes a tela ficava como se o time estivesse vazio. */
export function RosterLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <section role="alert" className="flex flex-col items-center gap-3.5 rounded-[18px] border border-dashed border-border px-8 py-12 text-center">
      <IconTile icon={AlertCircle} tone="danger" size="lg" />
      <h2 className="text-[22px] font-bold text-foreground">Não foi possível carregar o time</h2>
      <p className="text-sm text-muted-foreground">Confira a conexão e tente de novo.</p>
      <ModalButton variant="primary" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" strokeWidth={ICON_STROKE} aria-hidden="true" /> Tentar de novo
      </ModalButton>
    </section>
  );
}

/** Time vazio: sincronizar com o Jira ou (quem gerencia) adicionar à mão. */
export function EmptyTeam({ syncing, canManageTeam, onSync, onAdd }: { syncing: boolean; canManageTeam: boolean; onSync: () => void; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3.5 px-8 py-11 text-center">
      <IconTile icon={Users} size="lg" />
      <h2 className="text-[22px] font-bold text-foreground">Nenhum integrante carregado ainda</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Os integrantes vêm do quadro do Jira (quem tem tarefa na sprint ativa). Sincronize uma vez para montar a lista e depois ajuste as horas de cada pessoa aqui.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <ModalButton variant="primary" disabled={syncing} onClick={onSync}>
          <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin motion-reduce:animate-none')} strokeWidth={ICON_STROKE} aria-hidden="true" />
          {syncing ? 'Sincronizando…' : 'Sincronizar com o Jira'}
        </ModalButton>
        {canManageTeam && (
          <ModalButton onClick={onAdd}>
            <UserPlus className="h-4 w-4" strokeWidth={ICON_STROKE} aria-hidden="true" /> Ou adicionar manualmente
          </ModalButton>
        )}
      </div>
    </div>
  );
}

/** Filtro sem resultado. */
export function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 border-t border-border px-8 py-10 text-center">
      <IconTile icon={Search} tone="neutral" size="lg" />
      <span className="text-base font-semibold text-foreground">Nenhum integrante encontrado</span>
      <ModalButton onClick={onClear}>Limpar filtros</ModalButton>
    </div>
  );
}

/** Papel global fora de SQUAD_PEOPLE_ADMIN_ROLES: gestão de horas é de quem lidera a squad. */
export function NoAccess({ role, onBack }: { role?: string; onBack: () => void }) {
  return (
    <section className="mx-auto my-8 flex max-w-2xl flex-col items-center gap-4 rounded-[18px] border border-dashed border-border px-8 py-14 text-center">
      <IconTile icon={Shield} tone="danger" size="lg" />
      <h1 className="text-2xl font-bold text-foreground">Acesso restrito</h1>
      <p className="text-sm text-muted-foreground">Gestão de horas e capacidade é de quem lidera a squad.</p>
      <div className="flex max-w-xl flex-wrap justify-center gap-2">
        {SQUAD_PEOPLE_ADMIN_ROLES.map((r) => (
          <StatusChip key={r} tone="brand" className="h-[26px] px-3 font-semibold">
            {r === 'admin' ? 'Administrador' : r}
          </StatusChip>
        ))}
      </div>
      <p className="text-sm text-foreground">
        Seu papel atual: <b>{role || 'não identificado'}</b>
      </p>
      <ModalButton variant="primary" onClick={onBack}>Voltar à squad</ModalButton>
    </section>
  );
}
