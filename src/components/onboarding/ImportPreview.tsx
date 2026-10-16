'use client';

/**
 * Prévia da importação do Jira: a pessoa confere e ajusta antes de gravar.
 *  - Dados da squad editáveis (o que o Jira não trouxe fica em branco para preencher).
 *  - Pessoas com seleção, busca, cargo ajustável e "Sou eu".
 * Cargos de liderança vêm travados: só o Jira os atribui (o backend também recusa promoção).
 */

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Crown, Lock, Search, UserCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MemberAvatar } from '@/components/common/MemberAvatar';
import type { ProjectDetail, ProjectImportConfirmBody, ProjectMemberRoleItem } from '@/services/projectService';
import { TONES } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { Caption, InlineNotice, Spinner } from './ui';

/** Cargos que a pessoa pode atribuir na prévia (sem governança). Espelha o backend. */
export const ASSIGNABLE_ROLES = ['Developer', 'QA', 'Designer', 'UX', 'SME', 'Stakeholder / Observador'];

interface Props {
  project: ProjectDetail;
  /** Reconhece a própria pessoa na lista (por conta ou e-mail). */
  isMe: (m: ProjectMemberRoleItem) => boolean;
  busy: boolean;
  onBack: () => void;
  onConfirm: (body: ProjectImportConfirmBody) => void;
  /** Quem importa não é AM/PL nem aparece como tal no Jira: o backend recusaria a gravação. */
  blocked?: boolean;
  /** Posição na fila de importação em lote (ex.: "Squad 2 de 5"). */
  queueLabel?: string;
  /** Pula esta squad e segue pra próxima da fila. */
  onSkip?: () => void;
}

interface RowState {
  selected: boolean;
  role: string;
  linkToMe: boolean;
}

const keyOf = (m: ProjectMemberRoleItem, i: number) => m.jiraAccountId || m.email || `${m.displayName}-${i}`;

