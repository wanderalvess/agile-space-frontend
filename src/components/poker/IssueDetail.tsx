'use client';

import React, { useMemo } from 'react';
import { renderIssueRichText, type IssueDetailData } from '@/lib/poker-issue-detail';
import { Bookmark, Bug as BugIcon, CheckSquare, ExternalLink, FileText, Hash, Zap, type LucideIcon } from 'lucide-react';
import { Modal, ModalButton, PersonAvatar, StatusChip, FOCUS_RING } from '@/components/room-kit';
import { cn, toSafeExternalUrl } from '@/lib/utils';

interface IssueDetailProps {
  issue: IssueDetailData | null;
  isOpen: boolean;
  onClose: () => void;
  /** Texto do botão de fechar (padrão "Fechar"). */
  closeLabel?: string;
}

function typeIconOf(type?: string): LucideIcon {
  const t = type?.toLowerCase() || '';
  if (t.includes('story') || t.includes('estória') || t.includes('história')) return Bookmark;
  if (t.includes('bug') || t.includes('erro')) return BugIcon;
  if (t.includes('epic') || t.includes('épico')) return Zap;
  if (t.includes('task') || t.includes('tarefa')) return CheckSquare;
  return Hash;
}

/** Detalhe de uma tarefa (mesa, fila ou histórico): descrição e critérios à esquerda, metadados do Jira à direita. */
export function IssueDetail({ issue, isOpen, onClose, closeLabel = 'Fechar' }: IssueDetailProps) {
  // Hooks antes do retorno antecipado: o HTML só é montado com o modal aberto.
  const description = issue?.description;
  const criteria = issue?.acceptanceCriteria;
  const link = issue?.link;
  const descriptionHtml = useMemo(
    () => (isOpen && description ? renderIssueRichText(description, toSafeExternalUrl(link) ?? undefined) : ''),
    [isOpen, description, link]
  );
  const criteriaHtml = useMemo(
    () => (isOpen && criteria ? renderIssueRichText(criteria, toSafeExternalUrl(link) ?? undefined) : ''),
    [isOpen, criteria, link]
  );
  if (!issue) return null;

  const jiraHref = toSafeExternalUrl(issue.link);
  const updated = issue.updated ? new Date(issue.updated) : null;
  const updatedLabel = updated && !isNaN(updated.getTime()) ? updated.toLocaleDateString('pt-BR') : 'Sem data';

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      size="lg"
      icon={typeIconOf(issue.type)}
      title={issue.summary || 'Sem título'}
      className="sm:max-w-[880px]"
      bodyClassName="p-0"
      headerExtra={
        <div className="flex flex-wrap items-center gap-1.5 px-6 pb-3">
          {issue.key && <span className="mr-1 text-xs font-bold tabular-nums text-primary [.theme-totvs:not(.dark)_&]:text-foreground">{issue.key}</span>}
          {issue.type && <StatusChip tone="brand">{issue.type}</StatusChip>}
          {issue.status && <StatusChip tone="neutral">{issue.status}</StatusChip>}
          {issue.priority && <StatusChip tone="warn">{issue.priority}</StatusChip>}
        </div>
      }
      footerStart={
        jiraHref ? (
          <a
            href={jiraHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('inline-flex h-10 items-center gap-2 rounded-[10px] px-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground', FOCUS_RING)}
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            Abrir no Jira
          </a>
        ) : undefined
      }
      footer={<ModalButton variant="primary" onClick={onClose}>{closeLabel}</ModalButton>}
    >
      <div className="flex min-h-0 flex-col border-t border-border md:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-6 px-6 py-5">
          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <FileText className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Descrição
            </h3>
            {descriptionHtml ? (
              <div
                className="prose prose-sm max-w-none break-words text-sm leading-relaxed text-foreground dark:prose-invert prose-p:my-2 [&>:first-child]:mt-0 [&>:last-child]:mb-0 prose-img:max-w-full prose-code:before:content-none prose-code:after:content-none prose-pre:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: descriptionHtml }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Sem descrição.</p>
            )}
          </section>

          {criteriaHtml && (
            <section className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <CheckSquare className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Critérios de aceite
              </h3>
              <div
                className="prose prose-sm max-w-none break-words rounded-xl border border-border bg-muted/40 p-3.5 text-sm leading-relaxed text-foreground dark:prose-invert prose-p:my-2 [&>:first-child]:mt-0 [&>:last-child]:mb-0"
                dangerouslySetInnerHTML={{ __html: criteriaHtml }}
              />
            </section>
          )}
        </div>

        <aside className="flex shrink-0 flex-col gap-5 border-t border-border bg-muted/40 p-5 md:w-[260px] md:border-l md:border-t-0">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-muted-foreground">Responsável</span>
            <span className="flex items-center gap-2 text-sm font-medium">
              {issue.assignee ? <><PersonAvatar name={issue.assignee} size="sm" /> {issue.assignee}</> : 'Não atribuído'}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-muted-foreground">Última atualização</span>
            <span className="text-sm font-medium tabular-nums">{updatedLabel}</span>
          </div>
          {issue.labels && issue.labels.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-muted-foreground">Marcadores</span>
              <div className="flex flex-wrap gap-1.5">
                {issue.labels.map((label) => (
                  <span key={label} className="inline-flex h-[22px] items-center rounded-md border border-border bg-card px-2 text-xs">{label}</span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </Modal>
  );
}
