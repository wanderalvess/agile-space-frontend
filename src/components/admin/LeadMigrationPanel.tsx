'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { History, PlayCircle, ShieldAlert, UserMinus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { ErrorState, PAGE_CARD } from '@/components/page';
import { ModalButton, StatusChip } from '@/components/room-kit';
import { ConfirmDialog } from '@/components/room-kit/ConfirmDialog';
import { FOCUS_RING, TONES } from '@/components/room-kit/tokens';
import {
  LeadDemotionApiError,
  isLeadDemotionUnavailable,
  restoreLeadLevel,
  runLeadDemotion,
  type LeadDemotionReport,
  type LeadUser,
} from '@/lib/lead-demotion-api';
import { cn } from '@/lib/utils';
import {
  CLASSIFICATION_LABEL,
  actionLabel,
  appliedMessage,
  leadUserLabel,
  migrationHeadline,
  plural,
  restoredMessage,
  rosterHref,
  safeToDemote,
} from './lead-migration';

/** A mensagem já vem tratada pelo cliente da API (corpo do servidor ou texto por status). */
function errorText(e: unknown, fallback: string): string {
  return e instanceof LeadDemotionApiError || e instanceof Error ? e.message || fallback : fallback;
}

type Busy = null | 'simulate' | 'apply' | 'force' | 'restore';

/**
 * Migração do nível LEAD (Etapa 4 do vínculo). O nível LEAD deixou de dar acesso; esta ferramenta passa as contas para Membro
 * com segurança: simula antes (nada é gravado), rebaixa só quem já tem vínculo de liderança e deixa o resto para decisão consciente.
 * Só aparece quando o servidor tem a ferramenta e ainda há contas LEAD (ou depois de uma ação nesta sessão, para poder restaurar).
 */
