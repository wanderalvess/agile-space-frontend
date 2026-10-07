'use client';

/**
 * Tela de "ainda não há dados" do Squad Hub (Cronograma, Métricas e Quadro). Em vez de uma tabela em branco ou
 * de um texto cinza, diz em qual dos três casos a squad está e traz o próximo passo:
 *  - sem Jira conectado  -> conectar
 *  - conectado, nunca sincronizado -> sincronizar
 *  - a última sincronização falhou -> tentar de novo (com o motivo)
 */

import { Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type SquadDataStateKind = 'no-jira' | 'first-sync' | 'sync-error' | 'empty-sprint' | 'no-board';

export function deriveSquadDataState(input: {
  jiraConnected: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: 'success' | 'error';
}): SquadDataStateKind {
  if (!input.jiraConnected) return 'no-jira';
  if (input.lastSyncStatus === 'error') return 'sync-error';
  if (!input.lastSyncAt) return 'first-sync';
  return 'empty-sprint';
}

interface SquadDataStateProps {
  kind: SquadDataStateKind;
  /** O que esta tela mostraria, por exemplo "o Cronograma" ou "as Métricas". */
  subject: string;
  isSyncing?: boolean;
  errorMessage?: string;
  onConnect?: () => void;
  onSync?: () => void;
  className?: string;
}

function Step({ n, done, current, children }: { n: number; done?: boolean; current?: boolean; children: React.ReactNode }) {
  return (
    <li className={cn('flex items-center gap-3 text-sm', current ? 'font-semibold text-slate-900 dark:text-white' : done ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400')}>
      <span className={cn(
        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0',
        done ? 'bg-emerald-500/20' : current ? 'bg-primary text-primary-foreground' : 'border border-slate-400/60'
      )}>
        {done ? <Check className="h-3.5 w-3.5" /> : n}
      </span>
      {children}
    </li>
  );
}

export function SquadDataState({ kind, subject, isSyncing, errorMessage, onConnect, onSync, className }: SquadDataStateProps) {
  const isError = kind === 'sync-error';
  const copy = {
    'no-jira': {
      badge: 'Jira não conectado',
      title: `Conecte o Jira para ver ${subject}`,
      body: `${subject.charAt(0).toUpperCase()}${subject.slice(1)} usa as issues da sprint do seu time. Sem o Jira conectado, não há o que mostrar. Leva cerca de um minuto.`,
    },
    'first-sync': {
      badge: 'Primeira sincronização',
      title: 'Falta buscar a sprint no Jira',
      body: 'O Jira já está conectado, mas a sprint desta squad ainda não foi trazida. A busca leva alguns segundos e pode ser repetida quando quiser.',
    },
    'sync-error': {
      badge: 'Não foi possível sincronizar',
      title: 'O Jira não respondeu desta vez',
      body: 'Tente de novo; se continuar, confira se o seu acesso ao Jira ainda é válido. O que já estava salvo continua disponível.',
    },
    'no-board': {
      badge: 'Quadro não encontrado',
      title: 'Não achamos o quadro Scrum deste projeto',
      body: 'Confira a chave do projeto e o domínio do Jira nas configurações da squad, ou informe o ID do quadro.',
    },
    'empty-sprint': {
      badge: 'Sprint sem issues',
      title: 'A última sincronização não trouxe issues',
      body: 'A sincronização deu certo, mas a sprint não tem nenhuma issue. Confira se o quadro e a sprint ativa estão certos nas configurações da squad.',
    },
  }[kind];

  return (
    <div className={cn(
      'rounded-3xl border p-6 sm:p-8 flex flex-col gap-4',
      isError ? 'border-rose-500/40 bg-rose-500/5' : 'border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70',
      className
    )}>
      <span className={cn(
        'self-start rounded-full border px-3 py-0.5 text-xs font-semibold',
        isError ? 'border-rose-500/50 text-rose-600 dark:text-rose-300' : kind === 'no-jira' ? 'border-amber-500/50 text-amber-600 dark:text-amber-400' : 'border-blue-500/50 text-blue-600 dark:text-blue-300'
      )}>
        {copy.badge}
      </span>
      <h3 className="text-2xl font-black tracking-tight font-headline text-slate-900 dark:text-white leading-tight">{copy.title}</h3>
      <p className="max-w-2xl text-sm sm:text-base text-slate-600 dark:text-slate-300">{copy.body}</p>

      {(kind === 'no-jira' || kind === 'first-sync') && (
        <ol className="flex flex-col gap-3">
          <Step n={1} done={kind === 'first-sync'} current={kind === 'no-jira'}>Conectar o Jira</Step>
          <Step n={2} done={kind === 'first-sync'}>Escolher o projeto da squad</Step>
          <Step n={3} current={kind === 'first-sync'}>Sincronizar a sprint</Step>
        </ol>
      )}

      {isError && errorMessage && (
        <p className="max-w-2xl rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 font-code text-xs text-slate-600 dark:text-slate-300 break-words">
          Detalhe técnico: {errorMessage}
        </p>
      )}

      <div className="flex flex-wrap gap-3 pt-1">
        {kind === 'no-jira' ? (
          <Button onClick={onConnect} className="h-11 rounded-xl px-5 font-bold">Conectar o Jira</Button>
        ) : (
          <Button onClick={onSync} disabled={isSyncing} className="h-11 rounded-xl px-5 font-bold gap-2">
            <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
            {isSyncing ? (kind === 'no-board' ? 'Buscando…' : 'Sincronizando…') : isError || kind === 'no-board' ? 'Tentar de novo' : 'Sincronizar agora'}
          </Button>
        )}
        {(isError || kind === 'empty-sprint' || kind === 'no-board') && onConnect && (
          <Button onClick={onConnect} variant="outline" className="h-11 rounded-xl px-5 font-semibold">Revisar configuração</Button>
        )}
      </div>
    </div>
  );
}
