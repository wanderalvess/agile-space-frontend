'use client';

import { AlertTriangle } from 'lucide-react';
import type { JiraPublishPreview, JiraPublishStep } from '@/app/room/jira-publish-api';
import { FIELD, RoleChip } from '@/components/room-kit';
import { cn } from '@/lib/utils';

/** Sub-tarefa editável na prévia: o passo de criação e o comentário que pode ir nela. */
export interface EditableSubtask {
  key: string;
  include: boolean;
  create: JiraPublishStep;
  /** Texto do comentário (vem das notas da sala); guardado mesmo com "Comentar" desligado. */
  comment: string;
  commentOn: boolean;
}

/** Rascunho do envio de uma tarefa: o que a prévia do servidor propôs, com as edições de quem envia. */
export interface JiraDraft {
  preview: JiraPublishPreview;
  renameEnabled: boolean;
  renameSummary: string;
  /** Comentário opcional na própria issue pai (útil quando a squad não cria sub-tarefas, ex.: issue de teste). */
  parentComment: string;
  subtasks: EditableSubtask[];
}

export function draftFromPreview(p: JiraPublishPreview): JiraDraft {
  const rename = p.steps.find(s => s.kind === 'RENAME_PARENT');
  const creates = p.steps.filter(s => s.kind === 'CREATE_SUBTASK');
  return {
    preview: p,
    renameEnabled: !!rename,
    renameSummary: rename?.summary ?? '',
    parentComment: p.steps.find(s => s.kind === 'ADD_COMMENT' && s.dependsOnIndex == null)?.comment ?? '',
    subtasks: creates.map(c => {
      const comment = p.steps.find(s => s.kind === 'ADD_COMMENT' && s.dependsOnIndex === c.index)?.comment ?? '';
      return { key: `${c.index}`, include: true, create: { ...c }, comment, commentOn: !!comment.trim() };
    }),
  };
}

/** Lista final reindexada: renomear (opcional) + cada sub incluída, seguida do seu comentário. */
export function buildSteps(d: JiraDraft): JiraPublishStep[] {
  const out: JiraPublishStep[] = [];
  if (d.renameEnabled && d.renameSummary.trim()) {
    out.push({ index: out.length, kind: 'RENAME_PARENT', targetKey: d.preview.parentKey, summary: d.renameSummary.trim() });
  }
  if (d.parentComment.trim()) {
    out.push({ index: out.length, kind: 'ADD_COMMENT', targetKey: d.preview.parentKey, comment: d.parentComment.trim() });
  }
  for (const s of d.subtasks) {
    if (!s.include) continue;
    const createIndex = out.length;
    out.push({
      index: createIndex,
      kind: 'CREATE_SUBTASK',
      issueType: s.create.issueType,
      summary: (s.create.summary ?? '').trim(),
      estimateHours: s.create.estimateHours ?? null,
      role: s.create.role,
      templateId: s.create.templateId,
    });
    const body = s.comment.trim();
    if (s.commentOn && body) out.push({ index: out.length, kind: 'ADD_COMMENT', dependsOnIndex: createIndex, comment: body });
  }
  return out;
}

export function draftCounts(d: JiraDraft) {
  const included = d.subtasks.filter(s => s.include);
  return {
    rename: d.renameEnabled && !!d.renameSummary.trim() ? 1 : 0,
    subtasks: included.length,
    comments: included.filter(s => s.commentOn && s.comment.trim()).length + (d.parentComment.trim() ? 1 : 0),
  };
}

/** "1 renomeação · 3 sub-tarefas · 2 comentários". */
export function countsLabel(c: { rename: number; subtasks: number; comments: number }): string {
  const parts: string[] = [];
  if (c.rename) parts.push(c.rename === 1 ? '1 renomeação' : `${c.rename} renomeações`);
  parts.push(c.subtasks === 1 ? '1 sub-tarefa' : `${c.subtasks} sub-tarefas`);
  parts.push(c.comments === 1 ? '1 comentário' : `${c.comments} comentários`);
  return parts.join(' · ');
}

/** Motivo para não deixar enviar (ou null). */
export function validateDraft(d: JiraDraft): string | null {
  if (d.renameEnabled && (!d.renameSummary.trim() || d.renameSummary.trim().length > 255)) return 'O novo título da pai precisa ter de 1 a 255 caracteres.';
  for (const s of d.subtasks) {
    if (s.include && !(s.create.summary ?? '').trim()) return `Título vazio na sub-tarefa ${s.create.issueType ?? ''}.`;
  }
  if (!d.renameEnabled && !d.parentComment.trim() && !d.subtasks.some(s => s.include)) return 'Nada selecionado para enviar.';
  return null;
}

