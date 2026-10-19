'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, Loader2, Plus, Trash2, Wand2 } from 'lucide-react';
import { PageHeader, PageShell } from '@/components/page';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  EDITABLE_KINDS,
  KIND_LABEL,
  describeOperation,
  draftFromRule,
  exampleValue,
  fieldName,
  generateSpec,
  groupRules,
  overrideFromDraft,
  parseJsonText,
  scopeLabel,
  type GeneratorOverride,
  type GeneratorResult,
  type GeneratorRule,
  type RuleDraft,
} from '@/lib/jolt-generator';
import { RouteRecordPanel } from '@/components/jolt/RouteRecordPanel';
import { buildRouteRecord, defaultRouteForm, routeProblems, routeVariables, type RouteForm } from '@/lib/jolt-route-record';

type Step = 'exemplos' | 'regras' | 'spec';

/** Entrada deixada pela Sandbox ao clicar em "Gerador de spec". */
const SANDBOX_INPUT_KEY = 'jolt_generator_input';
type Filter = 'todos' | 'pendentes' | 'calculados' | 'fixos';

const KIND_TONE: Record<string, string> = {
  COPY: 'bg-muted text-foreground',
  AS_TEXT: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  AS_NUMBER: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  DIGITS: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  CONCAT: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  VALUE_MAP: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  CONSTANT: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  VARIABLE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  UNRESOLVED: 'bg-orange-500/15 text-orange-800 dark:text-orange-300',
};

function matchesFilter(rule: GeneratorRule, filter: Filter): boolean {
  if (filter === 'pendentes') return rule.pending;
  if (filter === 'calculados') return ['AS_TEXT', 'AS_NUMBER', 'DIGITS', 'CONCAT', 'VALUE_MAP'].includes(rule.kind);
  if (filter === 'fixos') return rule.kind === 'CONSTANT' || rule.kind === 'VARIABLE';
  return true;
}

