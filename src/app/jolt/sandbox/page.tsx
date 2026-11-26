'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, ChevronDown, Copy, Download, Github, Layers, Loader2, Lock, Play, Save, TriangleAlert, Wand2, Wrench } from 'lucide-react';
import { PageShell } from '@/components/page';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ConfirmDialog, Kbd, Modal, ModalButton, SelectField, StatusChip } from '@/components/room-kit';
import { FOCUS_RING } from '@/components/room-kit/tokens';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { transformJoltBackend } from '@/services/joltService';
import { checkJson, describeProblem, formatJson, tryFixJson } from '@/lib/jolt-json';
import { SHORTCUT_LABEL } from '@/lib/jolt-shortcuts';
import { parseLayoutData, parseLayoutText } from '@/lib/jolt-maintenance';
import { routeFormFromRecord } from '@/lib/jolt-route-record';
import {
  adoptGuestDrafts,
  readSandboxDraft,
  sendToGerador,
  storeFailureMessage,
  takeFromGerador,
  writeSandboxDraft,
  type SavedLayout,
  type StoreFailure,
} from '@/lib/jolt-storage';
import { createLayout, deleteLayout as deleteLayoutApi, importLocalLayouts, listLayouts, updateLayout } from '@/lib/jolt-layouts-api';
import { MODEL_MENU, buildFullLayout, layoutSnapshot, modelSpecText, safeFileName, type ModelName } from '@/lib/jolt-sandbox';
import { GithubIntegrationBar } from '@/components/jolt/GithubIntegrationBar';
import { useGithubLayouts, type LoadedGithubLayout } from '@/components/jolt/useGithubLayouts';
import { GuestBanner, LoginRequiredDialog, useJoltIdentity } from '@/components/jolt/JoltBits';
import { JoltHowItWorks } from '@/components/jolt/JoltHowItWorks';
import { JoltMaintenancePanel } from '@/components/jolt/JoltMaintenancePanel';
import { JoltNav, joltHeaderProps } from '@/components/jolt/JoltNav';
import { JsonEditor, PaneButton, SyntaxErrorStrip } from '@/components/jolt/JsonEditor';
import { LayoutDetails, NEW_LAYOUT_VALUE } from '@/components/jolt/LayoutCard';
import { useJoltShortcuts } from '@/components/jolt/useJoltShortcuts';

type RunState = 'idle' | 'running' | 'ok' | 'err';
type Pane = 'entrada' | 'spec' | 'saida';
const PANE_LABEL: Record<Pane, string> = { entrada: 'Entrada', spec: 'Spec', saida: 'Saída' };

const kbdOnPrimary = 'inline-flex h-5 items-center rounded-md bg-primary-foreground/20 px-1.5 text-xs font-semibold text-current';