/** Pontos de atenção da tarefa: avisos do servidor e sub-tarefas de um papel sem nota da sala. */
export function draftAttention(d: JiraDraft): string[] {
  const out = [...d.preview.warnings];
  for (const s of d.subtasks) {
    if (!s.include || s.comment.trim()) continue;
    if (s.create.role === 'QA') out.push(`O QA não escreveu cenários de teste: a sub-tarefa ${s.create.summary || s.create.issueType} vai sem comentário. Dá para escrever aqui ou enviar assim mesmo.`);
  }
  return out;
}

function parseHoursInput(raw: string): number | null {
  const s = raw.trim().replace(',', '.').replace(/h$/i, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const ROLE_CATEGORY: Record<string, string> = { DEV: 'Developer', QA: 'QA' };
const NOTE_SOURCE: Record<string, string> = { DEV: 'Notas técnicas · DEV', QA: 'Cenários de teste · QA' };

const CHECK = 'h-4 w-4 shrink-0 accent-[hsl(var(--primary))]';

/**
 * Editor do envio de uma tarefa: renomear a pai ("Hoje" / "Fica"), e cada sub-tarefa com título, papel e horas
 * à esquerda e o comentário à direita (as notas da sala viram o comentário de cada papel). Tudo editável;
 * nada vai ao Jira até "Enviar".
 */
export function JiraPublishEditor({ draft, onChange, idPrefix }: { draft: JiraDraft; onChange: (d: JiraDraft) => void; idPrefix: string }) {
  const { preview } = draft;
  const update = (key: string, fn: (s: EditableSubtask) => EditableSubtask) =>
    onChange({ ...draft, subtasks: draft.subtasks.map(s => (s.key === key ? fn(s) : s)) });
  const counts = draftCounts(draft);
  const noNotes = draft.subtasks.length > 0 && draft.subtasks.every(s => !s.comment.trim());
  const attention = draftAttention(draft).filter(w => !(noNotes && w.startsWith('O QA não escreveu')));

  return (
    <div className="flex flex-col gap-4">
      {attention.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3.5 text-[13px] leading-relaxed text-amber-900 dark:text-amber-100">
          <li className="font-semibold">Atenção nesta tarefa</li>
          {attention.map(w => (
            <li key={w} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />{w}</li>
          ))}
        </ul>
      )}

      <section aria-labelledby={`${idPrefix}-rename`} className="flex flex-col gap-2.5 rounded-xl border border-border bg-muted/30 px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <label id={`${idPrefix}-rename`} className="flex items-center gap-2.5 text-sm font-semibold">
            <input type="checkbox" className={CHECK} checked={draft.renameEnabled} onChange={(e) => onChange({ ...draft, renameEnabled: e.target.checked })} />
            Renomear a issue pai <span className="font-mono text-xs text-primary [.theme-totvs:not(.dark)_&]:text-foreground">{preview.parentKey}</span>
          </label>
          <span className="flex-1" />
          <span className="text-xs text-muted-foreground">Só o título muda; nenhum outro campo</span>
        </div>
        <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-2 text-[13px]">
          <span className="text-muted-foreground">Hoje</span>
          <span className="truncate text-muted-foreground" title={preview.currentSummary ?? ''}>{preview.currentSummary || '—'}</span>
          <label htmlFor={`${idPrefix}-rename-input`} className="text-muted-foreground">Fica</label>
          <input
            id={`${idPrefix}-rename-input`}
            value={draft.renameSummary}
            onChange={(e) => onChange({ ...draft, renameSummary: e.target.value })}
            disabled={!draft.renameEnabled}
            maxLength={255}
            className={cn(FIELD, 'h-9 font-medium disabled:opacity-60')}
          />
        </div>
        <details className="text-[13px]" open={!!draft.parentComment.trim() || draft.subtasks.length === 0}>
          <summary className="cursor-pointer select-none text-muted-foreground">Comentar na issue pai (opcional)</summary>
          <textarea
            id={`${idPrefix}-parent-comment`}
            value={draft.parentComment}
            onChange={(e) => onChange({ ...draft, parentComment: e.target.value })}
            placeholder={`Comentário para ${preview.parentKey}. Deixe vazio para não comentar na pai.`}
            aria-describedby={`${idPrefix}-parent-comment-hint`}
            aria-label={`Comentário na issue pai ${preview.parentKey}`}
            className={cn(FIELD, 'mt-2 min-h-[72px] w-full resize-y py-2.5 text-[13px] leading-relaxed')}
          />
          <p id={`${idPrefix}-parent-comment-hint`} className="m-0 mt-1 text-xs text-muted-foreground">
            {draft.subtasks.length === 0
              ? 'Sem sub-tarefas, as notas DEV e QA da sala vêm para cá. Editar aqui não muda as notas da sala.'
              : 'Normalmente as notas vão nas sub-tarefas; use este campo só se quiser algo na pai também.'}
          </p>
        </details>
      </section>

      <section aria-label="Sub-tarefas e comentários" className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="m-0 text-sm font-semibold">Sub-tarefas e comentários</h3>
          <span className="text-xs text-muted-foreground">{counts.subtasks} de {draft.subtasks.length} · as notas da sala viram o comentário de cada papel</span>
        </div>

        {noNotes && (
          <p className="m-0 rounded-[10px] border border-dashed border-border px-3.5 py-2.5 text-[13px] text-muted-foreground">
            Ninguém escreveu notas DEV ou QA nesta tarefa. As sub-tarefas vão sem comentário; dá para escrever aqui antes de enviar.
          </p>
        )}

        {draft.subtasks.length === 0 && (
          <p className="m-0 text-sm text-muted-foreground">Nenhuma sub-tarefa configurada para esta squad e tipo de issue. Configure em Sub-tarefas do time.</p>
        )}

        {draft.subtasks.map(s => {
          const role = s.create.role && s.create.role !== 'NONE' ? s.create.role : null;
          const sid = `${idPrefix}-sub-${s.key}`;
          return (
            <div key={s.key} className={cn('grid overflow-hidden rounded-xl border border-border bg-muted/30 md:grid-cols-[17rem_minmax(0,1fr)]', !s.include && 'opacity-60')}>
              <div className="flex flex-col gap-2.5 border-border p-3.5 max-md:border-b md:border-r">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    className={CHECK}
                    checked={s.include}
                    onChange={(e) => update(s.key, st => ({ ...st, include: e.target.checked }))}
                    aria-label={`Incluir a sub-tarefa ${s.create.summary || s.create.issueType || ''}`}
                  />
                  <input
                    value={s.create.summary ?? ''}
                    onChange={(e) => update(s.key, st => ({ ...st, create: { ...st.create, summary: e.target.value } }))}
                    disabled={!s.include}
                    maxLength={255}
                    aria-label={`Título da sub-tarefa ${s.create.issueType ?? ''}`}
                    className={cn(FIELD, 'h-8 min-w-0 flex-1 px-2.5 text-[13px] font-semibold')}
                  />
                </div>
                <div className="flex items-center gap-2">
                  {role && <RoleChip category={ROLE_CATEGORY[role] ?? role} label={role} className="h-[22px]" />}
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{s.create.issueType}</span>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Horas
                    <input
                      value={s.create.estimateHours == null ? '' : String(s.create.estimateHours).replace('.', ',')}
                      onChange={(e) => update(s.key, st => ({ ...st, create: { ...st.create, estimateHours: parseHoursInput(e.target.value) } }))}
                      disabled={!s.include || !preview.hoursDeck}
                      placeholder={preview.hoursDeck ? 'h' : '—'}
                      inputMode="decimal"
                      aria-label={`Horas da sub-tarefa ${s.create.summary || s.create.issueType || ''}`}
                      className={cn(FIELD, 'h-[30px] w-14 px-1.5 text-center text-[13px] font-bold')}
                    />
                  </label>
                </div>
              </div>
              <div className="flex flex-col gap-2 p-3.5">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-[13px] font-medium">
                    <input
                      type="checkbox"
                      className={CHECK}
                      checked={s.commentOn}
                      disabled={!s.include}
                      onChange={(e) => update(s.key, st => ({ ...st, commentOn: e.target.checked }))}
                    />
                    Comentar nesta sub-tarefa
                  </label>
                  <span className="flex-1" />
                  {role && NOTE_SOURCE[role] && <span className="text-xs text-muted-foreground">{NOTE_SOURCE[role]}</span>}
                </div>
                {s.commentOn ? (
                  <>
                    <textarea
                      id={`${sid}-comment`}
                      value={s.comment}
                      onChange={(e) => update(s.key, st => ({ ...st, comment: e.target.value }))}
                      disabled={!s.include}
                      placeholder="Escreva o comentário desta sub-tarefa"
                      aria-label={`Comentário da sub-tarefa ${s.create.summary || s.create.issueType || ''}`}
                      className={cn(FIELD, 'min-h-[84px] resize-y py-2.5 text-[13px] leading-relaxed')}
                    />
                    <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                      <span>Editar aqui só muda o comentário deste envio; as notas da sala continuam iguais.</span>
                      <span className="shrink-0 tabular-nums">{s.comment.length} caracteres</span>
                    </div>
                  </>
                ) : (
                  <span className="rounded-[10px] border border-dashed border-border px-3 py-2.5 text-[13px] text-muted-foreground">
                    Sem comentário.{role ? ` Marque acima para levar as notas ${role} também para esta sub-tarefa.` : ''}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
