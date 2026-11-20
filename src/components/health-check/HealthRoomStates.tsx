'use client';

import Link from 'next/link';
import { AlertTriangle, Loader2, RefreshCw, Trash2, UserPlus } from 'lucide-react';
import { IconTile, ModalButton } from '@/components/room-kit';

export type HealthRoomStateKind = 'loading' | 'entering' | 'notfound' | 'error' | 'deleted';

const BACK_HREF = '/health-check';

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-1 items-center justify-center bg-background p-6 text-foreground">{children}</div>;
}

/**
 * Estados de página da sala do Radar de clima antes de a votação ou o resultado aparecerem: carregando, entrando
 * na sala, não encontrado, erro ao carregar (com "Tentar de novo": falha de rede não pode parecer "não existe") e
 * radar apagado pelo organizador.
 */
export function HealthRoomState({ kind, onRetry }: { kind: HealthRoomStateKind; onRetry?: () => void }) {
  if (kind === 'loading') {
    return (
      <Centered>
        <div role="status" aria-label="Carregando o radar" className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="h-10 w-10 motion-safe:animate-spin" strokeWidth={1.5} aria-hidden="true" />
          <p className="m-0 text-[15px] font-semibold">Carregando o radar…</p>
        </div>
      </Centered>
    );
  }

  if (kind === 'entering') {
    return (
      <Centered>
        <div role="status" aria-label="Entrando na sala" className="flex max-w-sm flex-col items-center gap-3 text-center">
          <IconTile icon={UserPlus} size="lg" className="h-14 w-14 rounded-2xl" />
          <h2 className="m-0 text-[22px] font-bold">Entrando na sala…</h2>
          <p className="m-0 text-sm leading-relaxed text-muted-foreground">Estamos registrando você como participante. Isso acontece uma vez por radar.</p>
        </div>
      </Centered>
    );
  }

  const deleted = kind === 'deleted';
  const notFound = kind === 'notfound';
  return (
    <Centered>
      <div role={deleted || notFound ? 'status' : 'alert'} className="flex max-w-md flex-col items-center gap-3 text-center">
        <IconTile icon={deleted ? Trash2 : AlertTriangle} tone="warn" size="lg" className="h-14 w-14 rounded-2xl" />
        <h2 className="m-0 text-[22px] font-bold">
          {deleted ? 'Este radar foi apagado' : notFound ? 'Radar não encontrado' : 'Não foi possível carregar o radar'}
        </h2>
        <p className="m-0 text-sm leading-relaxed text-muted-foreground">
          {deleted
            ? 'Quem criou o radar removeu a pesquisa, com as respostas e os comentários.'
            : notFound
              ? 'O link pode estar incompleto ou o radar foi apagado. Confira o endereço ou volte para a lista.'
              : 'Houve um problema de conexão com o servidor. Tente de novo em instantes.'}
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {kind === 'error' && onRetry && (
            <ModalButton variant="primary" className="gap-2" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Tentar de novo
            </ModalButton>
          )}
          <Link href={BACK_HREF} className="inline-flex h-10 items-center rounded-[10px] border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            Voltar para o Radar de clima
          </Link>
        </div>
      </div>
    </Centered>
  );
}
