'use client';

import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, Copy, Loader2, TriangleAlert, Wand2 } from 'lucide-react';
import { PageHeader, PageShell } from '@/components/page';
import { Button } from '@/components/ui/button';
import { ModalButton, StatusChip } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  MODE_DETECTION_TEXT,
  MODE_INFO,
  describeOperation,
  describeValue,
  draftFromRule,
  exampleValue,
  generateSpec,
  groupRules,
  overrideFromDraft,
  scopeLabel,
  suggestFix,
  type GeneratorOverride,
  type GeneratorResult,
  type GeneratorRule,
  type RuleDraft,
} from '@/lib/jolt-generator';
import { exampleInputText, exampleOutputText } from '@/lib/jolt-generator-example';
import { checkJson, describeProblem, formatJson } from '@/lib/jolt-json';
import {
  adoptGuestDrafts,
  clearGeradorHandoff,
  peekFromSandbox,
  readGeradorDraft,
  sendToSandbox,
  storeFailureMessage,
  writeGeradorDraft,
  type StoreFailure,
} from '@/lib/jolt-storage';
import { buildRouteRecord, defaultRouteForm, routeProblems, routeVariables, type RouteForm } from '@/lib/jolt-route-record';
import { GuestBanner, LoginRequiredDialog, Notice, useJoltIdentity } from '@/components/jolt/JoltBits';
import { JoltHowItWorks } from '@/components/jolt/JoltHowItWorks';
import { JoltNav, joltHeaderProps } from '@/components/jolt/JoltNav';
import { JsonEditor, PaneButton, SyntaxErrorStrip } from '@/components/jolt/JsonEditor';
import { RULE_GRID, RuleEditorPanel, RuleRow } from '@/components/jolt/GeradorRules';
import { RouteRecordPanel } from '@/components/jolt/RouteRecordPanel';

type Step = 'exemplos' | 'regras' | 'spec';
type Filter = 'todos' | 'pendentes' | 'calculados' | 'fixos';
type Busy = null | 'gerar' | 'aplicar' | 'spec';

const CALCULATED = ['AS_TEXT', 'AS_NUMBER', 'DIGITS', 'CONCAT', 'VALUE_MAP'];

function matchesFilter(rule: GeneratorRule, filter: Filter): boolean {
  if (filter === 'pendentes') return rule.pending;
  if (filter === 'calculados') return CALCULATED.includes(rule.kind);
  if (filter === 'fixos') return rule.kind === 'CONSTANT' || rule.kind === 'VARIABLE';
  return true;
}

const draftKey = (d: RuleDraft | undefined) => (d ? JSON.stringify(d) : '');

