'use client';

/**
 * Prévia da importação do Jira: o usuário confere e ajusta antes de gravar.
 *  - Dados do projeto editáveis (o que o Jira não trouxe fica em branco para preencher).
 *  - Pessoas com seleção, busca, cargo ajustável e "sou eu".
 * Cargos de liderança vêm travados: só o Jira os atribui (o backend também recusa promoção).
 */

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Crown, Loader2, Lock, Search, UserCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { MemberAvatar } from '@/components/common/MemberAvatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ProjectDetail, ProjectImportConfirmBody, ProjectMemberRoleItem } from '@/services/projectService';
import { cn } from '@/lib/utils';

/** Cargos que o usuário pode atribuir na prévia (sem governança). Espelha o backend. */
const ASSIGNABLE_ROLES = ['Developer', 'QA', 'Designer', 'UX', 'SME', 'Stakeholder / Observador'];

interface Props {
  project: ProjectDetail;
  /** Reconhece a própria pessoa na lista (por conta ou e-mail). */
  isMe: (m: ProjectMemberRoleItem) => boolean;
  busy: boolean;
  onBack: () => void;
  onConfirm: (body: ProjectImportConfirmBody) => void;
  /** Quem importa não é AM/PL nem aparece como tal no Jira: o backend recusaria a gravação. */
  blocked?: boolean;
  /** Posição na fila de importação em lote (ex.: "Equipe 2 de 5"). */
  queueLabel?: string;
  /** Pula esta equipe e segue pra próxima da fila. */
  onSkip?: () => void;
}

interface RowState {
  selected: boolean;
  role: string;
  linkToMe: boolean;
}

const keyOf = (m: ProjectMemberRoleItem, i: number) => m.jiraAccountId || m.email || `${m.displayName}-${i}`;

function Field({ id, label, value, onChange, placeholder, inputMode }: {
  id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: 'numeric';
}) {
  const missing = !value.trim();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
        {missing && <span className="font-bold normal-case tracking-normal text-amber-600 dark:text-amber-400">preencha</span>}
      </Label>
      <Input
        id={id}
        value={value}
        inputMode={inputMode}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? 'Não informado no Jira'}
        className={cn('h-10 rounded-xl', missing && 'border-amber-500/40 bg-amber-500/5')}
      />
    </div>
  );
}

