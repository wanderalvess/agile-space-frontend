'use client';

import { useMemo, useState, type ElementType, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, ExternalLink, Link2, Pencil, Star, TriangleAlert, Trash2, Workflow } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PAGE_CARD } from '@/components/page';
import { ModalButton } from '@/components/room-kit';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { cn } from '@/lib/utils';
import { canEditItem, canModerateItem, isAdminOverride, safeHttpUrl } from '@/app/prompt-hub/catalog-logic';
import { extractVariables, fillVariables } from '@/app/prompt-hub/variables';
import type { PromptItem } from '@/app/prompt-hub/types';
import { AdminSeal, ImpactChip, SituationChip, TagButton, TypeChip, VisibilityChip } from './Chips';
import { DeleteItemDialog } from './DeleteItemDialog';
import { Discussion } from './Discussion';
import { ItemContent } from './ItemContent';
import { ItemFields } from './ItemFields';
import { UsageCard } from './UsageCard';
import { usePromptActions } from './usePromptActions';
import { VersionsCard } from './VersionsCard';

interface ItemDetailProps {
  item: PromptItem;
  /** `page`: duas colunas, título como h1. `panel`: coluna única dentro do painel lateral. */
  mode: 'page' | 'panel';
  /** A tela dona do item atualiza a cópia que guarda (uso contado, favorito, versão restaurada). */
  onPatch: (patch: Partial<PromptItem>) => void;
  /** Depois de excluir: a página volta ao catálogo e o painel fecha. */
  onDeleted: () => void;
  onSelectTag?: (tag: string) => void;
  /** Elemento do título e da descrição. A página usa h1/p; o painel usa o título e a descrição do Sheet. */
  Title?: ElementType;
  Description?: ElementType;
  /** Linha acima do título (migalha na página; "Abrir como página" e fechar no painel). */
  topBar?: ReactNode;
}

const dateLabel = (iso?: string) => {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime()) ? format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR }) : '';
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </>
  );
}

/**
 * Tudo sobre um item: ações, campos para preencher, conteúdo, discussão, ficha técnica, etiquetas,
 * uso das últimas semanas e versões. É o mesmo conteúdo na página própria e no painel lateral.
 */