function Stepper({ step, onGo, reach }: { step: Step; onGo: (s: Step) => void; reach: { regras: boolean; spec: boolean } }) {
  const steps: { id: Step; label: string; sub: string; enabled: boolean }[] = [
    { id: 'exemplos', label: 'Exemplos', sub: 'Entrada e saída esperada', enabled: true },
    { id: 'regras', label: 'Regras', sub: 'Revise de onde vem cada campo', enabled: reach.regras },
    { id: 'spec', label: 'Spec e validação', sub: 'Conferida no servidor', enabled: reach.spec },
  ];
  const index = steps.findIndex((s) => s.id === step);
  return (
    <nav aria-label="Etapas" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <ol className="flex flex-wrap">
        {steps.map((s, i) => {
          const done = i < index;
          const current = i === index;
          return (
            <li key={s.id} className="min-w-[200px] flex-1">
              <button
                type="button"
                disabled={!s.enabled}
                onClick={() => onGo(s.id)}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 border-b-[3px] px-5 py-3.5 text-left transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-60',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  current ? 'border-primary' : 'border-transparent',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold',
                    done ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : current ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={1.5} /> : i + 1}
                </span>
                <span className="flex flex-col gap-px">
                  <span className="text-sm font-bold text-foreground">{s.label}</span>
                  <span className="text-xs text-muted-foreground">{s.sub}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function lineCount(text: string) {
  return text.split('\n').length;
}

export default function JoltGeneratorPage() {
  const { toast } = useToast();
  const router = useRouter();
  const id = useJoltIdentity();

  const [step, setStep] = useState<Step>('exemplos');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const [specReady, setSpecReady] = useState(false);
  /** Ajustes guardados (clique em "Guardar ajuste") e os que o servidor já aplicou. */
  const [saved, setSaved] = useState<Record<string, RuleDraft>>({});
  const [applied, setApplied] = useState<Record<string, RuleDraft>>({});
  const [editing, setEditing] = useState<{ output: string; draft: RuleDraft; error: string | null } | null>(null);
  const [filter, setFilter] = useState<Filter>('todos');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [routeForm, setRouteForm] = useState<RouteForm>(defaultRouteForm);
  const [codeTab, setCodeTab] = useState<'spec' | 'registro'>('spec');
  const [howOpen, setHowOpen] = useState(false);
  const [draftIssue, setDraftIssue] = useState<StoreFailure | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const hydratedRef = useRef(false);
  const busyRef = useRef(false);
  const requestId = useRef(0);
  const draftWarned = useRef<StoreFailure | null>(null);

  // ── Ao abrir: rascunho da pessoa e, se vier da Sandbox, a entrada que estava lá ──
  useEffect(() => {
    if (id.isLoading || hydratedRef.current) return;
    hydratedRef.current = true;
    if (id.userId) adoptGuestDrafts(id.userId);
    const draft = readGeradorDraft(id.userId);
    if (draft) {
      setInputText(draft.entrada);
      setOutputText(draft.saida);
    }
    const fromSandbox = peekFromSandbox();
    if (fromSandbox) {
      // A entrada vira rascunho logo abaixo, então a passagem pode ser apagada já.
      setInputText(fromSandbox);
      clearGeradorHandoff();
      toast({ title: 'Entrada trazida da Sandbox', description: 'Cole agora a saída que o destino espera.' });
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id.isLoading, id.userId]);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      const r = writeGeradorDraft(id.userId, { entrada: inputText, saida: outputText });
      setDraftIssue(r.ok ? null : r.reason);
    }, 500);
    return () => clearTimeout(t);
  }, [hydrated, id.userId, inputText, outputText]);

  useEffect(() => {
    if (!draftIssue || draftWarned.current === draftIssue) return;
    draftWarned.current = draftIssue;
    toast({ title: 'Rascunho não guardado', description: storeFailureMessage(draftIssue, 'o rascunho'), variant: 'destructive' });
  }, [draftIssue, toast]);

  const deferredInput = useDeferredValue(inputText);
  const deferredOutput = useDeferredValue(outputText);
  const inputCheck = useMemo(() => (deferredInput.trim() ? checkJson(deferredInput) : null), [deferredInput]);
  const outputCheck = useMemo(() => (deferredOutput.trim() ? checkJson(deferredOutput) : null), [deferredOutput]);
  const inputOk = !!inputCheck && inputCheck.ok;
  const outputOk = !!outputCheck && outputCheck.ok;
  const outputValue = outputCheck && outputCheck.ok ? outputCheck.value : undefined;

  // Mexer nos exemplos depois de gerar deixa as regras velhas para trás: volta para o começo.
  const resetResult = useCallback(() => {
    requestId.current += 1;
    busyRef.current = false;
    setBusy(null);
    setResult(null);
    setSpecReady(false);
    setSaved({});
    setApplied({});
    setEditing(null);
    setError(null);
  }, []);

  const changeInput = (value: string) => {
    setInputText(value);
    if (result) resetResult();
  };
  const changeOutput = (value: string) => {
    setOutputText(value);
    if (result) resetResult();
  };

  /** Chama o servidor. Uma chamada por vez; a resposta de uma chamada abandonada é descartada. */
  const run = async (overrides: Record<string, GeneratorOverride>, kind: Exclude<Busy, null>) => {
    if (id.isGuest) {
      id.askLogin();
      return;
    }
    if (busyRef.current) return;
    const input = checkJson(inputText);
    const output = checkJson(outputText);
    if (!input.ok || !output.ok) return;
    const mine = ++requestId.current;
    busyRef.current = true;
    setBusy(kind);
    setError(null);
    try {
      const r = await generateSpec(input.value, output.value, overrides, kind === 'spec');
      if (mine !== requestId.current) return;
      setResult(r);
      if (kind === 'gerar') {
        setSaved({});
        setApplied({});
        setSpecReady(false);
        setStep('regras');
      } else if (kind === 'aplicar') {
        setApplied({ ...saved });
        setSpecReady(false);
      } else {
        setApplied({ ...saved });
        setSpecReady(true);
        setStep('spec');
      }
      setEditing(null);
    } catch (e) {
      if (mine !== requestId.current) return;
      setError(e instanceof Error ? e.message : 'Não foi possível gerar a spec.');
    } finally {
      if (mine === requestId.current) {
        busyRef.current = false;
        setBusy(null);
      }
    }
  };

  const buildOverrides = (): Record<string, GeneratorOverride> => {
    const out: Record<string, GeneratorOverride> = {};
    for (const [field, draft] of Object.entries(saved)) {
      const o = overrideFromDraft(draft, exampleValue(outputValue, field));
      if (o) out[field] = o;
    }
    return out;
  };

  const rules = result?.rules ?? [];
  const visible = rules.filter((r) => matchesFilter(r, filter));
  const { pending, groups } = groupRules(visible);
  const pendingOpen = rules.filter((r) => r.pending && !saved[r.output]).length;
  const adjustedCount = Object.keys(saved).length;
  const dirtyCount = useMemo(() => {
    const keys = new Set([...Object.keys(saved), ...Object.keys(applied)]);
    let n = 0;
    keys.forEach((k) => {
      if (draftKey(saved[k]) !== draftKey(applied[k])) n += 1;
    });
    return n;
  }, [saved, applied]);
  const specBlocked = pendingOpen > 0 || dirtyCount > 0;
  const counts = {
    todos: rules.length,
    pendentes: rules.filter((r) => r.pending).length,
    calculados: rules.filter((r) => CALCULATED.includes(r.kind)).length,
    fixos: rules.filter((r) => r.kind === 'CONSTANT' || r.kind === 'VARIABLE').length,
  };

  const specText = result ? JSON.stringify(result.spec, null, 2) : '';
  const routeRecord = useMemo(() => (result ? buildRouteRecord(routeForm, result.spec) : null), [routeForm, result]);
  const recordText = routeRecord ? JSON.stringify(routeRecord, null, 2) : '';
  const shownText = codeTab === 'spec' ? specText : recordText;

  const openEditor = (rule: GeneratorRule) => {
    if (editing?.output === rule.output) {
      setEditing(null);
      return;
    }
    setEditing({ output: rule.output, draft: saved[rule.output] ?? draftFromRule(rule, outputValue), error: null });
  };

  const saveAdjustment = (rule: GeneratorRule) => {
    if (!editing) return;
    const o = overrideFromDraft(editing.draft, exampleValue(outputValue, rule.output));
    if (!o) {
      const message = editing.draft.kind === 'VALUE_MAP' && editing.draft.source ? 'Informe pelo menos um valor da entrada no de-para.' : 'Escolha de onde vem o campo.';
      setEditing({ ...editing, error: message });
      return;
    }
    setSaved((all) => ({ ...all, [rule.output]: editing.draft }));
    setEditing(null);
  };

  const undoAdjustment = (rule: GeneratorRule) => {
    setSaved((all) => {
      const next = { ...all };
      delete next[rule.output];
      return next;
    });
    setEditing(null);
    toast({ title: 'Ajuste desfeito' });
  };

  const renderRule = (rule: GeneratorRule) => {
    const isEditing = editing?.output === rule.output;
    return (
      <RuleRow
        key={rule.output}
        rule={rule}
        adjustedDraft={saved[rule.output]}
        editing={isEditing}
        onToggle={() => openEditor(rule)}
        panel={
          editing && isEditing ? (
            <RuleEditorPanel
              rule={rule}
              draft={editing.draft}
              sources={result?.sources[rule.scope] ?? []}
              adjusted={!!saved[rule.output]}
              error={editing.error}
              onChange={(d) => setEditing({ ...editing, draft: d, error: null })}
              onCancel={() => setEditing(null)}
              onSave={() => saveAdjustment(rule)}
              onUndo={() => undoAdjustment(rule)}
            />
          ) : null
        }
      />
    );
  };

  const copySpec = async () => {
    try {
      await navigator.clipboard.writeText(shownText);
      toast(
        codeTab === 'spec'
          ? { title: 'Spec copiada', description: 'Cole em LAYOUTTRANSFORMACAO.' }
          : { title: 'Registro da rota copiado', description: 'É o arquivo completo de PCINTEGRACAOROTASERVICO.' },
      );
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível copiar' });
    }
  };

  /** Leva a spec (ou o registro completo da rota) para a Sandbox. Se a passagem não couber no navegador, fica aqui e avisa. */
  const openSandbox = () => {
    const sendRecord = codeTab === 'registro' && !!recordText;
    const r = sendToSandbox({ spec: sendRecord ? recordText : specText, input: inputText, deManutencao: sendRecord });
    if (!r.ok) {
      toast({
        title: 'Não foi possível levar a spec para a Sandbox',
        description: `${storeFailureMessage(r.reason, 'a spec')} Use Copiar e cole na Sandbox.`,
        variant: 'destructive',
      });
      return;
    }
    router.push('/jolt/sandbox');
  };

  const pasteInto = async (set: (v: string) => void, label: string) => {
    try {
      set(await navigator.clipboard.readText());
    } catch {
      toast({ title: 'Não foi possível colar', description: `Permita o acesso à área de transferência ou cole ${label} direto no editor.`, variant: 'destructive' });
    }
  };

  const formatInto = (text: string, set: (v: string) => void, label: string) => {
    const formatted = formatJson(text);
    if (formatted === null) {
      toast({ title: `Não foi possível formatar ${label}`, description: 'Corrija o erro de sintaxe antes de formatar.', variant: 'destructive' });
      return;
    }
    set(formatted);
  };

  const useExample = () => {
    setInputText(exampleInputText());
    setOutputText(exampleOutputText());
    if (result) resetResult();
    toast({ title: 'Exemplo carregado', description: 'Um pedido de venda e a saída que o destino espera.' });
  };

  const exampleFooter = (text: string, check: ReturnType<typeof checkJson> | null, label: string) => {
    if (!text.trim()) return undefined;
    if (check && !check.ok) return <SyntaxErrorStrip text={describeProblem(`JSON da ${label} inválido`, check.problem)} />;
    if (check?.ok) {
      return (
        <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-emerald-500" />
          JSON válido · {lineCount(text)} linhas
        </div>
      );
    }
    return undefined;
  };

  const canGenerate = inputOk && outputOk && !busy;
  const validation = result?.validation;
  const reach = { regras: !!result, spec: specReady };
  const goStep = (s: Step) => {
    if ((s === 'regras' && !reach.regras) || (s === 'spec' && !reach.spec)) return;
    setStep(s);
  };

  return (
    <PageShell documentTitle="Gerador de spec" width="wide" header={joltHeaderProps(id.isGuest)}>
      <JoltNav active="gerador" />
      <PageHeader
        title="Gerador de spec"
        module="jolt"
        subtitle="Dê a entrada e a saída esperada. O portal descobre de onde vem cada campo e monta a spec."
        actions={
          <Button variant="outline" onClick={() => setHowOpen(true)} aria-label="Abrir Como funciona" className="h-10 gap-2 rounded-[10px] px-4 font-semibold">
            <BookOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Como funciona
          </Button>
        }
      />

      {id.isGuest && (
        <GuestBanner onLogin={id.askLogin}>
          <strong>Entre para gerar.</strong> A spec é conferida no servidor do portal, então gerar pede login.
        </GuestBanner>
      )}

      <Stepper step={step} onGo={goStep} reach={reach} />

      {error && (
        <Notice tone="danger" icon={TriangleAlert} role="alert">
          {error}
        </Notice>
      )}
      {draftIssue && (
        <Notice tone="warn" icon={TriangleAlert} role="status" className="text-[13px]">
          <strong>Rascunho não guardado.</strong> {storeFailureMessage(draftIssue, 'o rascunho')}
        </Notice>
      )}

      {step === 'exemplos' && (
        <section aria-label="Exemplos" className="flex flex-col gap-3.5">
          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
            <JsonEditor
              title="Entrada"
              subtitle="JSON que a API de origem (ERP) envia"
              value={inputText}
              onChange={changeInput}
              heightClassName="h-[420px] xl:h-[520px]"
              actions={
                <>
                  <PaneButton onClick={() => void pasteInto(changeInput, 'a entrada')}>Colar</PaneButton>
                  <PaneButton onClick={() => formatInto(inputText, changeInput, 'a entrada')} disabled={!inputText.trim()}>Formatar</PaneButton>
                  <PaneButton onClick={useExample}>Usar exemplo</PaneButton>
                </>
              }
              footer={exampleFooter(deferredInput, inputCheck, 'entrada')}
            />
            <JsonEditor
              title="Saída esperada"
              subtitle="JSON que a API de destino espera receber"
              value={outputText}
              onChange={changeOutput}
              heightClassName="h-[420px] xl:h-[520px]"
              actions={
                <>
                  <PaneButton onClick={() => void pasteInto(changeOutput, 'a saída')}>Colar</PaneButton>
                  <PaneButton onClick={() => formatInto(outputText, changeOutput, 'a saída')} disabled={!outputText.trim()}>Formatar</PaneButton>
                  <PaneButton onClick={useExample}>Usar exemplo</PaneButton>
                </>
              }
              footer={exampleFooter(deferredOutput, outputCheck, 'saída')}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
            <div className="flex min-w-[300px] flex-1 flex-col gap-1">
              <h2 className="text-[15px] font-bold text-foreground">Como o portal acha as origens</h2>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{MODE_DETECTION_TEXT}</p>
            </div>
            <ModalButton
              variant="primary"
              onClick={() => (id.isGuest ? id.askLogin() : void run({}, 'gerar'))}
              disabled={id.isGuest ? false : !canGenerate}
              className="h-11 gap-2 px-5"
            >
              {busy === 'gerar' ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> : <Wand2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
              {busy === 'gerar' ? 'Gerando regras…' : 'Gerar regras'}
            </ModalButton>
            {!id.isGuest && !canGenerate && !busy && (
              <p className="basis-full text-xs text-muted-foreground">Cole a entrada e a saída esperada, ambas como JSON válido, para gerar as regras.</p>
            )}
          </div>
        </section>
      )}

      {step === 'regras' && result && (
        <section aria-label="Regras" className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            {(
              [
                ['todos', 'Todos'],
                ['pendentes', 'A confirmar'],
                ['calculados', 'Calculados'],
                ['fixos', 'Fixos'],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className={cn(
                  'inline-flex h-[34px] items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors duration-fast',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  filter === key
                    ? 'border-primary/60 bg-primary/10 text-foreground dark:bg-primary/15'
                    : key === 'pendentes' && counts.pendentes > 0
                      ? 'border-transparent bg-amber-500/10 text-amber-800 dark:text-amber-300'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
                <span className="text-xs tabular-nums opacity-80">{counts[key]}</span>
              </button>
            ))}
            <span className="flex-1" />
            <span className="text-[13px] text-muted-foreground">Confira a coluna «Vem de». Só os campos em dúvida pedem ajuste.</span>
          </div>

          <p className="text-[13px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Modo detectado: {MODE_INFO[result.mode].label}.</strong> {MODE_INFO[result.mode].long}
          </p>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className={cn('hidden gap-x-4 border-b border-border bg-muted/50 px-5 py-2.5 text-xs font-bold text-muted-foreground md:grid', RULE_GRID)}>
              <span>Campo da saída</span>
              <span>Vem de</span>
              <span>Regra</span>
              <span>Exemplo</span>
              <span className="sr-only">Ação</span>
            </div>

            {pending.length > 0 && (
              <section aria-label="A confirmar">
                <h2 className="flex items-center gap-2.5 border-b border-border bg-amber-500/10 px-5 py-2.5 text-sm font-bold text-amber-900 dark:text-amber-200">
                  A confirmar
                  <span className="text-xs font-semibold text-muted-foreground">{pending.length === 1 ? '1 campo precisa' : `${pending.length} campos precisam`} da sua decisão: mais de uma origem possível, ou uma regra que o exemplo não prova sozinho</span>
                </h2>
                <ul>{pending.map(renderRule)}</ul>
              </section>
            )}

            {groups.map((g) => (
              <section key={g.scope || 'raiz'} aria-label={scopeLabel(g.scope)}>
                <h2 className="flex items-center gap-2.5 border-b border-t border-border bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground first:border-t-0">
                  {scopeLabel(g.scope)}
                  <span className="text-xs font-semibold text-muted-foreground">{g.rules.length === 1 ? '1 campo' : `${g.rules.length} campos`}</span>
                </h2>
                <ul>{g.rules.map(renderRule)}</ul>
              </section>
            ))}

            {pending.length === 0 && groups.length === 0 && (
              <p className="px-5 py-7 text-center text-sm text-muted-foreground">Nenhum campo neste filtro.</p>
            )}
          </div>

          <div
            role="region"
            aria-label="Resumo e ações"
            className="sticky bottom-3 z-10 mt-auto flex w-full flex-wrap items-center gap-x-3.5 gap-y-2.5 rounded-2xl border border-border bg-card px-4 py-3 shadow-[0_10px_28px_rgba(0,0,0,0.18)]"
          >
            <span className="text-sm font-bold text-foreground">{rules.length} campos</span>
            <StatusChip tone={pendingOpen ? 'warn' : 'success'} className="h-[26px] px-2.5 text-[13px] font-bold">{pendingOpen} a confirmar</StatusChip>
            <StatusChip tone="neutral" className="h-[26px] px-2.5 text-[13px]">{adjustedCount} ajustados</StatusChip>
            <span className="min-w-[160px] flex-1 text-[13px] text-muted-foreground">
              {pendingOpen
                ? 'Confirme os campos em «A confirmar» para gerar a spec.'
                : dirtyCount
                  ? 'Aplique os ajustes antes de gerar a spec.'
                  : 'Tudo confirmado. Pode gerar a spec.'}
            </span>
            <ModalButton onClick={() => setStep('exemplos')} className="h-10 gap-2">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Voltar aos exemplos
            </ModalButton>
            <ModalButton onClick={() => void run(buildOverrides(), 'aplicar')} disabled={dirtyCount === 0 || !!busy} className="h-10 gap-2">
              {busy === 'aplicar' && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />}
              Aplicar ajustes ({dirtyCount})
            </ModalButton>
            <ModalButton variant="primary" onClick={() => void run(buildOverrides(), 'spec')} disabled={specBlocked || !!busy} className="h-10 gap-2">
              {busy === 'spec' && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />}
              {busy === 'spec' ? 'Conferindo no servidor…' : 'Gerar spec'}
              {busy !== 'spec' && <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
            </ModalButton>
          </div>
        </section>
      )}

      {step === 'spec' && result && validation && (
        <section aria-label="Spec e validação" className="flex flex-col gap-3.5">
          {!validation.ran ? (
            <Notice
              tone="warn"
              icon={TriangleAlert}
              role="alert"
              action={<ModalButton variant="primary" onClick={openSandbox} className="h-10">Abrir na Sandbox<ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /></ModalButton>}
            >
              <strong className="text-base">A spec foi gerada, mas não foi conferida</strong>
              <p className="mt-0.5 text-sm text-muted-foreground">
                O servidor não rodou a conferência{validation.error ? `: ${validation.error}` : '.'} Abra a spec na Sandbox e execute com a sua entrada antes de usar.
              </p>
            </Notice>
          ) : validation.matches ? (
            <Notice
              tone="success"
              icon={CheckCircle2}
              role="status"
              action={<ModalButton variant="primary" onClick={openSandbox} className="h-10">Abrir na Sandbox<ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /></ModalButton>}
            >
              <strong className="text-base">{result.mode === 'CONTRATO' ? 'A spec gera a saída do contrato' : 'A spec gera a saída esperada'}</strong>
              <p className="mt-0.5 text-sm text-muted-foreground">
                O servidor rodou a spec com a sua entrada e comparou campo a campo:{' '}
                <strong className="text-foreground">
                  {validation.checkedFields} {result.mode === 'CONTRATO' ? 'campos presentes e com o tipo do contrato' : 'campos iguais'}
                </strong>
                , nenhum a mais.
                {adjustedCount > 0 && ' As origens que você escolheu foram gravadas no glossário da equipe.'}
              </p>
            </Notice>
          ) : (
            <div role="alert" className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4">
              <div className="flex flex-wrap items-center gap-3.5">
                <TriangleAlert className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" strokeWidth={1.5} aria-hidden="true" />
                <div className="flex min-w-[260px] flex-1 flex-col gap-0.5">
                  <strong className="text-base text-foreground">
                    {validation.error
                      ? 'O servidor recusou a spec'
                      : `${result.mode === 'CONTRATO' ? 'A saída gerada ainda não cumpre o contrato' : 'A spec gera'} ${validation.differences.length} ${validation.differences.length === 1 ? 'diferença' : 'diferenças'}`}
                  </strong>
                  <span className="text-sm text-muted-foreground">
                    {validation.error
                      ? validation.error
                      : `O servidor rodou a spec e comparou campo a campo (${validation.checkedFields} campos conferidos). O glossário da equipe só grava as origens quando a spec bate.`}
                  </span>
                </div>
                <ModalButton onClick={() => setStep('regras')} className="h-10">Voltar às regras</ModalButton>
                <ModalButton variant="primary" onClick={openSandbox} className="h-10">Abrir na Sandbox<ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /></ModalButton>
              </div>
              {validation.differences.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                    <thead>
                      <tr className="bg-muted/50 text-xs font-bold text-muted-foreground">
                        <th scope="col" className="px-3.5 py-2">Campo</th>
                        <th scope="col" className="px-3.5 py-2">Esperado</th>
                        <th scope="col" className="px-3.5 py-2">Obtido</th>
                        <th scope="col" className="px-3.5 py-2">Como resolver</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validation.differences.map((d) => (
                        <tr key={d.path + d.kind} className="border-t border-border align-top">
                          <td className="px-3.5 py-2.5 font-code">{d.path}</td>
                          <td className="px-3.5 py-2.5 font-code text-emerald-700 dark:text-emerald-300">{describeValue(d.expected)}</td>
                          <td className="px-3.5 py-2.5 font-code text-amber-800 dark:text-amber-300">{describeValue(d.actual)}</td>
                          <td className="px-3.5 py-2.5 text-muted-foreground">{suggestFix(d)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <p className="text-[13px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Modo detectado: {MODE_INFO[result.mode].label}.</strong> {MODE_INFO[result.mode].long}
          </p>

          <div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[320px_minmax(0,1fr)_420px]">
            <section aria-label="O que a spec faz" className="flex flex-col gap-2.5">
              <h2 className="text-[15px] font-bold text-foreground">O que a spec faz</h2>
              {result.spec.map((op, i) => {
                const d = describeOperation(op, i, result.spec.length);
                return (
                  <div key={i} className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-sm">
                    <span className="flex items-center gap-2">
                      <StatusChip tone="brand" className="font-bold">Passo {i + 1}</StatusChip>
                      <span className="font-code text-[13px] text-muted-foreground">{d.name}</span>
                    </span>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">{d.what}</p>
                  </div>
                );
              })}
            </section>

            <section aria-label="Resultado" className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pl-1.5 pr-3">
                <div role="tablist" aria-label="Resultado" className="flex gap-1">
                  {(
                    [
                      ['spec', 'Layout'],
                      ['registro', 'Registro da rota'],
                    ] as ['spec' | 'registro', string][]
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={codeTab === key}
                      onClick={() => setCodeTab(key)}
                      className={cn(
                        '-mb-px h-12 border-b-2 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                        codeTab === key ? 'border-primary font-bold text-foreground' : 'border-transparent text-muted-foreground',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="inline-flex gap-1.5">
                  <PaneButton onClick={() => void copySpec()} className="gap-1.5">
                    <Copy className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                    Copiar
                  </PaneButton>
                  <PaneButton onClick={openSandbox}>Abrir na Sandbox</PaneButton>
                </span>
              </div>
              <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
                {codeTab === 'spec'
                  ? 'Valor do campo LAYOUTTRANSFORMACAO: é o que roda a transformação.'
                  : 'Registro completo da rota, pronto para guardar no repositório de layouts.'}
              </p>
              <pre aria-label={codeTab === 'spec' ? 'Spec gerada' : 'Registro da rota'} className="max-h-[640px] min-h-[320px] overflow-auto bg-background p-4 font-code text-[13px] leading-relaxed text-foreground">
                {shownText}
              </pre>
            </section>

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
        </section>
      )}

      <JoltHowItWorks open={howOpen} onOpenChange={setHowOpen} />
      <LoginRequiredDialog open={id.loginOpen} onOpenChange={(o) => (o ? id.askLogin() : id.closeLogin())} onLogin={id.goLogin} />
    </PageShell>
  );
}
