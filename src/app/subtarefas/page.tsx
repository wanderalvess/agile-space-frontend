'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ListTree, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { PageShell } from '@/components/page/PageShell';
import { PageHeader } from '@/components/page/PageHeader';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/page/States';
import { PAGE_CARD } from '@/components/page/styles';
import { SelectField, StatusChip } from '@/components/room-kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { useCanManageTeam } from '@/components/roster/hooks/useRosterData';
import { cn } from '@/lib/utils';
import {
  renderTemplate,
  subtaskTemplatesApi,
  TEMPLATE_VARIABLES,
  type JiraIssueTypeOption,
  type SubtaskRole,
  type SubtaskTemplate,
} from '@/app/squad/subtask-templates-api';

const ANY_PARENT = '__any__';
const ROLE_OPTIONS = [
  { value: 'DEV', label: 'DEV — recebe as horas de DEV' },
  { value: 'QA', label: 'QA — recebe as horas de QA' },
  { value: 'NONE', label: 'Sem horas' },
] as const;

const DEFAULT_TITLE = '{pai} - {tipo} - {resumo}';
const SAMPLE_VARS = { pai: 'DDWMISSI-100', resumo: 'Ajuste no cálculo de ST', tipo: 'Codificação', horas: '10h', papel: 'DEV', notas: 'Trocar a regra de arredondamento' };

interface Row extends SubtaskTemplate {
  localId: string;
}

function newRow(partial?: Partial<SubtaskTemplate>): Row {
  return {
    localId: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random()),
    parentIssueType: null,
    jiraIssueTypeName: '',
    role: 'NONE',
    titleTemplate: DEFAULT_TITLE,
    commentTemplate: '',
    active: true,
    ...partial,
  };
}

/**
 * Configuração, por squad, das sub-tarefas criadas no Jira quando uma issue é refinada (Poker) ou planejada.
 * Os nomes dos tipos vêm do Jira do projeto da squad: cada projeto define os seus.
 */