function Stepper({ step, onGo, hasResult }: { step: Step; onGo: (s: Step) => void; hasResult: boolean }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'exemplos', label: 'Exemplos' },
    { id: 'regras', label: 'Regras' },
    { id: 'spec', label: 'Spec e validação' },
  ];
  const index = steps.findIndex((s) => s.id === step);
  return (
    <nav aria-label="Etapas" className="overflow-hidden rounded-2xl border border-border bg-card">
      <ol className="flex flex-wrap gap-1 px-2 md:px-4">
        {steps.map((s, i) => {
          const done = i < index;
          const current = i === index;
          const reachable = i === 0 || hasResult;
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onGo(s.id)}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2.5 border-b-[3px] px-3 py-3.5 text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  current ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                    done ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : current ? 'bg-primary text-primary-foreground' : 'border border-border',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                </span>
                {s.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function RuleEditor({
  rule,
  draft,
  sources,
  onChange,
  onCancel,
}: {
  rule: GeneratorRule;
  draft: RuleDraft;
  sources: string[];
  onChange: (d: RuleDraft) => void;
  onCancel: () => void;
}) {
  const id = rule.output.replace(/[^a-zA-Z0-9]/g, '-');
  const set = (patch: Partial<RuleDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-border bg-muted/40 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-muted-foreground" htmlFor={`${id}-kind`}>
          Regra
          <select
            id={`${id}-kind`}
            value={draft.kind}
            onChange={(e) => set({ kind: e.target.value as GeneratorOverride['kind'] })}
            className="h-10 rounded-lg border border-input bg-background px-2 text-sm font-semibold normal-case tracking-normal text-foreground"
          >
            {EDITABLE_KINDS.map((k) => (
              <option key={k} value={k}>{KIND_LABEL[k]}</option>
            ))}
          </select>
        </label>
        {draft.kind !== 'CONSTANT' ? (
          <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs font-bold uppercase tracking-wider text-muted-foreground" htmlFor={`${id}-source`}>
            Vem de
            <select
              id={`${id}-source`}
              value={draft.source}
              onChange={(e) => set({ source: e.target.value })}
              className="h-10 rounded-lg border border-input bg-background px-2 font-code text-[13px] normal-case tracking-normal text-foreground"
            >
              <option value="">— escolha o campo da entrada —</option>
              {[...rule.alternatives.filter((a) => !sources.includes(a)), ...sources].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        ) : (
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-bold uppercase tracking-wider text-muted-foreground" htmlFor={`${id}-value`}>
            Valor fixo
            <input
              id={`${id}-value`}
              value={draft.value}
              onChange={(e) => set({ value: e.target.value })}
              className="h-10 rounded-lg border border-input bg-background px-3 font-code text-[13px] normal-case tracking-normal text-foreground"
            />
          </label>
        )}
      </div>

      {draft.kind === 'VALUE_MAP' && (
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Como cada valor chega</legend>
          {draft.map.map((row, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                aria-label={`Valor da entrada ${i + 1}`}
                value={row.from}
                onChange={(e) => set({ map: draft.map.map((r, j) => (j === i ? { ...r, from: e.target.value } : r)) })}
                placeholder="valor na entrada"
                className="h-9 w-40 rounded-lg border border-input bg-background px-3 font-code text-[13px]"
              />
              <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              <input
                aria-label={`Valor na saída ${i + 1}`}
                value={row.to}
                onChange={(e) => set({ map: draft.map.map((r, j) => (j === i ? { ...r, to: e.target.value } : r)) })}
                placeholder="valor na saída"
                className="h-9 w-40 rounded-lg border border-input bg-background px-3 font-code text-[13px]"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remover linha"
                onClick={() => set({ map: draft.map.length > 1 ? draft.map.filter((_, j) => j !== i) : [{ from: '', to: '' }] })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => set({ map: [...draft.map, { from: '', to: '' }] })}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar valor
            </Button>
            <label className="flex items-center gap-2 text-[13px] text-muted-foreground" htmlFor={`${id}-otherwise`}>
              Qualquer outro
              <input
                id={`${id}-otherwise`}
                value={draft.otherwise}
                onChange={(e) => set({ otherwise: e.target.value })}
                placeholder="sem valor"
                className="h-9 w-40 rounded-lg border border-input bg-background px-3 font-code text-[13px] text-foreground"
              />
            </label>
          </div>
        </fieldset>
      )}
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Desfazer ajuste</Button>
      </div>
    </div>
  );
}

function RuleRow({
  rule,
  draft,
  sources,
  editing,
  onEdit,
  onChange,
  onCancel,
}: {
  rule: GeneratorRule;
  draft?: RuleDraft;
  sources: string[];
  editing: boolean;
  onEdit: () => void;
  onChange: (d: RuleDraft) => void;
  onCancel: () => void;
}) {
  const adjusted = !!draft;
  return (
    <li className={cn('border-b border-border/60 px-4 py-3 last:border-b-0 md:px-5', rule.pending && !adjusted && 'bg-orange-500/[0.04]')}>
      <div className="grid grid-cols-1 items-center gap-x-4 gap-y-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_120px_minmax(0,1.2fr)_auto]">
        <code className="truncate font-code text-[13px] font-semibold text-foreground" title={rule.output}>{fieldName(rule)}</code>
        <code className="truncate font-code text-[12.5px] text-muted-foreground" title={rule.source ?? ''}>
          {adjusted ? (draft.kind === 'CONSTANT' ? '—' : draft.source || '—') : rule.source ?? '—'}
        </code>
        <span className={cn('inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold', KIND_TONE[adjusted ? draft.kind : rule.kind])}>
          {KIND_LABEL[adjusted ? draft.kind : rule.kind]}
        </span>
        <span className="truncate font-code text-xs text-muted-foreground" title={rule.example ?? ''}>{rule.example ?? ''}</span>
        <div className="flex items-center justify-end gap-2">
          {adjusted && <span className="text-xs font-bold text-primary">ajustado</span>}
          {!rule.pending && !adjusted && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Confere com a saída" />}
          <Button
            type="button"
            variant={rule.pending && !adjusted ? 'default' : 'ghost'}
            size="sm"
            className="h-8 rounded-lg text-xs font-bold"
            onClick={onEdit}
            aria-expanded={editing}
            aria-label={`${editing ? 'Fechar ajuste de' : 'Ajustar'} ${fieldName(rule)}`}
          >
            {editing ? 'Fechar' : 'Ajustar'}
          </Button>
        </div>
      </div>
      {rule.pending && !adjusted && (
        <p className="mt-1 text-xs font-semibold text-orange-800 dark:text-orange-300">
          {rule.reason}
          {rule.alternatives.length > 0 && <span className="font-normal text-muted-foreground"> · também pode ser: {rule.alternatives.join(', ')}</span>}
        </p>
      )}
      {editing && draft && <RuleEditor rule={rule} draft={draft} sources={sources} onChange={onChange} onCancel={onCancel} />}
    </li>
  );
}

export default function JoltGeneratorPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [step, setStep] = useState<Step>('exemplos');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const [drafts, setDrafts] = useState<Record<string, RuleDraft>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('todos');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeForm, setRouteForm] = useState<RouteForm>(defaultRouteForm);
  const [codeTab, setCodeTab] = useState<'spec' | 'registro'>('spec');

  useEffect(() => {
    // Vindo da Sandbox: a entrada que estava lá já chega preenchida. A chave só é apagada ao gerar: a página pode
    // montar duas vezes enquanto a sessão carrega, e apagar aqui deixaria a segunda montagem vazia.
    try {
      const fromSandbox = localStorage.getItem(SANDBOX_INPUT_KEY);
      if (fromSandbox) setInputText(fromSandbox);
    } catch {
      /* sem storage */
    }
  }, []);

  const parsedInput = useMemo(() => parseJsonText(inputText), [inputText]);
  const parsedOutput = useMemo(() => parseJsonText(outputText), [outputText]);
  const outputValue = parsedOutput.ok ? parsedOutput.value : undefined;

  const run = async (overrides: Record<string, GeneratorOverride>, next: Step) => {
    if (!parsedInput.ok || !parsedOutput.ok) return;
    try {
      localStorage.removeItem(SANDBOX_INPUT_KEY);
    } catch {
      /* sem storage */
    }
    setBusy(true);
    setError(null);
    try {
      const r = await generateSpec(parsedInput.value, parsedOutput.value, overrides, next === 'spec');
      setResult(r);
      setStep(next);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível gerar a spec.');
    } finally {
      setBusy(false);
    }
  };

  const buildOverrides = (): Record<string, GeneratorOverride> => {
    const out: Record<string, GeneratorOverride> = {};
    for (const [field, draft] of Object.entries(drafts)) {
      const o = overrideFromDraft(draft, exampleValue(outputValue, field));
      if (o) out[field] = o;
    }
    return out;
  };

  const rules = result?.rules ?? [];
  const visible = rules.filter((r) => matchesFilter(r, filter));
  const { pending, groups } = groupRules(visible);
  const pendingOpen = rules.filter((r) => r.pending && !drafts[r.output]).length;
  const unresolved = rules.filter((r) => r.kind === 'UNRESOLVED').length;
  const resolved = rules.length - rules.filter((r) => r.pending).length;
  const specText = result ? JSON.stringify(result.spec, null, 2) : '';
  const routeRecord = useMemo(() => (result ? buildRouteRecord(routeForm, result.spec) : null), [routeForm, result]);
  const recordText = routeRecord ? JSON.stringify(routeRecord, null, 2) : '';
  const shownText = codeTab === 'spec' ? specText : recordText;

  const toggleEdit = (rule: GeneratorRule) => {
    if (editing === rule.output) {
      setEditing(null);
      return;
    }
    setDrafts((d) => (d[rule.output] ? d : { ...d, [rule.output]: draftFromRule(rule, outputValue) }));
    setEditing(rule.output);
  };

  const rowProps = (rule: GeneratorRule) => ({
    rule,
    draft: drafts[rule.output],
    sources: result?.sources[rule.scope] ?? [],
    editing: editing === rule.output,
    onEdit: () => toggleEdit(rule),
    onChange: (d: RuleDraft) => setDrafts((all) => ({ ...all, [rule.output]: d })),
    onCancel: () => {
      setDrafts((all) => {
        const next = { ...all };
        delete next[rule.output];
        return next;
      });
      setEditing(null);
    },
  });

  const copySpec = async () => {
    try {
      await navigator.clipboard.writeText(shownText);
      toast(codeTab === 'spec'
        ? { title: 'Spec copiada', description: 'Cole em LAYOUTTRANSFORMACAO.' }
        : { title: 'Registro da rota copiado', description: 'É o arquivo completo de PCINTEGRACAOROTASERVICO.' });
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível copiar' });
    }
  };

  const openSandbox = () => {
    try {
      localStorage.setItem('jolt_visual_generated_spec', specText);
      localStorage.setItem('jolt_visual_input_json', inputText);
    } catch {
      /* sem storage: abre a Sandbox vazia */
    }
    router.push('/jolt/sandbox');
  };

  return (
    <PageShell documentTitle="Gerador de spec" width="wide" contentClassName={result && step === 'regras' ? 'pb-32' : undefined}>
      <PageHeader
        title="Gerador de spec"
        module="jolt"
        breadcrumb={[{ label: 'Jolt', href: '/jolt' }, { label: 'Gerador de spec' }]}
        subtitle="Cole os exemplos de entrada e de saída e o gerador monta a spec Jolt."
      />
      <Stepper step={step} onGo={setStep} hasResult={!!result} />

      <div className="w-full">
        {error && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {step === 'exemplos' && (
          <section aria-labelledby="exemplos-titulo" className="space-y-4">
            <div>
              <h2 id="exemplos-titulo" className="text-xl font-bold tracking-tight">Do exemplo à spec</h2>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Cole a resposta da API de origem e a saída que a API de destino espera. O gerador descobre de onde vem cada campo e monta a spec Jolt. Você só confirma o que for ambíguo.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {[
                { id: 'entrada', label: 'Entrada · API de origem', hint: 'Resposta real, com um ou poucos registros.', text: inputText, set: setInputText, parsed: parsedInput },
                { id: 'saida', label: 'Saída esperada · API de destino', hint: 'Melhor com os valores do mesmo registro da entrada. Valores do contrato ("string", 0) também servem.', text: outputText, set: setOutputText, parsed: parsedOutput },
              ].map((box) => (
                <div key={box.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
                  <label htmlFor={box.id} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{box.label}</label>
                  <p className="text-xs text-muted-foreground">{box.hint}</p>
                  <textarea
                    id={box.id}
                    value={box.text}
                    onChange={(e) => box.set(e.target.value)}
                    spellCheck={false}
                    rows={18}
                    className="min-h-[320px] w-full resize-y rounded-xl border border-input bg-background p-3 font-code text-[12.5px] leading-relaxed text-foreground"
                    placeholder='{ "items": [ ... ] }'
                  />
                  {box.text.trim() && !box.parsed.ok && (
                    <p role="alert" className="text-xs font-semibold text-destructive">{box.parsed.error}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={!parsedInput.ok || !parsedOutput.ok || busy}
                onClick={() => {
                  setDrafts({});
                  void run({}, 'regras');
                }}
                className="h-11 rounded-xl px-6 text-sm font-extrabold"
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />} Gerar regras
              </Button>
            </div>
          </section>
        )}

        {step === 'regras' && result && (
          <section aria-labelledby="regras-titulo" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 id="regras-titulo" className="font-headline text-2xl font-bold tracking-tight">Como cada campo da saída é montado</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.mode === 'CONTRATO'
                    ? 'A saída é o exemplo do contrato, sem valores: cada origem foi sugerida pelo nome do campo e a regra pelo tipo. Confirme ou escolha o que está em laranja.'
                    : 'Inferido comparando a entrada com a saída. Confirme ou ajuste o que está em laranja.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-extrabold">
                <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-800 dark:text-emerald-300">{resolved} resolvidos</span>
                <span className="rounded-full bg-orange-500/15 px-3 py-1.5 text-orange-900 dark:text-orange-300">{pendingOpen} a confirmar</span>
                <span className="rounded-full bg-muted px-3 py-1.5 text-foreground">{unresolved} sem origem</span>
              </div>
            </div>

            <div role="group" aria-label="Filtro" className="inline-flex flex-wrap gap-1 rounded-xl bg-muted p-1">
              {([
                ['todos', `Todos (${rules.length})`],
                ['pendentes', 'A confirmar'],
                ['calculados', 'Calculados'],
                ['fixos', 'Fixos e variáveis'],
              ] as [Filter, string][]).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                  className={cn('h-9 rounded-lg px-3.5 text-xs font-bold', filter === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                >
                  {label}
                </button>
              ))}
            </div>

            {pending.length > 0 && (
              <section className="overflow-hidden rounded-2xl border-[1.5px] border-orange-300 bg-card dark:border-orange-500/40">
                <h2 className="flex items-center gap-2 border-b border-orange-200 bg-orange-500/[0.06] px-5 py-3 text-[15px] font-extrabold dark:border-orange-500/30">
                  <AlertCircle className="h-4 w-4 text-primary" aria-hidden /> A confirmar
                  <span className="text-[13px] font-medium text-muted-foreground">mais de uma origem possível, ou regra que o exemplo não prova sozinho</span>
                </h2>
                <ul>
                  {pending.map((r) => (
                    <RuleRow key={r.output} {...rowProps(r)} />
                  ))}
                </ul>
              </section>
            )}

            {groups.map((g) => (
              <section key={g.scope} className="overflow-hidden rounded-2xl border border-border bg-card">
                <h2 className="border-b border-border px-5 py-3 text-[15px] font-extrabold">
                  {scopeLabel(g.scope)} <span className="text-[13px] font-medium text-muted-foreground">· {g.rules.length} campos</span>
                </h2>
                <ul>
                  {g.rules.map((r) => (
                    <RuleRow key={r.output} {...rowProps(r)} />
                  ))}
                </ul>
              </section>
            ))}
          </section>
        )}

        {step === 'spec' && result && (
          <section aria-labelledby="spec-titulo" className="space-y-4">
            {result.validation.matches ? (
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border-[1.5px] border-emerald-300 bg-card p-5 dark:border-emerald-500/40">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden />
                <div>
                  <h1 id="spec-titulo" className="text-xl font-extrabold">
                    {result.mode === 'CONTRATO' ? 'A saída gerada cumpre o contrato' : 'A saída gerada bate com a esperada'}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    A spec foi rodada no motor Java com a sua entrada:{' '}
                    <strong className="text-foreground">
                      {result.validation.checkedFields} {result.mode === 'CONTRATO' ? 'campos presentes e com o tipo do contrato' : 'campos iguais'}
                    </strong>
                    , nenhum a mais.
                  </p>
                  {Object.keys(drafts).length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      As origens que você escolheu entraram no glossário da equipe: na próxima rota, esses campos já vêm ligados.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border-[1.5px] border-orange-300 bg-card p-5 dark:border-orange-500/40">
                <h1 id="spec-titulo" className="text-xl font-extrabold">
                  {result.mode === 'CONTRATO' ? 'A saída gerada ainda não cumpre o contrato' : 'A saída gerada ainda não bate'}
                </h1>
                {result.validation.error ? (
                  <p className="mt-1 text-sm text-destructive">O motor recusou a spec: {result.validation.error}</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {result.validation.differences.map((d) => (
                      <li key={d.path + d.kind} className="font-code text-[12.5px]">
                        <strong>{d.path}</strong> · {d.kind}: esperado {JSON.stringify(d.expected)}, gerado {JSON.stringify(d.actual)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {result.spec.map((op, i) => {
                const d = describeOperation(op, i, result.spec.length);
                return (
                  <div key={i} className="rounded-xl border border-border bg-card p-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Passo {i + 1}</span>
                    <code className="mt-1 block font-code text-[13px] font-semibold">{d.name}</code>
                    <p className="mt-1 text-[13px] text-muted-foreground">{d.what}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-start gap-4">
              <section className="min-w-0 flex-[999_1_560px] overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                  <div role="tablist" aria-label="Formato" className="inline-flex gap-1 rounded-lg bg-muted p-1">
                    {([
                      ['spec', 'LAYOUTTRANSFORMACAO'],
                      ['registro', 'Registro completo da rota'],
                    ] as ['spec' | 'registro', string][]).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={codeTab === id}
                        onClick={() => setCodeTab(id)}
                        className={cn('h-8 rounded-md px-3 font-code text-xs', codeTab === id ? 'bg-background font-semibold text-foreground shadow-sm' : 'text-muted-foreground')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={copySpec}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar
                    </Button>
                    <Button type="button" size="sm" onClick={openSandbox}>Abrir na Sandbox</Button>
                  </div>
                </div>
                <pre className="max-h-[640px] overflow-auto bg-card p-4 font-code text-xs leading-relaxed text-foreground">{shownText}</pre>
              </section>
              <div className="min-w-0 flex-[1_1_320px] lg:max-w-[440px]">
                <RouteRecordPanel
                  form={routeForm}
                  onChange={setRouteForm}
                  variables={routeRecord ? routeVariables(routeRecord) : []}
                  problems={routeProblems(routeForm)}
                  onLoadedSpec={() => {
                    setCodeTab('registro');
                    toast({ title: 'Registro carregado', description: 'Serviço, requisição e flags vieram do registro; a spec é a gerada aqui.' });
                  }}
                />
              </div>
            </div>
          </section>
        )}
      </div>

      {result && step === 'regras' && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 shadow-[0_-6px_24px_rgba(0,0,0,0.06)] backdrop-blur md:px-8">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <strong>{rules.length} campos</strong> · <span className="font-bold text-orange-800 dark:text-orange-300">{pendingOpen} a confirmar</span>
              {Object.keys(drafts).length > 0 && <> · {Object.keys(drafts).length} ajustado(s)</>}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setStep('exemplos')}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Exemplos
              </Button>
              {Object.keys(drafts).length > 0 && (
                <Button type="button" variant="outline" disabled={busy} onClick={() => void run(buildOverrides(), 'regras')}>
                  {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Aplicar ajustes
                </Button>
              )}
              <Button type="button" disabled={busy} onClick={() => void run(buildOverrides(), 'spec')}>
                Gerar spec <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