export function JiraImportPreview({ project, isMe, busy, onBack, onConfirm, blocked, queueLabel, onSkip }: Props) {
  const [fields, setFields] = useState({
    // O Jira devolve a chave (DDWMISSI) quando não há nome melhor; nesse caso o campo começa vazio para o usuário preencher.
    name: project.name && project.name.toUpperCase() !== project.id.toUpperCase() ? project.name : '',
    segmentName: project.segmentName || '',
    tribeName: project.tribeName || '',
    locality: project.locality || '',
    vicePresident: project.vicePresident || '',
    vpArea: project.vpArea || '',
    status: project.status || '',
  });
  const set = (k: keyof typeof fields) => (v: string) => setFields(f => ({ ...f, [k]: v }));

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

  const selectedCount = Object.values(rows).filter(r => r.selected).length;
  const patch = (key: string, p: Partial<RowState>) => setRows(r => ({ ...r, [key]: { ...r[key], ...p } }));
  const setAll = (selected: boolean) =>
    setRows(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { ...v, selected }])));
  const markMe = (key: string) =>
    setRows(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { ...v, linkToMe: k === key ? !v.linkToMe : false, selected: k === key ? true : v.selected }])));

  const confirm = () => {
    const members = project.members.flatMap((m, i) => {
      const st = rows[keyOf(m, i)];
      if (!st?.selected) return [];
      return [{
        jiraAccountId: m.jiraAccountId, email: m.email, displayName: m.displayName,
        roleName: st.role, linkToMe: st.linkToMe || isMe(m),
      }];
    });
    onConfirm({
      name: fields.name.trim() || project.name || project.id,
      segmentName: fields.segmentName.trim(), tribeName: fields.tribeName.trim(), locality: fields.locality.trim(),
      vicePresident: fields.vicePresident.trim(), vpArea: fields.vpArea.trim(), status: fields.status.trim(),
      creationDate: project.creationDate || '',
      members,
    });
  };

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {!!queueLabel && (
            <Badge variant="outline" className="mb-1 text-[10px] font-bold uppercase tracking-widest">{queueLabel}</Badge>
          )}
          <div className="flex items-center gap-2">
            <h2 className="font-headline text-xl font-black tracking-tight">{fields.name.trim() || project.name || project.id}</h2>
            <Badge variant="outline" className="font-code text-[10px]">{project.id}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Confira, ajuste o que precisar e escolha quem entra. Nada é gravado antes de confirmar.</p>
        </div>
        <div className="flex items-center gap-1">
          {onSkip && (
            <Button variant="ghost" onClick={onSkip} disabled={busy} className="h-9 rounded-xl text-xs font-bold">
              Pular esta equipe
            </Button>
          )}
          <Button variant="ghost" onClick={onBack} disabled={busy} className="h-9 gap-1.5 rounded-xl text-xs font-bold">
            <ArrowLeft className="h-3.5 w-3.5" /> {queueLabel ? 'Voltar à lista' : 'Trocar projeto'}
          </Button>
        </div>
      </div>

      {blocked && (
        <div role="alert" className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Só Agile Master ou People Lead cadastram equipes.</strong>{' '}
          Seu nome não aparece com esse papel nesta equipe no Jira. Peça a quem lidera o time para importá-lo
          ou para mandar um link de convite.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        {/* DADOS DO PROJETO */}
        <section className="space-y-4 rounded-3xl border border-border/60 bg-card/80 p-5 backdrop-blur-xl" aria-label="Dados do projeto">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Dados do time</h3>
          <Field id="imp-nome" label="Nome do time" value={fields.name} onChange={set('name')} placeholder="Ex.: Projeto Missisauga - Winthor" />
          <p className="-mt-2 text-[11px] text-muted-foreground">Referência no Jira: <span className="font-code font-bold">{project.id}</span></p>
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
        <section className="flex min-h-0 flex-col gap-3 rounded-3xl border border-border/60 bg-card/80 p-5 backdrop-blur-xl" aria-label="Pessoas do time">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Pessoas do time
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">{selectedCount} de {project.members.length}</span>
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={() => setAll(true)} className="h-8 rounded-lg text-[11px] font-bold">Todos</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setAll(false)} className="h-8 rounded-lg text-[11px] font-bold">Nenhum</Button>
              <Button type="button" variant={onlyLeaders ? 'default' : 'outline'} size="sm" onClick={() => setOnlyLeaders(v => !v)} className="h-8 gap-1 rounded-lg text-[11px] font-bold">
                <Crown className="h-3 w-3" /> Liderança
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nome, e-mail ou cargo" aria-label="Buscar pessoa" className="h-9 rounded-xl pl-9" />
          </div>

          {!meFound && project.members.length > 0 && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
              <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Seu e-mail não apareceu na lista. Se você está aí, use "Sou eu" na sua linha para vincular sua conta. Sem isso, você entra como Developer.
            </p>
          )}

          <div className="max-h-[52vh] min-h-[240px] overflow-y-auto rounded-2xl border border-border/50 divide-y divide-border/40">
            {list.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                {project.members.length === 0 ? 'Nenhuma pessoa encontrada no Jira para este projeto.' : 'Ninguém corresponde à busca.'}
              </div>
            ) : (
              list.map(({ m, key }) => {
                const st = rows[key];
                const me = isMe(m);
                const locked = m.leadership;
                return (
                  <div key={key} className={cn('flex flex-wrap items-center gap-3 px-3 py-2.5 sm:flex-nowrap', st?.selected ? '' : 'opacity-55', me && 'bg-primary/5')}>
                    <Checkbox
                      checked={!!st?.selected}
                      onCheckedChange={v => patch(key, { selected: v === true })}
                      aria-label={`Importar ${m.displayName}`}
                    />
                    <MemberAvatar name={m.displayName} src={m.avatarUrl} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 truncate text-sm font-semibold">
                        <span className="truncate">{m.displayName}</span>
                        {(me || st?.linkToMe) && <Badge className="h-4 px-1.5 py-0 text-[9px]">Você</Badge>}
                      </div>
                      {m.email && <div className="truncate text-[11px] text-muted-foreground">{m.email}</div>}
                    </div>

                    {!meFound && (
                      <Button
                        type="button"
                        size="sm"
                        variant={st?.linkToMe ? 'default' : 'outline'}
                        onClick={() => markMe(key)}
                        className="h-7 shrink-0 gap-1 rounded-lg px-2 text-[10px] font-bold"
                        aria-pressed={!!st?.linkToMe}
                      >
                        {st?.linkToMe ? <Check className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />} Sou eu
                      </Button>
                    )}

                    {locked ? (
                      <Badge variant="outline" className="h-8 shrink-0 gap-1.5 rounded-lg px-2.5 text-[11px]" title="Cargo de liderança vem do Jira e não pode ser alterado aqui">
                        <Crown className="h-3 w-3 text-amber-500" /> {m.roleName} <Lock className="h-3 w-3 text-muted-foreground" />
                      </Badge>
                    ) : (
                      <Select value={st?.role} onValueChange={v => patch(key, { role: v })}>
                        <SelectTrigger className="h-8 w-[170px] shrink-0 rounded-lg text-[11px] font-semibold" aria-label={`Cargo de ${m.displayName}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[...new Set([m.roleName, ...ASSIGNABLE_ROLES])].map(r => (
                            <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 flex flex-col-reverse items-stretch gap-2 rounded-2xl border border-border/60 bg-background/90 p-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {selectedCount === 0
            ? 'Nenhuma pessoa marcada: a equipe será criada só com você. Marque quem deve entrar ou ajuste depois no roster da squad.'
            : `${selectedCount} pessoa${selectedCount === 1 ? '' : 's'} ${selectedCount === 1 ? 'vai' : 'vão'} entrar no time. Você pode ajustar cargos e pessoas depois no roster da squad.`}
        </p>
        <Button onClick={confirm} disabled={busy || blocked} className="h-11 gap-2 rounded-xl px-6 text-xs font-bold">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Importar {selectedCount} pessoa{selectedCount === 1 ? '' : 's'} <ArrowRight className="h-4 w-4" /></>}
        </Button>
      </div>
    </div>
  );
}