export default function SubtaskTemplatesPage() {
  const { toast } = useToast();
  const { squadId, squadName } = useActiveSquad();
  const { canManageTeam, permissionLoaded } = useCanManageTeam(squadId);

  const [rows, setRows] = useState<Row[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState<JiraIssueTypeOption[] | null>(null);
  const [typesError, setTypesError] = useState<string | null>(null);
  const [typesLoading, setTypesLoading] = useState(false);

  const load = useCallback(async () => {
    if (!squadId) return;
    setPhase('loading');
    setLoadError(null);
    try {
      const list = await subtaskTemplatesApi.list(squadId);
      setRows(list.map(t => newRow(t)));
      setDirty(false);
      setPhase('ready');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Falha ao carregar.');
      setPhase('error');
    }
  }, [squadId]);

  const loadTypes = useCallback(async () => {
    if (!squadId) return;
    setTypesLoading(true);
    setTypesError(null);
    try {
      setTypes(await subtaskTemplatesApi.jiraIssueTypes(squadId));
    } catch (e) {
      setTypes(null);
      setTypesError(e instanceof Error ? e.message : 'Falha ao consultar o Jira.');
    } finally {
      setTypesLoading(false);
    }
  }, [squadId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadTypes(); }, [loadTypes]);

  const subtaskTypes = useMemo(() => (types ?? []).filter(t => t.subtask && t.name).map(t => ({ value: t.name!, label: t.name! })), [types]);
  const parentTypes = useMemo(() => (types ?? []).filter(t => !t.subtask && t.name).map(t => ({ value: t.name!, label: t.name! })), [types]);

  const update = (localId: string, patch: Partial<Row>) => {
    setRows(prev => prev.map(r => (r.localId === localId ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const move = (index: number, delta: number) => {
    setRows(prev => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
  };
  const remove = (localId: string) => {
    setRows(prev => prev.filter(r => r.localId !== localId));
    setDirty(true);
  };
  const add = () => {
    setRows(prev => [...prev, newRow({ jiraIssueTypeName: subtaskTypes[0]?.value ?? '' })]);
    setDirty(true);
  };

  const problems = useMemo(() => rows.filter(r => !r.jiraIssueTypeName.trim() || !r.titleTemplate.trim()).length, [rows]);

  const save = async () => {
    if (!squadId || problems > 0) return;
    setSaving(true);
    try {
      const saved = await subtaskTemplatesApi.replaceAll(squadId, rows.map(({ localId: _localId, ...t }, i) => ({
        ...t,
        parentIssueType: t.parentIssueType || null,
        commentTemplate: t.commentTemplate?.trim() ? t.commentTemplate : null,
        position: i,
      })));
      setRows(saved.map(t => newRow(t)));
      setDirty(false);
      toast({ title: 'Sub-tarefas salvas', description: `${saved.length} sub-tarefa(s) configurada(s) para ${squadName || squadId}.` });
    } catch (e) {
      toast({ title: 'Não foi possível salvar', description: e instanceof Error ? e.message : 'Erro inesperado.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const readOnly = !permissionLoaded || !canManageTeam;

  return (
    <PageShell documentTitle="Sub-tarefas do time">
      <PageHeader
        title="Sub-tarefas do time"
        module="subtarefas"
        subtitle="O que o time cria no Jira para cada issue refinada no Poker ou planejada: o tipo (com o nome exato do seu projeto), quem recebe as horas, e os padrões de título e comentário."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Sub-tarefas do time' }]}
        actions={!readOnly && phase === 'ready' ? (
          <>
            <Button variant="outline" onClick={add} className="gap-2"><Plus className="h-4 w-4" strokeWidth={1.5} /> Adicionar sub-tarefa</Button>
            <Button onClick={save} disabled={!dirty || saving || problems > 0} className="gap-2" title={problems > 0 ? 'Preencha tipo e título em todas as linhas' : undefined}>
              <Save className="h-4 w-4" strokeWidth={1.5} /> {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </>
        ) : undefined}
      />

      {!squadId && (
        <EmptyState icon={ListTree} title="Sem squad ativa" description="Escolha uma squad no cabeçalho para configurar as sub-tarefas dela." />
      )}

      {squadId && phase === 'loading' && <LoadingSkeleton rows={4} label="Carregando sub-tarefas" />}
      {squadId && phase === 'error' && <ErrorState title="Não foi possível carregar" description={loadError ?? undefined} onRetry={load} />}

      {squadId && phase === 'ready' && (
        <>
          <section className={cn(PAGE_CARD, 'flex flex-wrap items-center gap-3 p-4 text-sm')} aria-label="Tipos do Jira">
            <div className="min-w-0 flex-1">
              {types ? (
                <p className="text-muted-foreground">
                  <strong className="text-foreground">{subtaskTypes.length}</strong> tipo(s) de sub-tarefa e <strong className="text-foreground">{parentTypes.length}</strong> tipo(s) de issue lidos do Jira do projeto.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  {typesLoading ? 'Consultando os tipos de issue no Jira…' : `Sem a lista do Jira${typesError ? `: ${typesError}` : ''}. Dá para digitar o nome do tipo à mão.`}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={loadTypes} disabled={typesLoading} className="gap-2">
              <RefreshCw className={cn('h-3.5 w-3.5', typesLoading && 'animate-spin')} strokeWidth={1.5} /> Reler do Jira
            </Button>
          </section>

          {readOnly && permissionLoaded && (
            <p className="text-sm text-muted-foreground" role="status">Só a liderança da squad ou administradores alteram esta configuração. Você está vendo em modo leitura.</p>
          )}

          {rows.length === 0 ? (
            <EmptyState
              icon={ListTree}
              title="Nenhuma sub-tarefa configurada"
              description="Sem isso o Poker não consegue publicar no Jira. Adicione, por exemplo: Codificação (DEV), Code Review, Code Review QA e Execução de TI (QA)."
              actions={!readOnly ? <Button onClick={add} className="gap-2"><Plus className="h-4 w-4" strokeWidth={1.5} /> Adicionar sub-tarefa</Button> : undefined}
            />
          ) : (
            <ol className="flex flex-col gap-3" aria-label="Sub-tarefas configuradas">
              {rows.map((row, index) => (
                <li key={row.localId} className={cn(PAGE_CARD, 'p-4', row.active === false && 'opacity-70')}>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold tabular-nums text-muted-foreground">{index + 1}.</span>
                    <span className="text-sm font-semibold">{row.jiraIssueTypeName || 'Nova sub-tarefa'}</span>
                    {row.role !== 'NONE' && <StatusChip tone={row.role === 'DEV' ? 'brand' : 'success'}>{row.role}</StatusChip>}
                    {row.active === false && <StatusChip tone="neutral">Inativa</StatusChip>}
                    <div className="ml-auto flex items-center gap-1">
                      <label className="mr-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Switch checked={row.active !== false} onCheckedChange={(v) => update(row.localId, { active: v })} disabled={readOnly} aria-label="Ativa" /> Ativa
                      </label>
                      <Button variant="ghost" size="icon" onClick={() => move(index, -1)} disabled={readOnly || index === 0} aria-label="Subir"><ArrowUp className="h-4 w-4" strokeWidth={1.5} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => move(index, 1)} disabled={readOnly || index === rows.length - 1} aria-label="Descer"><ArrowDown className="h-4 w-4" strokeWidth={1.5} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(row.localId)} disabled={readOnly} aria-label="Remover" className="text-destructive"><Trash2 className="h-4 w-4" strokeWidth={1.5} /></Button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="Tipo de sub-tarefa no Jira" hint="Nome exato, como aparece no seu projeto.">
                      {subtaskTypes.length > 0 ? (
                        <SelectField
                          value={row.jiraIssueTypeName}
                          onChange={(v) => update(row.localId, { jiraIssueTypeName: v })}
                          options={subtaskTypes.some(o => o.value === row.jiraIssueTypeName) || !row.jiraIssueTypeName ? subtaskTypes : [{ value: row.jiraIssueTypeName, label: `${row.jiraIssueTypeName} (não encontrado no Jira)` }, ...subtaskTypes]}
                          placeholder="Escolha o tipo"
                          disabled={readOnly}
                        />
                      ) : (
                        <Input value={row.jiraIssueTypeName} onChange={(e) => update(row.localId, { jiraIssueTypeName: e.target.value })} placeholder="Ex.: Codificação" disabled={readOnly} />
                      )}
                    </Field>
                    <Field label="Aplica-se a issues pai do tipo" hint="Vazio = qualquer tipo de issue.">
                      {parentTypes.length > 0 ? (
                        <SelectField
                          value={row.parentIssueType || ANY_PARENT}
                          onChange={(v) => update(row.localId, { parentIssueType: v === ANY_PARENT ? null : v })}
                          options={[{ value: ANY_PARENT, label: 'Qualquer tipo' }, ...(row.parentIssueType && !parentTypes.some(o => o.value === row.parentIssueType) ? [{ value: row.parentIssueType, label: row.parentIssueType }] : []), ...parentTypes]}
                          disabled={readOnly}
                        />
                      ) : (
                        <Input value={row.parentIssueType ?? ''} onChange={(e) => update(row.localId, { parentIssueType: e.target.value || null })} placeholder="Qualquer tipo" disabled={readOnly} />
                      )}
                    </Field>
                    <Field label="Horas refinadas" hint="Qual estimativa do Poker vai no campo de estimativa.">
                      <SelectField value={row.role} onChange={(v) => update(row.localId, { role: v as SubtaskRole })} options={ROLE_OPTIONS} disabled={readOnly} />
                    </Field>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Field label="Padrão de título" hint={`Exemplo: ${renderTemplate(row.titleTemplate || DEFAULT_TITLE, { ...SAMPLE_VARS, tipo: row.jiraIssueTypeName || SAMPLE_VARS.tipo, papel: row.role === 'NONE' ? '' : row.role })}`}>
                      <Input value={row.titleTemplate} onChange={(e) => update(row.localId, { titleTemplate: e.target.value })} disabled={readOnly} maxLength={255} />
                    </Field>
                    <Field label="Padrão de comentário na sub-tarefa" hint="Vazio = não comenta. Use {notas} para as notas de refinamento do papel.">
                      <Textarea value={row.commentTemplate ?? ''} onChange={(e) => update(row.localId, { commentTemplate: e.target.value })} disabled={readOnly} className="min-h-[72px] text-sm" placeholder={row.role === 'NONE' ? '' : `${row.role} ({horas}): {notas}`} />
                    </Field>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <section className={cn(PAGE_CARD, 'p-4 text-sm')} aria-labelledby="vars-title">
            <h2 id="vars-title" className="mb-2 font-semibold">Variáveis dos padrões</h2>
            <ul className="grid gap-1 sm:grid-cols-2">
              {TEMPLATE_VARIABLES.map(v => (
                <li key={v.token} className="flex gap-2"><code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{v.token}</code><span className="text-muted-foreground">{v.meaning}</span></li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              No envio, o Poker renomeia a issue pai acrescentando a estimativa, por exemplo “Tarefa fazer hoje (DEV 10h / QA 12h)”, cria estas sub-tarefas na ordem acima com as horas de cada papel e publica o comentário em cada sub-tarefa. Antes de enviar, tudo pode ser revisado e ajustado por issue.
            </p>
          </section>
        </>
      )}
    </PageShell>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="truncate text-xs text-muted-foreground" title={hint}>{hint}</span>}
    </label>
  );
}