function Field({ id, label, value, onChange, placeholder, note, inputMode }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  note?: string;
  inputMode?: 'numeric';
}) {
  const missing = !value.trim();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="flex items-center justify-between">
        <Caption className="text-[10px]">{label}</Caption>
        {missing && <span className={cn('text-xs font-semibold', TONES.warn.text)}>preencha</span>}
      </Label>
      <Input
        id={id}
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Não informado no Jira'}
        className={cn('h-10 rounded-[10px]', missing && 'border-amber-500/50 bg-amber-500/5')}
      />
      {!!note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}

export function ImportPreview({ project, isMe, busy, onBack, onConfirm, blocked, queueLabel, onSkip }: Props) {
  const [fields, setFields] = useState({
    // O Jira devolve a chave (DDWMISSI) quando não há nome melhor; nesse caso o campo começa vazio para a pessoa preencher.
    name: project.name && project.name.toUpperCase() !== project.id.toUpperCase() ? project.name : '',
    segmentName: project.segmentName || '',
    tribeName: project.tribeName || '',
    locality: project.locality || '',
    vicePresident: project.vicePresident || '',
    vpArea: project.vpArea || '',
    status: project.status || '',
  });
  const set = (k: keyof typeof fields) => (v: string) => setFields((f) => ({ ...f, [k]: v }));

  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    project.members.forEach((m, i) => {
      init[keyOf(m, i)] = { selected: true, role: m.roleName, linkToMe: false };
    });
    return init;
  });
  const [query, setQuery] = useState('');
  const [onlyLeaders, setOnlyLeaders] = useState(false);

  const meFound = project.members.some(isMe);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return project.members
      .map((m, i) => ({ m, key: keyOf(m, i) }))
      .filter(({ m }) => !onlyLeaders || m.leadership)
      .filter(({ m }) => !q || `${m.displayName} ${m.email ?? ''} ${m.roleName}`.toLowerCase().includes(q));
  }, [project.members, query, onlyLeaders]);

  const selectedCount = Object.values(rows).filter((r) => r.selected).length;
  const patch = (key: string, p: Partial<RowState>) => setRows((r) => ({ ...r, [key]: { ...r[key], ...p } }));
  const setAll = (selected: boolean) => setRows((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { ...v, selected }])));
  const markMe = (key: string) =>
    setRows((r) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [k, { ...v, linkToMe: k === key ? !v.linkToMe : false, selected: k === key ? true : v.selected }]),
      ),
    );

  const confirm = () => {
    const members = project.members.flatMap((m, i) => {
      const st = rows[keyOf(m, i)];
      if (!st?.selected) return [];
      return [
        {
          jiraAccountId: m.jiraAccountId,
          email: m.email,
          displayName: m.displayName,
          roleName: st.role,
          linkToMe: st.linkToMe || isMe(m),
        },
      ];
    });
    onConfirm({
      name: fields.name.trim() || project.name || project.id,
      segmentName: fields.segmentName.trim(),
      tribeName: fields.tribeName.trim(),
      locality: fields.locality.trim(),
      vicePresident: fields.vicePresident.trim(),
      vpArea: fields.vpArea.trim(),
      status: fields.status.trim(),
      creationDate: project.creationDate || '',
      members,
    });
  };

  const plural = selectedCount === 1 ? '' : 's';

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          {!!queueLabel && (
            <span className="inline-flex h-[22px] items-center rounded-full border border-border px-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">{queueLabel}</span>
          )}
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight">{fields.name.trim() || project.name || project.id}</h2>
            <span className="inline-flex h-[22px] items-center rounded-full border border-border px-2.5 font-code text-[11px] font-semibold text-muted-foreground">{project.id}</span>
          </div>
          <p className="text-[13px] text-muted-foreground">Confira, ajuste o que precisar e escolha quem entra. Nada é gravado antes de confirmar.</p>
        </div>
        <div className="flex items-center gap-1">
          {onSkip && (
            <Button type="button" variant="ghost" onClick={onSkip} disabled={busy} className="h-9 rounded-[10px] px-3 text-[13px] font-bold">
              Pular esta squad
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onBack} disabled={busy} className="h-9 gap-1.5 rounded-[10px] px-3 text-[13px] font-bold">
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} /> {queueLabel ? 'Voltar à lista' : 'Trocar projeto'}
          </Button>
        </div>
      </div>

      {blocked && (
        <InlineNotice role="alert" tone="warn" icon={Lock}>
          <strong className="font-bold">Só Agile Master ou People Lead cadastram squads.</strong>{' '}
          <span className="text-muted-foreground">Seu nome não aparece com esse papel nesta squad no Jira. Peça a quem lidera para importá-la, ou para mandar um link de convite.</span>
        </InlineNotice>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        {/* DADOS DA SQUAD */}
        <section className="flex flex-col gap-3.5 rounded-2xl border border-border bg-muted/30 p-[18px]" aria-label="Dados da squad">
          <Caption>Dados da squad</Caption>
          <Field id="imp-nome" label="Nome da squad" value={fields.name} onChange={set('name')} placeholder="Ex.: Projeto Missisauga - Winthor" note={`Referência no Jira: ${project.id}`} />
          <Field id="imp-seg" label="Segmento" value={fields.segmentName} onChange={set('segmentName')} />
          <Field id="imp-tribo" label="Tribo" value={fields.tribeName} onChange={set('tribeName')} />
          <Field id="imp-local" label="Localidade" value={fields.locality} onChange={set('locality')} />
          <div className="grid grid-cols-2 gap-3">
            <Field id="imp-vp" label="VP" value={fields.vicePresident} onChange={set('vicePresident')} />
            <Field id="imp-areavp" label="Área VP" value={fields.vpArea} onChange={set('vpArea')} />
          </div>
          <Field id="imp-status" label="Status" value={fields.status} onChange={set('status')} />
        </section>

        {/* PESSOAS */}
        <section className="flex min-h-0 min-w-0 flex-col gap-3" aria-label="Pessoas da squad">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Users aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} /> Pessoas da squad
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold normal-case tracking-normal', TONES.brand.chip)}>
                {selectedCount} de {project.members.length}
              </span>
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={() => setAll(true)} className="h-[30px] rounded-[10px] px-3 text-xs font-semibold">
                Todos
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setAll(false)} className="h-[30px] rounded-[10px] px-3 text-xs font-semibold">
                Nenhum
              </Button>
              <Button
                type="button"
                variant={onlyLeaders ? 'default' : 'outline'}
                size="sm"
                aria-pressed={onlyLeaders}
                onClick={() => setOnlyLeaders((v) => !v)}
                className="h-[30px] gap-1.5 rounded-[10px] px-3 text-xs font-semibold"
              >
                <Crown aria-hidden="true" className="h-3 w-3" strokeWidth={1.5} /> Liderança
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, e-mail ou cargo" aria-label="Buscar pessoa" className="h-10 rounded-xl pl-9" />
          </div>

          {!meFound && project.members.length > 0 && (
            <InlineNotice tone="warn" icon={UserCheck} className="py-2.5 text-xs">
              <span className="text-xs text-muted-foreground">
                Seu e-mail não apareceu na lista. Se você está aí, use “Sou eu” na sua linha para vincular a conta. Sem isso, você entra como Developer.
              </span>
            </InlineNotice>
          )}

          <div className="max-h-[52vh] min-h-[240px] overflow-y-auto rounded-2xl border border-border">
            {list.length === 0 ? (
              <div className="p-10 text-center text-[13px] text-muted-foreground">
                {project.members.length === 0 ? 'Nenhuma pessoa encontrada no Jira para esta squad.' : 'Ninguém corresponde à busca.'}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {list.map(({ m, key }) => {
                  const st = rows[key];
                  const me = isMe(m);
                  return (
                    <li key={key} className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5 sm:flex-nowrap', !st?.selected && 'opacity-55', (me || st?.linkToMe) && 'bg-primary/5')}>
                      <Checkbox checked={!!st?.selected} onCheckedChange={(v) => patch(key, { selected: v === true })} aria-label={`Importar ${m.displayName}`} />
                      <MemberAvatar name={m.displayName} src={m.avatarUrl} className="h-[34px] w-[34px] text-[11px]" />
                      <div className="min-w-0 flex-1 basis-36">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <span className="truncate">{m.displayName}</span>
                          {(me || st?.linkToMe) && (
                            <span className="inline-flex h-4 shrink-0 items-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">Você</span>
                          )}
                        </div>
                        {m.email && <div className="truncate text-xs text-muted-foreground">{m.email}</div>}
                      </div>

                      {!meFound && (
                        <Button
                          type="button"
                          size="sm"
                          variant={st?.linkToMe ? 'default' : 'outline'}
                          onClick={() => markMe(key)}
                          className="h-7 shrink-0 gap-1 rounded-[10px] px-2.5 text-[11px] font-semibold"
                          aria-pressed={!!st?.linkToMe}
                        >
                          {st?.linkToMe ? <Check aria-hidden="true" className="h-3 w-3" strokeWidth={1.5} /> : <UserCheck aria-hidden="true" className="h-3 w-3" strokeWidth={1.5} />} Sou eu
                        </Button>
                      )}

                      {m.leadership ? (
                        <span
                          className="inline-flex h-8 w-full shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted-foreground sm:w-[170px]"
                          title="Cargo de liderança vem do Jira e não pode ser alterado aqui"
                        >
                          <Crown aria-hidden="true" className={cn('h-3 w-3 shrink-0', TONES.warn.text)} strokeWidth={1.5} />
                          <span className="min-w-0 flex-1 truncate">{m.roleName}</span>
                          <Lock aria-label="Cargo travado" className="h-3 w-3 shrink-0" strokeWidth={1.5} />
                        </span>
                      ) : (
                        <Select value={st?.role} onValueChange={(v) => patch(key, { role: v })}>
                          <SelectTrigger className="h-8 w-full shrink-0 rounded-lg text-xs font-semibold sm:w-[170px]" aria-label={`Cargo de ${m.displayName}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[...new Set([m.roleName, ...ASSIGNABLE_ROLES])].map((r) => (
                              <SelectItem key={r} value={r} className="text-xs">
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Crown aria-hidden="true" className={cn('h-3 w-3 shrink-0', TONES.warn.text)} strokeWidth={1.5} />
            Cargo de liderança vem do Jira e fica travado. Os demais aceitam: {ASSIGNABLE_ROLES.slice(0, -1).join(', ')} ou {ASSIGNABLE_ROLES[ASSIGNABLE_ROLES.length - 1]}.
          </span>
        </section>
      </div>

      <div className="sticky bottom-0 flex flex-col-reverse items-stretch gap-2 rounded-2xl border border-border bg-background/95 p-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {selectedCount === 0
            ? 'Nenhuma pessoa marcada: a squad será criada só com você. Marque quem deve entrar ou ajuste depois no roster da squad.'
            : `${selectedCount} pessoa${plural} ${selectedCount === 1 ? 'vai' : 'vão'} entrar na squad. Você pode ajustar cargos e pessoas depois no roster da squad.`}
        </p>
        <Button type="button" onClick={confirm} disabled={busy || blocked} className="h-11 shrink-0 gap-2 rounded-[10px] px-6 text-sm font-bold">
          {busy ? (
            <Spinner />
          ) : (
            <>
              Importar {selectedCount} pessoa{plural} <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