export function LeadMigrationPanel({
  squadOfUser,
  onChanged,
}: {
  /** Squad ativa da conta (da lista de usuários), para o link do roster. */
  squadOfUser?: (userId: string) => string | undefined;
  /** Chamado depois de rebaixar ou restaurar, para a lista de usuários recarregar. */
  onChanged?: () => void;
}) {
  const [phase, setPhase] = useState<'loading' | 'hidden' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [report, setReport] = useState<LeadDemotionReport | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [touched, setTouched] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [forceTarget, setForceTarget] = useState<LeadUser | null>(null);
  const [forceAck, setForceAck] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** Simulação (não grava nada). `quiet` = chamada de fundo depois de uma ação. */
  const simulate = useCallback(async (quiet = false) => {
    if (!quiet) setBusy('simulate');
    try {
      const next = await runLeadDemotion();
      if (!alive.current) return null;
      setReport(next);
      setPhase('ready');
      return next;
    } catch (e) {
      if (!alive.current) return null;
      if (isLeadDemotionUnavailable(e)) {
        // Servidor anterior à Etapa 4: a ferramenta não existe aqui.
        setPhase('hidden');
        return null;
      }
      const message = errorText(e, 'Não foi possível consultar a migração do nível LEAD.');
      if (quiet) toast.error('Não foi possível atualizar a simulação', { description: message });
      else {
        setErrorMessage(message);
        setPhase('error');
      }
      return null;
    } finally {
      if (alive.current && !quiet) setBusy(null);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial do painel
    void simulate();
  }, [simulate]);

  const apply = async (options: { userId?: string; forceDemote?: boolean }) => {
    setBusy(options.forceDemote ? 'force' : 'apply');
    try {
      const applied = await runLeadDemotion({ apply: true, limit: options.userId ? undefined : report?.limit || undefined, ...options });
      if (!alive.current) return;
      setTouched(true);
      const message = appliedMessage(applied);
      setNotice(message);
      toast.success(message, { description: 'As chaves de API continuam válidas até serem renovadas.' });
      onChanged?.();
      await simulate(true);
    } catch (e) {
      toast.error('Não foi possível rebaixar', { description: errorText(e, 'Tente de novo.') });
      await simulate(true);
    } finally {
      if (alive.current) {
        setBusy(null);
        setConfirmApply(false);
        setForceTarget(null);
        setForceAck(false);
      }
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const restored = await restoreLeadLevel();
      if (!alive.current) return;
      setTouched(true);
      const message = restoredMessage(restored);
      setNotice(message);
      toast.success(message);
      onChanged?.();
      await simulate(true);
    } catch (e) {
      toast.error('Não foi possível restaurar', { description: errorText(e, 'Tente de novo.') });
    } finally {
      if (alive.current) {
        setBusy(null);
        setConfirmRestore(false);
      }
    }
  };

  if (phase === 'hidden') return null;
  if (phase === 'loading') {
    return (
      <div role="status" aria-live="polite" className={cn(PAGE_CARD, 'flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground')}>
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary motion-reduce:animate-none" aria-hidden="true" />
        Verificando o nível LEAD…
      </div>
    );
  }
  if (phase === 'error') {
    return (
      <ErrorState
        title="Não foi possível consultar a migração do nível LEAD"
        description={errorMessage}
        onRetry={() => { setPhase('loading'); void simulate(); }}
        className="rounded-2xl border border-dashed border-border"
      />
    );
  }

  const safe = safeToDemote(report);
  const leadUsers = report?.users ?? [];
  // Nada a migrar e nada feito nesta sessão: o painel não tem o que mostrar.
  if (leadUsers.length === 0 && !touched) return null;

  const busyAny = busy !== null;
  const overLimit = report?.summary.overLimit ?? 0;

  return (
    <section aria-label="Migração do nível LEAD" className={cn(PAGE_CARD, 'flex flex-col gap-3 p-4')}>
      <div className="flex flex-wrap items-start gap-3">
        <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TONES.warn.tile)}>
          <ShieldAlert className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-base font-bold text-foreground">Migração do nível LEAD</h3>
          <p className="text-sm text-muted-foreground">
            {leadUsers.length > 0 && report
              ? migrationHeadline(report)
              : 'Nenhuma conta com o nível LEAD.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ModalButton className="h-9 gap-1.5" disabled={busyAny} onClick={() => void simulate()}>
            <PlayCircle className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            {busy === 'simulate' ? 'Simulando…' : 'Simular'}
          </ModalButton>
          <ModalButton variant="primary" className="h-9 gap-1.5" disabled={busyAny || safe.length === 0} onClick={() => setConfirmApply(true)}>
            <UserMinus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            {safe.length > 0 ? `Rebaixar os seguros (${safe.length})` : 'Rebaixar os seguros'}
          </ModalButton>
          <ModalButton className="h-9 gap-1.5" disabled={busyAny} onClick={() => setConfirmRestore(true)}>
            <History className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Restaurar
          </ModalButton>
        </div>
      </div>

      {report?.warnings.map((w) => (
        <p key={w} role="alert" className={cn('rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-semibold', TONES.warn.text)}>
          {w}
        </p>
      ))}

      {notice && (
        <p role="status" className={cn('rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-semibold', TONES.success.text)}>
          {notice}
        </p>
      )}

      {leadUsers.length > 0 && (
        <>
          <p className="text-xs font-semibold text-muted-foreground">Simulação: nada foi alterado até você confirmar.</p>
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {leadUsers.map((u) => (
              <LeadRow
                key={u.userId}
                user={u}
                squadId={squadOfUser?.(u.userId)}
                busy={busyAny}
                onForce={() => { setForceAck(false); setForceTarget(u); }}
              />
            ))}
          </ul>
          {overLimit > 0 && (
            <p className="text-xs text-muted-foreground">
              O servidor rebaixa em lotes de {report?.limit}. {plural(overLimit, 'conta')} {overLimit === 1 ? 'fica' : 'ficam'} para o próximo lote: aplique de novo.
            </p>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmApply}
        onOpenChange={setConfirmApply}
        tone="warn"
        icon={Users}
        title={`Rebaixar ${plural(safe.length, 'conta')} para Membro?`}
        description={
          <>
            Quem tem vínculo de liderança mantém a liderança das squads; só o nível LEAD sai da conta. As chaves de API delas
            continuam válidas até serem renovadas, e a renovação corta os escopos de liderança. Dá para desfazer em Restaurar.
          </>
        }
        confirmLabel={`Rebaixar ${plural(safe.length, 'conta')}`}
        loading={busy === 'apply'}
        loadingLabel="Rebaixando…"
        keepOpenOnConfirm
        onConfirm={() => void apply({})}
      >
        {safe.length > 0 && (
          <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-border px-3 py-2 text-sm">
            {safe.map((u) => (
              <li key={u.userId} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold text-foreground">{leadUserLabel(u)}</span>
                {u.leadershipSquads.length > 0 && <span className="text-xs text-muted-foreground">lidera {u.leadershipSquads.join(', ')}</span>}
                {u.activeApiKeys > 0 && <span className="text-xs text-muted-foreground">{plural(u.activeApiKeys, 'chave')} de API</span>}
              </li>
            ))}
          </ul>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!forceTarget}
        onOpenChange={(open) => { if (!open) { setForceTarget(null); setForceAck(false); } }}
        tone="danger"
        icon={UserMinus}
        title={`Rebaixar ${forceTarget ? leadUserLabel(forceTarget) : ''} mesmo assim?`}
        description="Essa conta não tem liderança em nenhuma squad. Ao virar Membro ela perde o acesso que o nível LEAD ainda dá e nenhum vínculo o substitui. Dá para desfazer em Restaurar."
        confirmLabel="Rebaixar mesmo assim"
        confirmDisabled={!forceAck}
        loading={busy === 'force'}
        loadingLabel="Rebaixando…"
        keepOpenOnConfirm
        onConfirm={() => forceTarget && void apply({ userId: forceTarget.userId, forceDemote: true })}
      >
        <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={forceAck}
            onChange={(e) => setForceAck(e.target.checked)}
            className={cn('mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]', FOCUS_RING)}
          />
          <span>Entendo que essa pessoa fica sem liderança em qualquer squad.</span>
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmRestore}
        onOpenChange={setConfirmRestore}
        tone="warn"
        icon={History}
        title="Restaurar o nível LEAD?"
        description={
          <>
            As contas do backup que hoje são Membro voltam a LEAD. Quem virou Administrador depois não muda.
            {report?.leadLevel === 'off' && ' Com o nível LEAD desligado no servidor, a conta volta a LEAD mas continua sem poder algum.'}
          </>
        }
        confirmLabel="Restaurar"
        loading={busy === 'restore'}
        loadingLabel="Restaurando…"
        keepOpenOnConfirm
        onConfirm={() => void restore()}
      />
    </section>
  );
}

function LeadRow({ user, squadId, busy, onForce }: { user: LeadUser; squadId?: string; busy: boolean; onForce: () => void }) {
  const label = leadUserLabel(user);
  const action = actionLabel(user.action);
  const noLink = user.classification === 'NO_LEADERSHIP_LINK';
  const roster = rosterHref(squadId);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
      <span className={cn('flex min-w-0 flex-1 basis-56 items-center gap-3', !user.active && 'opacity-60')}>
        <InitialsAvatar name={user.name} email={user.email} userId={user.userId} className="h-8 w-8 text-xs" />
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-bold text-foreground">{label}</span>
            {!user.active && <StatusChip tone="neutral" className="h-5">Inativa</StatusChip>}
          </span>
          {user.email && user.name && <span className="truncate text-xs text-muted-foreground">{user.email}</span>}
        </span>
      </span>

      <span className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusChip tone={noLink ? 'warn' : 'success'}>{CLASSIFICATION_LABEL[user.classification]}</StatusChip>
          {action && <StatusChip tone={action.tone}>{action.label}</StatusChip>}
        </span>
        <span className="text-xs text-muted-foreground">
          {noLink ? 'Ficaria sem liderança em nenhuma squad.' : `Lidera ${user.leadershipSquads.join(', ') || 'uma squad'}.`}
          {user.activeApiKeys > 0 && ` ${plural(user.activeApiKeys, 'chave')} de API ${user.activeApiKeys === 1 ? 'ativa' : 'ativas'}.`}
        </span>
      </span>

      {noLink && (
        <span className="flex flex-wrap items-center gap-2">
          {roster && (
            <Link
              href={roster}
              className={cn(
                'inline-flex h-9 items-center rounded-[10px] border border-border px-3 text-[13px] font-medium text-foreground hover:bg-accent max-sm:h-11',
                FOCUS_RING,
              )}
            >
              Adicionar vínculo
            </Link>
          )}
          <ModalButton variant="danger" className="h-9 px-3 text-[13px]" disabled={busy} onClick={onForce}>
            Rebaixar mesmo assim
          </ModalButton>
        </span>
      )}
    </li>
  );
}