export function ItemDetail({ item, mode, onPatch, onDeleted, onSelectTag, Title = 'h1', Description = 'p', topBar }: ItemDetailProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [justCopied, setJustCopied] = useState(false);
  const [toDelete, setToDelete] = useState<PromptItem | null>(null);
  const [versionKey, setVersionKey] = useState(0);

  const actions = usePromptActions({
    onUsed: () => onPatch({ useCount: (item.useCount || 0) + 1 }),
  });
  const { sessionId } = actions;

  const fields = useMemo(() => extractVariables(item.content), [item.content]);
  const hasContent = !!item.content?.trim();
  const filledText = useMemo(() => fillVariables(item.content ?? '', values), [item.content, values]);
  const toolLink = safeHttpUrl(item.gemLink);
  const toolBlocked = !!item.gemLink?.trim() && !toolLink;
  const docLink = safeHttpUrl(item.architectureLink);

  const canEdit = canEditItem(item, sessionId);
  const canModerate = canModerateItem(item, sessionId);
  const adminSeal = isAdminOverride(item, sessionId);
  const isFavorite = typeof item.favorite === 'boolean' ? item.favorite : actions.localFavorites.has(item.id);
  const isVisitor = !sessionId;
  const isPanel = mode === 'panel';

  const copy = async () => {
    const ok = await actions.copyText(item, filledText, fields.length > 0 ? 'Conteúdo copiado com os seus campos' : 'Conteúdo copiado');
    if (!ok) return;
    setJustCopied(true);
    window.setTimeout(() => setJustCopied(false), 2000);
  };

  const favorite = async () => {
    const next = await actions.toggleFavorite(item, isFavorite);
    if (next !== null && typeof item.favorite === 'boolean') onPatch({ favorite: next });
  };

  const buttonOutline = 'gap-2';
  const fieldColumns = isPanel ? 1 : (Math.min(3, Math.max(1, fields.length)) as 1 | 2 | 3);

  const side = (
    <aside aria-label="Sobre o item" className="flex min-w-0 flex-col gap-3.5">
      <section aria-label="Ficha técnica" className={cn(PAGE_CARD, 'flex flex-col gap-3 p-[18px]')}>
        <h2 className="text-base font-bold text-foreground">Ficha técnica</h2>
        <dl className="grid grid-cols-[104px_1fr] gap-x-3 gap-y-2.5 text-sm">
          <Fact label="Autor">
            <span className="flex items-center gap-2">
              <InitialsAvatar name={item.authorName} className="h-6 w-6 text-xs" />
              <span className="min-w-0">
                {item.authorId ? (
                  <Link
                    href={`/prompt-hub/autor/${encodeURIComponent(item.authorId)}`}
                    className="font-semibold underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {item.authorName || 'Membro'}
                  </Link>
                ) : (
                  <span className="font-semibold">{item.authorName || 'Membro'}</span>
                )}
                {item.authorRole && <span className="block text-[13px] text-muted-foreground">{item.authorRole}</span>}
              </span>
            </span>
          </Fact>
          {dateLabel(item.updatedAt) && <Fact label="Atualizado">{dateLabel(item.updatedAt)}</Fact>}
          <Fact label="Uso">
            <span className="tabular-nums">
              {(item.useCount || 0).toLocaleString('pt-BR')} cópias · {(item.forkCount || 0).toLocaleString('pt-BR')} duplicações
            </span>
          </Fact>
          {item.targetAudience?.trim() && <Fact label="Público-alvo">{item.targetAudience}</Fact>}
          {item.businessGoal?.trim() && <Fact label="Objetivo">{item.businessGoal}</Fact>}
          {docLink && (
            <Fact label="Documentação">
              <a
                href={docLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 break-all font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [.theme-totvs:not(.dark)_&]:text-foreground"
              >
                {docLink}
                <ExternalLink className="h-3 w-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              </a>
            </Fact>
          )}
        </dl>
      </section>

      {item.tags?.length > 0 && (
        <section aria-label="Etiquetas" className={cn(PAGE_CARD, 'flex flex-col gap-2.5 p-[18px]')}>
          <h2 className="text-base font-bold text-foreground">Etiquetas</h2>
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map(tag => (
              <TagButton
                key={tag}
                tag={tag}
                onClick={() => (onSelectTag ? onSelectTag(tag) : router.push(`/prompt-hub?tag=${encodeURIComponent(tag)}`))}
              />
            ))}
          </div>
        </section>
      )}

      <UsageCard itemId={item.id} refreshKey={item.useCount} />
      <VersionsCard
        item={item}
        canRestore={canEdit}
        refreshKey={`${item.updatedAt ?? ''}-${versionKey}`}
        onRestored={restored => {
          onPatch(restored);
          setVersionKey(key => key + 1);
        }}
      />
    </aside>
  );

  return (
    <div className="flex flex-col gap-4">
      {(topBar || adminSeal) && (
        <div className="flex flex-wrap items-center gap-2.5">
          {topBar}
          <span className="flex-1" />
          {adminSeal && <AdminSeal>Admin: você pode editar, excluir e moderar</AdminSeal>}
        </div>
      )}

      <div className={cn(isPanel ? 'flex flex-col gap-[18px]' : 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]')}>
        <div className="flex min-w-0 flex-col gap-[18px]">
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              <TypeChip type={item.type} />
              <SituationChip status={item.status || 'producao'} />
              <ImpactChip impact={item.impact || 'medio'} />
              <VisibilityChip visibility={item.visibility} />
            </div>
            <Title className={cn('font-bold leading-tight tracking-tight text-foreground', isPanel ? 'text-[22px]' : 'text-[34px]')}>
              {item.title?.trim() || 'Item sem título'}
            </Title>
            {item.description?.trim() && (
              <Description className={cn('max-w-[820px] leading-relaxed text-muted-foreground', isPanel ? 'text-sm' : 'text-base')}>
                {item.description}
              </Description>
            )}
          </section>

          <section aria-label="Ações" className="flex flex-wrap items-center gap-2">
            {hasContent && (
              <ModalButton variant="primary" onClick={copy} className={buttonOutline}>
                <Copy className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                {justCopied ? 'Copiado' : fields.length > 0 ? 'Copiar com os campos' : 'Copiar conteúdo'}
              </ModalButton>
            )}
            {item.gemLink?.trim() && (
              <ModalButton
                variant={hasContent ? 'secondary' : 'primary'}
                disabled={toolBlocked}
                onClick={() => toolLink && void actions.openTool(item, toolLink)}
                className={buttonOutline}
              >
                <ExternalLink className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                Abrir ferramenta
              </ModalButton>
            )}
            <ModalButton onClick={() => void actions.duplicate(item)} disabled={actions.isDuplicating} className={buttonOutline}>
              <Workflow className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Duplicar
            </ModalButton>
            <ModalButton
              onClick={() => void favorite()}
              aria-pressed={isFavorite}
              className={cn(buttonOutline, isFavorite && 'text-amber-700 dark:text-amber-300')}
            >
              <Star className={cn('h-4 w-4', isFavorite && 'fill-current')} strokeWidth={1.5} aria-hidden="true" />
              {isFavorite ? 'Favorito salvo' : 'Favoritar'}
            </ModalButton>
            <ModalButton onClick={() => void actions.copyLink(item)} className={buttonOutline}>
              <Link2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Copiar link
            </ModalButton>
            {canEdit && (
              <>
                <span className="flex-1" />
                <ModalButton onClick={() => router.push(`/prompt-hub/${encodeURIComponent(item.id)}/editar`)} className={buttonOutline}>
                  <Pencil className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  Editar
                </ModalButton>
                <ModalButton onClick={() => setToDelete(item)} className={cn(buttonOutline, 'text-red-700 dark:text-red-300')}>
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  Excluir
                </ModalButton>
              </>
            )}
          </section>

          {isVisitor && (
            <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-3 text-sm text-foreground dark:bg-primary/15">
              <span className="flex-1">Entre para duplicar, favoritar e comentar.</span>
              <Link
                href="/login"
                className="inline-flex h-9 items-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Entrar
              </Link>
            </div>
          )}

          {toolBlocked && (
            <div role="alert" className="flex gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-3 text-sm leading-relaxed text-foreground">
              <TriangleAlert className="mt-0.5 h-[18px] w-[18px] shrink-0 text-amber-700 dark:text-amber-300" strokeWidth={1.5} aria-hidden="true" />
              <span>
                <strong>O endereço não começa com http:// ou https://.</strong> Por segurança o botão &quot;Abrir ferramenta&quot; fica desligado.
                {canEdit ? ' Edite o item e corrija o link.' : ' Peça à pessoa autora para corrigir o link.'}{' '}
                <span className="break-all font-mono text-[13px]">{item.gemLink}</span>
              </span>
            </div>
          )}

          {fields.length > 0 && (
            <ItemFields fields={fields} values={values} columns={fieldColumns} onChange={(name, value) => setValues(prev => ({ ...prev, [name]: value }))} />
          )}

          {!hasContent && toolLink && (
            <section className={cn(PAGE_CARD, 'flex items-center gap-4 p-[22px]')}>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-bold text-foreground">Este item não tem texto para copiar</span>
                <span className="text-sm text-muted-foreground">Ele abre uma ferramenta externa. Cada abertura conta como um uso.</span>
                <span className="truncate font-mono text-[13px] text-muted-foreground">{item.gemLink}</span>
              </span>
            </section>
          )}

          {hasContent && <ItemContent item={item} values={values} content={item.content ?? ''} />}

          <Discussion item={item} canModerate={canModerate} authorSnapshot={actions.authorSnapshot} />
        </div>

        {side}
      </div>

      <DeleteItemDialog item={toDelete} sessionId={sessionId} onClose={() => setToDelete(null)} onDeleted={onDeleted} />
    </div>
  );
}