export default function JoltSandboxPage() {
  const router = useRouter();
  const id = useJoltIdentity();
  const { toast } = useToast();

  const [hydrated, setHydrated] = useState(false);
  const [inputText, setInputText] = useState('');
  const [specText, setSpecText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadedDocument, setLoadedDocument] = useState<unknown | null>(null);
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([]);
  const [snapshot, setSnapshot] = useState(() => layoutSnapshot({ name: '', url: '', spec: '', input: '' }));
  const [justSaved, setJustSaved] = useState(false);
  const [draftIssue, setDraftIssue] = useState<StoreFailure | null>(null);
  const [layoutsStatus, setLayoutsStatus] = useState<'loading' | 'ok' | 'erro'>('loading');
  const [saving, setSaving] = useState(false);
  const [pane, setPane] = useState<Pane>('entrada'); // janela estreita: uma bancada por vez
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);
  const savingRef = useRef(false);

  const [run, setRun] = useState<RunState>('idle');
  const [runError, setRunError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  const [howOpen, setHowOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);
  const [pendingModel, setPendingModel] = useState<ModelName | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<{ id: string | null } | null>(null);

  // Execução: um clique por vez, e a resposta de uma execução abandonada (troca de layout...) é jogada fora.
  const runId = useRef(0);
  const runningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const draftWarned = useRef<StoreFailure | null>(null);
  const hydratedRef = useRef(false);

  const github = useGithubLayouts({
    onLayoutLoaded: (layout: LoadedGithubLayout) => handleGithubLayoutLoaded(layout),
    onNotify: (n) => toast(n),
  });

  const invalidateRun = useCallback(() => {
    runId.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    runningRef.current = false;
    setRun((r) => (r === 'running' ? 'idle' : r));
  }, []);

  const currentSnapshot = layoutSnapshot({ name, url, spec: specText, input: inputText });
  const hasContent = !!(specText.trim() || inputText.trim() || name.trim() || url.trim());
  const dirty = currentSnapshot !== snapshot;

  // Mexer em qualquer campo tira o "Salvo agora".
  useEffect(() => {
    setJustSaved(false);
  }, [currentSnapshot]);

  // ── Ao abrir: o que o Gerador deixou, o layout pedido pelo Hub ou o rascunho da pessoa ──
  // Os layouts vêm do servidor; só depois de chegarem (ou falharem) a tela é "hidratada" e o rascunho passa a ser gravado.
  useEffect(() => {
    if (id.isLoading || hydratedRef.current) return;
    hydratedRef.current = true; // o modo estrito monta duas vezes: o que o Gerador deixou só pode ser lido uma
    if (id.userId) adoptGuestDrafts(id.userId);

    const fromGerador = takeFromGerador();
    const wanted = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('layout');

    const restoreDraft = () => {
      const draft = readSandboxDraft(id.userId);
      if (draft && (draft.entrada || draft.spec || draft.saida || draft.nome || draft.url)) {
        setInputText(draft.entrada);
        setSpecText(draft.spec);
        setOutputText(draft.saida);
        setName(draft.nome);
        setUrl(draft.url);
        setLoadedDocument(draft.documento ?? null);
        if (draft.saida) setRun('ok');
        toast({ title: 'Rascunho recuperado', description: 'Entrada, spec e última saída voltaram como você deixou neste navegador.' });
      }
    };

    if (fromGerador) {
      // Vindo do modo manutenção: o editor mostra a transformação e o arquivo completo fica guardado para exportar.
      const parsed = fromGerador.deManutencao ? parseLayoutText(fromGerador.spec) : null;
      if (parsed?.ok && parsed.parts.kind === 'envelope') {
        setLoadedDocument(JSON.parse(fromGerador.spec));
        setSpecText(JSON.stringify(parsed.parts.spec, null, 2));
      } else {
        setSpecText(fromGerador.spec);
      }
      if (fromGerador.input) setInputText(fromGerador.input);
      toast({ title: 'Spec carregada', description: 'A especificação gerada foi colocada no editor.' });
    } else if (!wanted) {
      restoreDraft();
    }

    const userId = id.userId;
    if (!userId) {
      setLayoutsStatus('ok');
      setHydrated(true);
      return;
    }
    void (async () => {
      try {
        const imported = await importLocalLayouts(userId);
        const layouts = await listLayouts(userId);
        setSavedLayouts(layouts);
        setLayoutsStatus('ok');
        if (imported > 0) {
          toast({ title: 'Layouts guardados no servidor', description: `${imported} ${imported === 1 ? 'layout que estava' : 'layouts que estavam'} só neste navegador ${imported === 1 ? 'foi enviado' : 'foram enviados'} para a sua conta.` });
        }
        if (!fromGerador && wanted) {
          const wantedLayout = layouts.find((l) => l.id === wanted);
          if (wantedLayout) {
            setSelectedId(wantedLayout.id);
            setName(wantedLayout.name || '');
            setUrl(wantedLayout.apiUrl || '');
            setSpecText(wantedLayout.joltSpec || '');
            setInputText(wantedLayout.lastInput || '');
            setSnapshot(layoutSnapshot({ name: wantedLayout.name || '', url: wantedLayout.apiUrl || '', spec: wantedLayout.joltSpec || '', input: wantedLayout.lastInput || '' }));
          } else {
            restoreDraft();
          }
        }
      } catch (e) {
        setLayoutsStatus('erro');
        toast({ title: 'Não foi possível carregar os seus layouts', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
        if (!fromGerador && wanted) restoreDraft();
      } finally {
        setHydrated(true);
      }
    })();
    // Só na primeira vez que a identidade fica pronta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id.isLoading, id.userId]);

  // ── Rascunho: entrada, spec e última saída sobrevivem ao recarregar ──
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      const r = writeSandboxDraft(id.userId, {
        entrada: inputText, spec: specText, saida: outputText, nome: name, url, documento: loadedDocument ?? undefined,
      });
      setDraftIssue(r.ok ? null : r.reason);
    }, 500);
    return () => clearTimeout(t);
  }, [hydrated, id.userId, inputText, specText, outputText, name, url, loadedDocument]);

  useEffect(() => {
    if (!draftIssue || draftWarned.current === draftIssue) return;
    draftWarned.current = draftIssue;
    toast({ title: 'Rascunho não guardado', description: storeFailureMessage(draftIssue, 'o rascunho'), variant: 'destructive' });
  }, [draftIssue, toast]);

  // Registro de rota inteiro colado na spec: nome e URL vêm dele (ID/SERVICO e LAYOUTCOMUNICACAO), só se estiverem
  // vazios. Nunca da entrada: lá "name" é dado do registro (ex.: nome do cliente), não o nome do layout.
  useEffect(() => {
    if (!specText.includes('"tabela"')) return;
    let record: unknown;
    try {
      record = JSON.parse(specText);
    } catch {
      return;
    }
    const route = routeFormFromRecord(record);
    if (!route.ok) return;
    const recognizedName = (route.form.id || route.form.servico || route.form.nomeComunicacao).trim();
    const recognizedUrl = route.form.url.trim();
    const fillName = !!recognizedName && !name.trim();
    const fillUrl = !!recognizedUrl && !url.trim();
    if (fillName) setName(recognizedName);
    if (fillUrl) setUrl(recognizedUrl);
    if (fillName || fillUrl) toast({ title: 'Registro de rota reconhecido', description: 'Nome e URL preenchidos a partir do registro.' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specText]);

  function handleGithubLayoutLoaded(layout: LoadedGithubLayout) {
    const parsed = parseLayoutData(layout.document);
    // Layout completo: o editor mostra a LAYOUTTRANSFORMACAO; outro formato vai inteiro.
    const specValue = parsed.ok ? parsed.parts.spec : layout.document;
    invalidateRun();
    setGithubOpen(false);
    setSpecText(JSON.stringify(specValue, null, 2));
    setLoadedDocument(parsed.ok && parsed.parts.kind === 'envelope' ? layout.document : null);
    setSelectedId(null);
    setName(layout.title);
    const route = routeFormFromRecord(layout.document);
    if (route.ok && route.form.url.trim()) setUrl(route.form.url.trim());
    toast({ title: 'Layout carregado', description: `"${layout.title}" na versão ${layout.tag}.` });
  }

  // ── Validação do JSON digitado (com atraso para não travar a digitação em arquivos grandes) ──
  const deferredInput = useDeferredValue(inputText);
  const deferredSpec = useDeferredValue(specText);
  const inputCheck = useMemo(() => (deferredInput.trim() ? checkJson(deferredInput) : null), [deferredInput]);
  const specCheck = useMemo(() => (deferredSpec.trim() ? checkJson(deferredSpec) : null), [deferredSpec]);
  const specFix = useMemo(() => (specCheck && !specCheck.ok ? tryFixJson(deferredSpec) : null), [specCheck, deferredSpec]);
  const inputFix = useMemo(() => (inputCheck && !inputCheck.ok ? tryFixJson(deferredInput) : null), [inputCheck, deferredInput]);

  // ── Ações ──
  const copy = async (text: string, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copiado', description: `${label} copiado.` });
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  const paste = async (setter: (v: string) => void, label: string) => {
    try {
      setter(await navigator.clipboard.readText());
      toast({ title: 'Colado', description: `${label} atualizada pela área de transferência.` });
    } catch {
      toast({ title: 'Não foi possível colar', description: 'Permita o acesso à área de transferência ou cole direto no editor.', variant: 'destructive' });
    }
  };

  const format = (text: string, setter: (v: string) => void, label: string) => {
    if (!text.trim()) return;
    const formatted = formatJson(text);
    if (formatted === null) {
      const c = checkJson(text);
      toast({ title: `Não foi possível formatar ${label}`, description: c.ok ? undefined : describeProblem('Erro de sintaxe', c.problem), variant: 'destructive' });
      return;
    }
    setter(formatted);
    toast({ title: `${label[0].toUpperCase()}${label.slice(1)} formatada` });
  };

  const executar = async () => {
    if (id.isGuest) {
      id.askLogin();
      return;
    }
    if (runningRef.current) return; // clique em sequência: já está executando
    if (!inputText.trim() || !specText.trim()) {
      toast({ title: 'Falta conteúdo', description: !inputText.trim() ? 'Cole o JSON de entrada para executar.' : 'Escreva ou cole a spec Jolt para executar.', variant: 'destructive' });
      return;
    }
    const parsedInput = checkJson(inputText);
    const syntaxFailure = (which: string, line: number) => {
      setRunError(`${which} tem um erro de sintaxe${line > 0 ? ` na linha ${line}` : ''}. Corrija e execute de novo.`);
      setRun('err');
    };
    if (!parsedInput.ok) {
      syntaxFailure('A entrada', parsedInput.problem.line);
      return;
    }
    const parsedSpec = checkJson(specText);
    if (!parsedSpec.ok) {
      syntaxFailure('A spec', parsedSpec.problem.line);
      return;
    }

    const myRun = ++runId.current;
    const controller = new AbortController();
    abortRef.current = controller;
    runningRef.current = true;
    setRun('running');
    setRunError(null);
    setPane('saida');
    try {
      const result = await transformJoltBackend(parsedInput.value, parsedSpec.value, controller.signal);
      if (myRun !== runId.current) return; // resposta atrasada de uma execução abandonada
      if (!result.success) {
        setRunError(result.error || 'O servidor não conseguiu executar esta spec.');
        setRun('err');
        return;
      }
      setOutputText(JSON.stringify(result.output, null, 2));
      setElapsedMs(result.executionTimeMs ?? null);
      setRun('ok');
    } catch (e) {
      if (myRun !== runId.current || (e instanceof DOMException && e.name === 'AbortError')) return;
      setRunError(e instanceof Error ? e.message : 'Não foi possível executar.');
      setRun('err');
    } finally {
      if (myRun === runId.current) {
        runningRef.current = false;
        abortRef.current = null;
      }
    }
  };

  /** Salva (ou atualiza) o layout atual no servidor. Devolve true se gravou. */
  const salvar = async (): Promise<boolean> => {
    if (id.isGuest) {
      id.askLogin();
      return false;
    }
    if (!name.trim()) {
      toast({ title: 'Dê um nome ao layout', description: 'Preencha o nome do layout para salvar.', variant: 'destructive' });
      setDetailsOpen(true);
      setTimeout(() => document.getElementById('jolt-layout-nome')?.focus(), 50);
      return false;
    }
    if (savingRef.current) return false; // clique ou atalho em sequência: já está salvando
    savingRef.current = true;
    setSaving(true);
    const input = { name: name.trim(), apiUrl: url.trim(), joltSpec: specText, lastInput: inputText };
    const snapshotAtClick = currentSnapshot;
    const current = selectedId ? savedLayouts.find((l) => l.id === selectedId) : undefined;
    try {
      const saved = current ? await updateLayout(current.id, input, current.version) : await createLayout(input);
      setSavedLayouts((prev) => (current ? prev.map((l) => (l.id === saved.id ? saved : l)) : [...prev, saved]));
      setSelectedId(saved.id);
      setSnapshot(snapshotAtClick);
      setJustSaved(true);
      toast({ title: current ? 'Layout atualizado' : 'Layout salvo' });
      return true;
    } catch (e) {
      toast({ title: 'Não foi possível salvar o layout', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const applyLayout = (layout: SavedLayout | null) => {
    invalidateRun();
    setRun('idle');
    setRunError(null);
    setOutputText('');
    setElapsedMs(null);
    setLoadedDocument(null);
    setSelectedId(layout?.id ?? null);
    setName(layout?.name || '');
    setUrl(layout?.apiUrl || '');
    setSpecText(layout?.joltSpec || '');
    setInputText(layout?.lastInput || '');
    setSnapshot(layoutSnapshot({ name: layout?.name || '', url: layout?.apiUrl || '', spec: layout?.joltSpec || '', input: layout?.lastInput || '' }));
    toast({ title: layout ? 'Layout carregado' : 'Novo layout em branco' });
  };

  const requestSwitch = (target: string | null) => {
    if (target === selectedId) return;
    if (dirty && hasContent) {
      setPendingSwitch({ id: target });
      return;
    }
    applyLayout(target ? savedLayouts.find((l) => l.id === target) ?? null : null);
  };

  const deleteLayout = async () => {
    if (!selectedId) return;
    try {
      await deleteLayoutApi(selectedId);
    } catch (e) {
      toast({ title: 'Não foi possível excluir o layout', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
      return;
    }
    setSavedLayouts((prev) => prev.filter((l) => l.id !== selectedId));
    setSelectedId(null);
    setSnapshot('');
    toast({ title: 'Layout excluído', description: 'A spec e a entrada continuam no editor.' });
  };

  const chooseModel = (model: ModelName) => {
    if (!specText.trim()) {
      setSpecText(modelSpecText(model));
      setLoadedDocument(null);
      toast({ title: 'Modelo inserido', description: `Modelo «${model}» no editor de spec.` });
      return;
    }
    setPendingModel(model);
  };

  const applyModel = (model: ModelName, savedFirst: boolean) => {
    setSpecText(modelSpecText(model));
    setLoadedDocument(null);
    setPendingModel(null);
    toast({ title: savedFirst ? 'Layout salvo e spec trocada' : 'Spec trocada', description: `Modelo «${model}» no editor de spec.` });
  };

  const copyFullLayout = async () => {
    const full = buildFullLayout(specText, loadedDocument);
    if (!full.ok) {
      toast({ title: full.title, description: full.description, variant: 'destructive' });
      return;
    }
    await copy(full.text, 'Layout completo');
  };

  const downloadFullLayout = () => {
    const full = buildFullLayout(specText, loadedDocument);
    if (!full.ok) {
      toast({ title: full.title, description: full.description, variant: 'destructive' });
      return;
    }
    const href = URL.createObjectURL(new Blob([full.text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = href;
    a.download = `${safeFileName(name)}.json`;
    a.click();
    URL.revokeObjectURL(href);
  };

  // Leva a entrada atual para o Gerador de spec; lá a pessoa cola a saída esperada e o gerador monta a spec.
  const openInGenerator = () => {
    if (!inputText.trim()) {
      toast({ title: 'Entrada vazia', description: 'Preencha o JSON de entrada para levar ao Gerador de spec.', variant: 'destructive' });
      return;
    }
    const r = sendToGerador(inputText);
    if (!r.ok) {
      toast({ title: 'A entrada não foi levada ao Gerador', description: `${storeFailureMessage(r.reason, 'a entrada')} No Gerador, cole a entrada de novo.`, variant: 'destructive' });
    }
    router.push('/jolt/gerador');
  };

  // Manutenção do layout: o painel devolve o texto novo da spec; se já havia resultado na tela, roda de novo.
  const onMaintenanceChange = (newSpecText: string, message: string) => {
    setSpecText(newSpecText);
    toast({ title: 'Layout atualizado', description: message });
  };

  useJoltShortcuts({ executar: () => void executar(), salvar: () => void salvar() });

  // ── Estado do botão Salvar ──
  const saveNote = justSaved
    ? { dot: 'bg-emerald-500', text: 'Salvo agora' }
    : dirty && hasContent
      ? { dot: 'bg-amber-500', text: 'Alterações não salvas' }
      : selectedId
        ? { dot: 'bg-emerald-500', text: 'Layout salvo' }
        : { dot: 'bg-muted-foreground', text: 'Nada para salvar' };

  const outputIsEmpty = run === 'ok' && (outputText.trim() === 'null' || outputText.trim() === '{}' || outputText.trim() === '[]');
  const running = run === 'running';

  const outputOverlay =
    id.isGuest ? (
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-6 text-center text-sm text-muted-foreground">
        <Lock className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
        <strong className="text-foreground">Entre para executar</strong>
        <span>A transformação roda no servidor do portal e pede login.</span>
        <ModalButton variant="primary" onClick={id.askLogin} className="h-10">Entrar</ModalButton>
      </div>
    ) : run === 'idle' || (run === 'ok' && !outputText) ? (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
        <Play className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
        <span>Aperte Executar ou <Kbd>{SHORTCUT_LABEL.executar}</Kbd> para ver a saída.</span>
      </div>
    ) : running ? (
      <div role="status" className="flex flex-1 flex-col gap-2.5 px-4 py-5">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          Executando…
        </span>
        {['70%', '55%', '80%'].map((w) => (
          <span key={w} aria-hidden="true" style={{ width: w }} className="h-3.5 rounded-md bg-muted motion-safe:animate-pulse" />
        ))}
      </div>
    ) : run === 'err' ? (
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm">
        <TriangleAlert className="h-6 w-6 text-red-600 dark:text-red-300" strokeWidth={1.5} aria-hidden="true" />
        <strong className="text-foreground">Não executou</strong>
        <span className="max-w-md text-muted-foreground">{runError}</span>
      </div>
    ) : null;

  const layoutOptions = [
    { value: NEW_LAYOUT_VALUE, label: 'Novo layout em branco' },
    ...[...savedLayouts].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((l) => ({ value: l.id, label: l.name || 'Layout sem nome' })),
  ];

  // A bancada acompanha a altura da janela: sem rolar a página para achar o Executar nem a Saída.
  const editorHeight = 'h-[calc(100dvh-19rem)] min-h-[420px] lg:h-[calc(100dvh-17rem)] lg:min-h-[480px]';
  const paneClass = (which: Pane) => (pane === which ? undefined : 'max-lg:hidden');

  const barButton = 'h-10 gap-2 max-sm:h-11';

  return (
    <PageShell documentTitle="Sandbox" width="wide" header={joltHeaderProps(id.isGuest)} contentClassName="gap-3 pb-6 pt-4 sm:pt-4">
      <h1 className="sr-only">Sandbox</h1>
      <JoltNav
        active="sandbox"
        actions={
          <>
            <Button variant="outline" onClick={openInGenerator} className="h-9 gap-2 rounded-[10px] px-3 font-semibold max-sm:h-11" title="Leva o JSON de entrada para o Gerador: cole a saída esperada e a spec é montada para você">
              <Wand2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              <span className="max-md:sr-only">Abrir no Gerador</span>
            </Button>
            <Button variant="outline" onClick={() => setHowOpen(true)} aria-label="Abrir Como funciona" className="h-9 gap-2 rounded-[10px] px-3 font-semibold max-sm:h-11">
              <BookOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              <span className="max-md:sr-only">Como funciona</span>
            </Button>
          </>
        }
      />

      {id.isGuest && (
        <GuestBanner onLogin={id.askLogin}>
          <strong>Entre para executar.</strong> Você pode editar a entrada e a spec, mas Executar e Salvar pedem login.
        </GuestBanner>
      )}

      <div role="toolbar" aria-label="Layout" className="flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm">
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <label htmlFor="jolt-layout-salvo" className="text-xs font-semibold text-muted-foreground">Layout</label>
          <SelectField
            id="jolt-layout-salvo"
            aria-label="Layout salvo"
            value={selectedId ?? NEW_LAYOUT_VALUE}
            onChange={(v) => requestSwitch(v === NEW_LAYOUT_VALUE ? null : v)}
            options={layoutOptions}
            className="h-10 w-full sm:w-[300px] max-sm:h-11"
          />
        </div>

        <Popover open={detailsOpen} onOpenChange={setDetailsOpen}>
          <PopoverTrigger asChild>
            <ModalButton className={cn(barButton, FOCUS_RING)}>
              Detalhes
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            </ModalButton>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(400px,calc(100vw-2rem))] rounded-xl p-4">
            <LayoutDetails name={name} onName={setName} url={url} onUrl={setUrl} onDelete={() => { setDetailsOpen(false); setDeleteOpen(true); }} canDelete={!!selectedId} />
          </PopoverContent>
        </Popover>

        <span role="status" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden="true" className={cn('h-[7px] w-[7px] rounded-full', saveNote.dot)} />
          {saveNote.text}
        </span>
        {draftIssue && (
          <span role="status" className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <TriangleAlert className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            Rascunho não guardado
          </span>
        )}
        {layoutsStatus === 'erro' && (
          <span role="status" className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
            <TriangleAlert className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            Layouts salvos indisponíveis
          </span>
        )}

        <span className="flex-1" />

        <ModalButton onClick={() => setGithubOpen(true)} className={barButton}>
          <Github className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          GitHub
        </ModalButton>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ModalButton className={cn(barButton, FOCUS_RING)}>
              <Layers className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Modelos
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            </ModalButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[340px] rounded-xl p-1.5">
            <DropdownMenuLabel className="mb-1 flex items-center gap-2 rounded-lg bg-amber-500/10 px-2.5 py-2 text-[13px] font-normal text-amber-900 dark:text-amber-200">
              <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span>Escolher um modelo <strong>substitui a spec</strong>.</span>
            </DropdownMenuLabel>
            {MODEL_MENU.map((m) => (
              <DropdownMenuItem key={m.name} onSelect={() => chooseModel(m.name)} className="flex cursor-pointer flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 max-sm:min-h-11">
                <span className="font-code text-sm font-bold">{m.name}</span>
                <span className="text-xs text-muted-foreground">{m.description}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <ModalButton onClick={() => setMaintOpen(true)} className={barButton}>
          <Wrench className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          Manutenção
        </ModalButton>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ModalButton className={cn(barButton, FOCUS_RING)}>
              <Copy className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Layout completo
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            </ModalButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[300px] rounded-xl p-1.5">
            <DropdownMenuItem onSelect={() => void copyFullLayout()} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 max-sm:min-h-11">
              <Copy className="h-4 w-4" strokeWidth={1.5} />
              <span className="flex flex-col"><strong className="font-semibold">Copiar</strong><span className="text-xs text-muted-foreground">Registro da rota com a spec dentro</span></span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={downloadFullLayout} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 max-sm:min-h-11">
              <Download className="h-4 w-4" strokeWidth={1.5} />
              <span className="flex flex-col"><strong className="font-semibold">Baixar .json</strong><span className="text-xs text-muted-foreground">{safeFileName(name)}.json</span></span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ModalButton onClick={() => void salvar()} disabled={saving} aria-label={`Salvar layout, atalho ${SHORTCUT_LABEL.salvar}`} className={barButton}>
          {saving ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
          Salvar
          <span className="max-2xl:hidden"><Kbd>{SHORTCUT_LABEL.salvar}</Kbd></span>
        </ModalButton>
      </div>

      {/* Janela estreita: uma bancada por vez, com o Executar na mesma barra das abas */}
      <div className="flex items-center gap-1 rounded-2xl border border-border bg-card pl-2 pr-2 shadow-sm lg:hidden">
        <div role="tablist" aria-label="Editor" className="flex flex-1 items-center">
          {(['entrada', 'spec', 'saida'] as const).map((which) => (
            <button
              key={which}
              type="button"
              role="tab"
              aria-selected={pane === which}
              onClick={() => setPane(which)}
              className={cn(
                '-mb-px inline-flex h-11 items-center gap-1.5 border-b-2 px-3 text-sm transition-colors duration-fast',
                pane === which ? 'border-primary font-bold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
                FOCUS_RING,
              )}
            >
              {PANE_LABEL[which]}
              {which === 'saida' && run === 'ok' && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
        <ModalButton variant="primary" onClick={() => void executar()} disabled={running} aria-label="Executar" className="h-11 gap-2">
          {running ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
          {running ? 'Executando…' : 'Executar'}
        </ModalButton>
      </div>

      <section aria-label="Editores" className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <JsonEditor
          title="Entrada"
          value={inputText}
          onChange={setInputText}
          heightClassName={editorHeight}
          className={paneClass('entrada')}
          onRun={() => void executar()}
          onSave={() => void salvar()}
          actions={
            <>
              <PaneButton onClick={() => void paste(setInputText, 'Entrada')}>Colar</PaneButton>
              <PaneButton onClick={() => format(inputText, setInputText, 'entrada')}>Formatar</PaneButton>
              <PaneButton onClick={() => void copy(inputText, 'Entrada')} aria-label="Copiar a entrada" disabled={!inputText}>Copiar</PaneButton>
            </>
          }
          footer={
            inputCheck && !inputCheck.ok ? (
              <SyntaxErrorStrip text={describeProblem('Erro de sintaxe na entrada', inputCheck.problem)} onFix={inputFix ? () => setInputText(inputFix) : undefined} />
            ) : undefined
          }
        />
        <JsonEditor
          title="Spec"
          value={specText}
          onChange={(v) => {
            setSpecText(v);
          }}
          heightClassName={editorHeight}
          className={paneClass('spec')}
          onRun={() => void executar()}
          onSave={() => void salvar()}
          actions={
            <>
              <PaneButton onClick={() => void paste((v) => { setSpecText(v); setLoadedDocument(null); }, 'Spec')}>Colar</PaneButton>
              <PaneButton onClick={() => format(specText, setSpecText, 'spec')}>Formatar</PaneButton>
              <PaneButton onClick={() => void copy(specText, 'Spec')} aria-label="Copiar a spec" disabled={!specText}>Copiar</PaneButton>
            </>
          }
          footer={
            specCheck && !specCheck.ok ? (
              <SyntaxErrorStrip text={describeProblem('Erro de sintaxe na spec', specCheck.problem)} onFix={specFix ? () => setSpecText(specFix) : undefined} />
            ) : undefined
          }
        />
        <JsonEditor
          title="Saída"
          value={outputText}
          readOnly
          heightClassName={editorHeight}
          className={paneClass('saida')}
          onRun={() => void executar()}
          onSave={() => void salvar()}
          titleExtra={
            run === 'ok' && elapsedMs !== null ? (
              <StatusChip tone="brand" className="font-bold tabular-nums max-lg:hidden">{elapsedMs} ms</StatusChip>
            ) : undefined
          }
          actions={
            <>
              <PaneButton
                onClick={() => {
                  invalidateRun();
                  setOutputText('');
                  setElapsedMs(null);
                  setRunError(null);
                  setRun('idle');
                }}
                disabled={!outputText && run === 'idle'}
              >
                Limpar
              </PaneButton>
              <PaneButton onClick={() => void copy(outputText, 'Saída')} aria-label="Copiar a saída" disabled={!outputText}>Copiar</PaneButton>
              <ModalButton variant="primary" onClick={() => void executar()} disabled={running} aria-label={`Executar, atalho ${SHORTCUT_LABEL.executar}`} className="h-10 gap-2 max-lg:hidden">
                {running ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
                {running ? 'Executando…' : 'Executar'}
                <span className={kbdOnPrimary} aria-hidden="true">{SHORTCUT_LABEL.executar}</span>
              </ModalButton>
            </>
          }
          overlay={outputOverlay}
          footer={
            outputIsEmpty ? (
              <p role="status" className="shrink-0 border-t border-border px-4 py-2.5 text-[13px] leading-snug text-muted-foreground">
                A spec não produziu nada com esta entrada. Confira se os nomes dos campos da spec existem na entrada.
              </p>
            ) : undefined
          }
        />
      </section>

      <Sheet open={githubOpen} onOpenChange={setGithubOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[460px]">
          <SheetHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
            <SheetTitle className="text-base font-bold">Buscar do GitHub</SheetTitle>
            <SheetDescription className="text-[13px]">Traz um layout do repositório para o editor.</SheetDescription>
          </SheetHeader>
          <div className="p-4">
            <GithubIntegrationBar github={github} envelope={loadedDocument !== null} />
          </div>
        </SheetContent>
      </Sheet>

      <JoltMaintenancePanel open={maintOpen} onOpenChange={setMaintOpen} specText={specText} inputText={inputText} onSpecChange={onMaintenanceChange} />
      <JoltHowItWorks open={howOpen} onOpenChange={setHowOpen} />
      <LoginRequiredDialog open={id.loginOpen} onOpenChange={(o) => (o ? id.askLogin() : id.closeLogin())} onLogin={id.goLogin} />

      <Modal
        open={pendingModel !== null}
        onOpenChange={(o) => {
          if (!o) setPendingModel(null);
        }}
        size="sm"
        tone="warn"
        icon={TriangleAlert}
        dismissible={false}
        title={`Substituir a spec pelo modelo «${pendingModel ?? ''}»?`}
        description="A spec que está na tela será trocada pelo modelo e não dá para desfazer aqui. Se quiser guardá-la, salve o layout antes."
        footer={
          <>
            <ModalButton onClick={() => setPendingModel(null)}>Cancelar</ModalButton>
            <ModalButton
              onClick={() => {
                void (async () => {
                  if (pendingModel && (await salvar())) applyModel(pendingModel, true);
                })();
              }}
            >
              Salvar antes
            </ModalButton>
            <ModalButton variant="danger" onClick={() => pendingModel && applyModel(pendingModel, false)}>Substituir a spec</ModalButton>
          </>
        }
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        tone="danger"
        title={`Excluir o layout «${name}»?`}
        description="O nome, a URL, a spec e a última entrada saem da sua conta. Não dá para desfazer."
        confirmLabel="Excluir layout"
        onConfirm={() => void deleteLayout()}
      />

      <ConfirmDialog
        open={pendingSwitch !== null}
        onOpenChange={(o) => {
          if (!o) setPendingSwitch(null);
        }}
        tone="warn"
        icon={TriangleAlert}
        title="Trocar de layout?"
        description="Há alterações que ainda não foram salvas. Se trocar agora, elas serão perdidas."
        cancelLabel="Ficar neste"
        confirmLabel="Trocar mesmo assim"
        onConfirm={() => {
          if (pendingSwitch) applyLayout(pendingSwitch.id ? savedLayouts.find((l) => l.id === pendingSwitch.id) ?? null : null);
          setPendingSwitch(null);
        }}
      />
    </PageShell>
  );
}
