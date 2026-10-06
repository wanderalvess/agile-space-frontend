'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  ArrowLeft,
  Play, 
  Save, 
  Loader2, 
  Trash2,
  HelpCircle,
  Sparkles,
  Terminal,
  Workflow,
  GitCompare,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Info,
  X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { transformJolt, type JoltEngineMode } from '@/lib/jolt-engine';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { useUserContext } from '@/context/UserContext';
import { cn } from '@/lib/utils';
import { JoltGuide } from '@/components/jolt/JoltGuide';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { SandboxPane } from './SandboxPane';
import { GithubIntegrationBar } from '@/components/jolt/GithubIntegrationBar';
import Link from 'next/link';

const LAYOUTS_STORAGE_KEY_PREFIX = 'agileSpace_jolt_layouts';

export default function JoltSandboxPage() {
  const router = useRouter();
  const { userProfile, requestIdentity } = useUserContext();
  const { toast } = useToast();

  const [inputJson, setInputJson] = useState('');
  const [joltSpec, setJoltSpec] = useState('');
  const [outputJson, setOutputJson] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [currentTitle, setCurrentTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Legenda dos motores: dispensável e lembrada neste navegador (só visual).
  const ENGINE_HINT_KEY = 'agileSpace_jolt_sandbox_engine_hint_dismissed';
  const [isEngineHintDismissed, setIsEngineHintDismissed] = useState(false);
  useEffect(() => {
    try { setIsEngineHintDismissed(localStorage.getItem(ENGINE_HINT_KEY) === '1'); } catch {}
  }, []);
  const dismissEngineHint = () => {
    setIsEngineHintDismissed(true);
    try { localStorage.setItem(ENGINE_HINT_KEY, '1'); } catch {}
  };

  // Engine & Comparison States
  const [engineMode, setEngineMode] = useState<JoltEngineMode>('local');
  const [isComparing, setIsComparing] = useState(false);
  const [executionStats, setExecutionStats] = useState<{ timeMs?: number; engine?: string } | null>(null);
  const [compareResult, setCompareResult] = useState<{
    identical: boolean;
    localTime: number;
    javaTime: number;
    localOutput: string;
    javaOutput: string;
  } | null>(null);
  const [isCompareDialogOpen, setIsCompareDialogOpen] = useState(false);

  const editorInputRef = useRef<any>(null);
  const editorSpecRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  // GitHub Integration States
  const [githubRepo, setGithubRepo] = useState('totvs/winthor-smart-hub-layouts');
  const [repoInput, setRepoInput] = useState('totvs/winthor-smart-hub-layouts');
  const [githubTags, setGithubTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [githubIntegrations, setGithubIntegrations] = useState<string[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<string>('');
  const [githubLayouts, setGithubLayouts] = useState<any[]>([]);
  const [selectedLayoutPath, setSelectedLayoutPath] = useState<string>('');
  const [isLayoutPopoverOpen, setIsLayoutPopoverOpen] = useState(false);
  
  const [loadingGithubTags, setLoadingGithubTags] = useState(false);
  const [loadingGithubTree, setLoadingGithubTree] = useState(false);
  const [loadingGithubLayout, setLoadingGithubLayout] = useState(false);

  const treeCacheRef = useRef<Record<string, any[]>>({});

  // Sync data from Visual Mapper if it exists in localStorage
  useEffect(() => {
    setIsHydrated(true);
    document.title = `Jolt Sandbox | Portal Tech V&D`;

    const specFromVisual = localStorage.getItem('jolt_visual_generated_spec');
    const inputFromVisual = localStorage.getItem('jolt_visual_input_json');
    if (specFromVisual) {
      setJoltSpec(specFromVisual);
      localStorage.removeItem('jolt_visual_generated_spec');
      
      if (inputFromVisual) {
        setInputJson(inputFromVisual);
      }

      toast({ 
        title: "Layout Carregado!", 
        description: "A especificação gerada no Mapeador Visual foi carregada com sucesso." 
      });
    }
  }, []);

  // Fetch tags when repository changes
  useEffect(() => {
    if (githubRepo) {
      fetchGithubTags(githubRepo);
    }
  }, [githubRepo]);

  const filterLayoutsForIntegration = (tree: any[], integration: string) => {
    if (!integration) return;
    const layouts = tree
      .filter((node: any) => {
        return node.type === 'blob' && 
               node.path.startsWith(`${integration}/rotas/`) && 
               node.path.endsWith('.json');
      })
      .map((node: any) => {
        const parts = node.path.split('/');
        const filename = parts[parts.length - 1].replace('.json', '');
        return {
          name: filename,
          path: node.path
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    setGithubLayouts(layouts);
  };

  const processTree = (tree: any[], tag: string) => {
    const rootsSet = new Set<string>();
    tree.forEach((node: any) => {
      if (node.type === 'tree') {
        const parts = node.path.split('/');
        if (parts.length === 1 && parts[0] !== '.github' && parts[0] !== 'docs') {
          rootsSet.add(parts[0]);
        }
      }
    });

    const integrations = Array.from(rootsSet).sort();
    setGithubIntegrations(integrations);
    
    if (integrations.length > 0) {
      setSelectedIntegration(integrations[0]);
      filterLayoutsForIntegration(tree, integrations[0]);
    }
  };

  const fetchGithubTree = async (tag: string) => {
    if (!tag) return;
    setLoadingGithubTree(true);
    
    setGithubIntegrations([]);
    setSelectedIntegration('');
    setGithubLayouts([]);
    setSelectedLayoutPath('');

    try {
      const cacheKey = `github_tree_${githubRepo}_${tag}`;
      if (treeCacheRef.current[cacheKey]) {
        processTree(treeCacheRef.current[cacheKey], tag);
        return;
      }
      const cachedTree = sessionStorage.getItem(cacheKey);
      if (cachedTree) {
        const parsed = JSON.parse(cachedTree);
        treeCacheRef.current[cacheKey] = parsed;
        processTree(parsed, tag);
        return;
      }

      const res = await fetch(`https://api.github.com/repos/${githubRepo}/git/trees/${tag}?recursive=1`);
      if (!res.ok) throw new Error('Erro ao buscar estrutura do repositório');
      const data = await res.json();
      
      const tree = data.tree || [];
      treeCacheRef.current[cacheKey] = tree;
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(tree));
      } catch (_) {}
      processTree(tree, tag);
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro de Conexão",
        description: "Não foi possível carregar a árvore de arquivos para esta tag.",
        variant: "destructive"
      });
    } finally {
      setLoadingGithubTree(false);
    }
  };

  const fetchGithubTags = async (repo = githubRepo) => {
    setLoadingGithubTags(true);
    try {
      const cacheKey = `github_layouts_tags_${repo}`;
      const cachedTags = sessionStorage.getItem(cacheKey);
      if (cachedTags) {
        const parsed = JSON.parse(cachedTags);
        setGithubTags(parsed);
        if (parsed.length > 0) setSelectedTag(parsed[0]);
        return;
      }

      const res = await fetch(`https://api.github.com/repos/${repo}/tags`);
      if (!res.ok) throw new Error('Erro ao buscar tags do repositório. Verifique se o nome está correto e se o repositório é público.');
      const data = await res.json();
      const tags = data.map((t: any) => t.name);
      setGithubTags(tags);
      sessionStorage.setItem(cacheKey, JSON.stringify(tags));
      if (tags.length > 0) setSelectedTag(tags[0]);
    } catch (e: any) {
      console.error(e);
      setGithubTags([]);
      toast({
        title: "Erro ao Carregar Repositório",
        description: "Não foi possível carregar as tags do repositório: " + e.message,
        variant: "destructive"
      });
    } finally {
      setLoadingGithubTags(false);
    }
  };

  const fetchLayoutContent = async (path: string, tag: string) => {
    if (!path || !tag) return;
    setLoadingGithubLayout(true);
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${githubRepo}/${tag}/${path}`);
      if (!res.ok) throw new Error('Não foi possível carregar o conteúdo do layout');
      const data = await res.json();
      
      let specValue = data;
      
      if (data && !Array.isArray(data) && data.tabela?.campos) {
        const campoTransformacao = data.tabela.campos.find((c: any) => c.nome === 'LAYOUTTRANSFORMACAO');
        if (campoTransformacao?.valor) {
          specValue = Array.isArray(campoTransformacao.valor)
            ? campoTransformacao.valor
            : JSON.parse(typeof campoTransformacao.valor === 'string' ? campoTransformacao.valor : JSON.stringify(campoTransformacao.valor));
        }
      }
      
      const formattedSpec = JSON.stringify(specValue, null, 2);
      setJoltSpec(formattedSpec);
      
      const parts = path.split('/');
      const filename = parts[parts.length - 1].replace('.json', '');
      setCurrentTitle(filename);

      toast({
        title: "Layout Carregado!",
        description: `O layout "${filename}" foi carregado com sucesso.`
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro ao buscar layout",
        description: e.message,
        variant: "destructive"
      });
    } finally {
      setLoadingGithubLayout(false);
    }
  };

  const handleIntegrationChange = (integration: string) => {
    setSelectedIntegration(integration);
    setSelectedLayoutPath('');
    const cacheKey = `github_tree_${githubRepo}_${selectedTag}`;
    const currentTree = treeCacheRef.current[cacheKey] || [];
    filterLayoutsForIntegration(currentTree, integration);
  };

  const handleLayoutPathChange = (path: string) => {
    setSelectedLayoutPath(path);
    if (path) {
      fetchLayoutContent(path, selectedTag);
    }
  };

  const JOLT_SNIPPETS = {
    shift: [
      {
        "operation": "shift",
        "spec": {
          "campoOrigem": "campoDestino"
        }
      }
    ],
    modify: [
      {
        "operation": "modify-overwrite-beta",
        "spec": {
          "codigo": "=toInteger",
          "idExterno": "=concat('id-', @(1,codigo))"
        }
      }
    ],
    cardinality: [
      {
        "operation": "cardinality",
        "spec": {
          "listaOuObjeto": "ONE"
        }
      }
    ],
    default: [
      {
        "operation": "default",
        "spec": {
          "status": "ATIVO"
        }
      }
    ],
    remove: [
      {
        "operation": "remove",
        "spec": {
          "campoRemover": ""
        }
      }
    ]
  };

  const handleInjectSnippet = (type: keyof typeof JOLT_SNIPPETS) => {
    const spec = JOLT_SNIPPETS[type];
    setJoltSpec(JSON.stringify(spec, null, 2));
    toast({
      title: "Modelo Injetado!",
      description: `Operação Jolt "${type.toUpperCase()}" injetada com sucesso.`
    });
  };

  useEffect(() => {
    if (selectedTag) {
      fetchGithubTree(selectedTag);
    }
  }, [selectedTag]);

  // AUTO-FILL ENGINE
  useEffect(() => {
    if (!joltSpec && !inputJson) return;

    try {
      let foundMeta = false;
      const scanTextForMeta = (text: string) => {
        const regexLayout = /"(?:layout|layoutName|nomeLayout|title|name)"\s*:\s*"([^"]+)"/i;
        const regexUrl = /"(?:url|endpoint|origem|apiUrl|source|raw)"\s*:\s*"([^"]+)"/i;
        
        const layoutMatch = text.match(regexLayout);
        const urlMatch = text.match(regexUrl);

        if (layoutMatch && layoutMatch[1] && !currentTitle) {
          setCurrentTitle(layoutMatch[1]);
          foundMeta = true;
        }
        if (urlMatch && urlMatch[1] && !apiUrl) {
          setApiUrl(urlMatch[1]);
          foundMeta = true;
        }
      };

      scanTextForMeta(joltSpec);
      scanTextForMeta(inputJson);

      if (foundMeta) {
        toast({ title: "Mágica!", description: "Metadados preenchidos automaticamente." });
      }
    } catch (e) {
      // Silencioso
    }
  }, [joltSpec, inputJson]);

  const [savedLayouts, setSavedLayouts] = useState<any[]>([]);

  const getLayoutsStorageKey = useCallback(() => {
    return userProfile?.id ? `${LAYOUTS_STORAGE_KEY_PREFIX}_${userProfile.id}` : LAYOUTS_STORAGE_KEY_PREFIX;
  }, [userProfile?.id]);

  const loadLayoutsFromStorage = useCallback((): any[] => {
    try {
      const raw = localStorage.getItem(getLayoutsStorageKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [getLayoutsStorageKey]);

  useEffect(() => {
    if (!isHydrated) return;
    setSavedLayouts(loadLayoutsFromStorage());
  }, [isHydrated, loadLayoutsFromStorage]);

  const sortedLayouts = useMemo(() => {
    if (!savedLayouts) return [];
    return [...savedLayouts].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [savedLayouts]);

  const handleCopy = async (text: string, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado!", description: `${label} copiado.` });
    } catch (e) {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const handlePaste = async (setter: (val: string) => void, label: string) => {
    try {
      const text = await navigator.clipboard.readText();
      setter(text);
      toast({ title: "Colado!", description: `${label} atualizado.` });
    } catch (e) {
      toast({ title: "Erro ao colar", variant: "destructive" });
    }
  };

  const handleSaveLayout = async () => {
    if (!userProfile) {
      requestIdentity(() => handleSaveLayout());
      return;
    }
    if (!currentTitle.trim()) { toast({ title: "Nome ausente", variant: "destructive" }); return; }

    setIsSaving(true);
    try {
      const layoutData = {
        toolType: 'jolt',
        name: currentTitle,
        apiUrl: apiUrl.trim(),
        joltSpec: joltSpec,
        lastInput: inputJson,
        updatedAt: new Date().toISOString(),
        creatorId: userProfile.id,
        authorName: userProfile.name,
      };

      const key = getLayoutsStorageKey();
      const current = loadLayoutsFromStorage();

      let updated: any[];
      if (selectedLayoutId) {
        updated = current.map(l => l.id === selectedLayoutId ? { ...l, ...layoutData, id: selectedLayoutId } : l);
        toast({ title: "Atualizado!" });
      } else {
        updated = [...current, { id: crypto.randomUUID(), ...layoutData }];
        toast({ title: "Salvo!" });
      }

      localStorage.setItem(key, JSON.stringify(updated));
      setSavedLayouts(updated);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setTimeout(() => setIsSaving(false), 1000);
    }
  };

  const handleDeleteLayout = async () => {
    if (!selectedLayoutId) return;
    const key = getLayoutsStorageKey();
    const current = loadLayoutsFromStorage();
    const updated = current.filter(l => l.id !== selectedLayoutId);
    localStorage.setItem(key, JSON.stringify(updated));
    setSavedLayouts(updated);
    setSelectedLayoutId(null);
    setIsDeleteDialogOpen(false);
    toast({ title: "Layout Excluído" });
  };

  const handleLoadLayout = (id: string) => {
    const layout = savedLayouts?.find(l => l.id === id);
    if (layout) {
      setSelectedLayoutId(id);
      setJoltSpec(layout.joltSpec || '');
      setApiUrl(layout.apiUrl || '');
      setCurrentTitle(layout.name || '');
      setInputJson(layout.lastInput || '');
      setOutputJson('');
      toast({ title: "Layout Carregado" });
    }
  };

  const handleFormatInput = () => {
    if (!inputJson.trim()) return;
    const parsed = validateJSON(inputJson, 'Entrada');
    if (parsed) {
      setInputJson(JSON.stringify(parsed, null, 2)); 
      toast({ title: "Entrada Formatada" });
    }
  };

  const handleFormatSpec = () => {
    if (!joltSpec.trim()) return;
    const parsed = validateJSON(joltSpec, 'Spec');
    if (parsed) {
      setJoltSpec(JSON.stringify(parsed, null, 2)); 
      toast({ title: "Spec Formatado" });
    }
  };

  const explainJSONError = (message: string): string => {
    if (message.includes('Unexpected token') && message.includes('}')) return "Objeto não finalizado corretamente ou vírgula extra no final.";
    if (message.includes('Unexpected token') && message.includes(']')) return "Array não finalizado corretamente ou vírgula extra no final.";
    if (message.includes('Expected \',\' or \'}\'')) return "Faltando vírgula separando as propriedades.";
    if (message.includes('Unexpected string')) return "Aspas mal posicionadas ou vírgula faltando entre itens.";
    if (message.includes('Unexpected number')) return "Número inesperado. Verifique se há uma vírgula antes.";
    if (message.includes('JSON at position')) return "Erro de estrutura próximo à posição indicada.";
    return message;
  };

  const getLineColumn = (text: string, position: number) => {
    const lines = text.slice(0, position).split('\n');
    return { line: lines.length, column: lines[lines.length - 1].length + 1 };
  };

  const validateJSON = (jsonString: string, label: string, editorRef?: any): any => {
    if (monacoRef.current && editorRef?.current) {
      const model = editorRef.current.getModel();
      if (model) {
        const markers = monacoRef.current.editor.getModelMarkers({ resource: model.uri });
        if (markers && markers.length > 0) {
          const error = markers.find((m: any) => m.severity === 8);
          if (error) {
             toast({ 
               title: `Erro de Sintaxe: ${label}`, 
               description: `${error.message} (Linha ${error.startLineNumber}, Coluna ${error.startColumn})`, 
               variant: "destructive" 
             });
             return null;
          }
        }
      }
    }

    try {
      return JSON.parse(jsonString);
    } catch (e: any) {
      const match = e.message.match(/position (\d+)/i) || e.message.match(/line (\d+) column (\d+)/i);
      let detail = explainJSONError(e.message);
      if (match) {
        if (e.message.includes('line')) {
          detail += ` (Linha ${match[1]}, Coluna ${match[2]})`;
        } else {
          const pos = parseInt(match[1], 10);
          const { line, column } = getLineColumn(jsonString, pos);
          detail += ` (Linha ${line}, Coluna ${column})`;
        }
      }
      toast({ title: `Erro de Sintaxe: ${label}`, description: detail, variant: "destructive" });
      return null;
    }
  };

  const handleRunTransformation = async () => {
    if (!inputJson.trim() || !joltSpec.trim()) return;

    const parsedInput = validateJSON(inputJson, 'Entrada (Input)', editorInputRef);
    if (!parsedInput) return;
    const parsedSpec = validateJSON(joltSpec, 'Jolt Spec', editorSpecRef);
    if (!parsedSpec) return;

    setIsLoading(true);
    try {
      const result = await transformJolt(parsedInput, parsedSpec, { engine: engineMode });
      setOutputJson(JSON.stringify(result.outputData, null, 2));
      setExecutionStats({ timeMs: result.executionTimeMs, engine: result.engine });
      toast({ 
        title: "Sucesso!", 
        description: `Transformado via ${result.engine === 'java' ? 'Java Bazaarvoice (Oficial)' : 'JavaScript Local'} em ${result.executionTimeMs ?? 0}ms.` 
      });
    } catch (error: any) {
      toast({ title: "Erro na Transformação", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompareEngines = async () => {
    if (!inputJson.trim() || !joltSpec.trim()) return;

    const parsedInput = validateJSON(inputJson, 'Entrada (Input)', editorInputRef);
    if (!parsedInput) return;
    const parsedSpec = validateJSON(joltSpec, 'Jolt Spec', editorSpecRef);
    if (!parsedSpec) return;

    setIsComparing(true);
    try {
      const localResult = await transformJolt(parsedInput, parsedSpec, { engine: 'local' });
      const localOutStr = JSON.stringify(localResult.outputData, null, 2);

      const javaResult = await transformJolt(parsedInput, parsedSpec, { engine: 'java' });
      const javaOutStr = JSON.stringify(javaResult.outputData, null, 2);

      const isIdentical = localOutStr === javaOutStr;

      setCompareResult({
        identical: isIdentical,
        localTime: localResult.executionTimeMs ?? 0,
        javaTime: javaResult.executionTimeMs ?? 0,
        localOutput: localOutStr,
        javaOutput: javaOutStr,
      });

      setOutputJson(javaOutStr);
      setExecutionStats({ timeMs: javaResult.executionTimeMs, engine: 'java' });
      setIsCompareDialogOpen(true);

      if (isIdentical) {
        toast({
          title: "Motores 100% Idênticos!",
          description: `JS: ${localResult.executionTimeMs}ms | Java: ${javaResult.executionTimeMs}ms.`,
        });
      } else {
        toast({
          title: "Resultados Divergentes!",
          description: "O motor JS e o Java oficial produziram saídas diferentes. Verifique a modal de comparação.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({ title: "Erro na Comparação", description: error.message, variant: "destructive" });
    } finally {
      setIsComparing(false);
    }
  };

  const handleOpenInVisualMapper = () => {
    if (!inputJson.trim()) {
      toast({
        title: "Entrada vazia",
        description: "Preencha o JSON de entrada para transferir ao Mapeador Visual.",
        variant: "destructive"
      });
      return;
    }

    try {
      localStorage.setItem('jolt_visual_input_json', inputJson);
      localStorage.setItem('jolt_visual_imported_from_sandbox', 'true');
      toast({
        title: "Transferindo para o Visual...",
        description: "Abrindo o Mapeador Visual com os dados da Sandbox."
      });
      router.push('/jolt/visual');
    } catch (e: any) {
      toast({
        title: "Erro ao transferir",
        description: e.message,
        variant: "destructive"
      });
    }
  };


  if (!isHydrated) {
    return <LoadingScreen message="Carregando Jolt Sandbox..." />;
  }

  const snippetItemClass = 'cursor-pointer rounded-lg text-[10px] font-bold uppercase';

  return (
    <div className="flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      <TooltipProvider>
        <RoomHeader
          title="Jolt Sandbox"
          toolIcon={<Terminal className="h-4 w-4" />}
          actions={
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInVisualMapper}
                className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider"
                title="Leva o JSON de entrada para o Mapeador Visual, onde você desenha o mapa em vez de escrever a spec"
                aria-label="Abrir no Mapeador Visual"
              >
                <Workflow className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Mapeador Visual</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsGuideOpen(true)}
                className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider"
                aria-label="Abrir guia de operações Jolt"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Guia</span>
              </Button>
              <JoltGuide open={isGuideOpen} onOpenChange={setIsGuideOpen} />
              <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
                <Link href="/jolt" aria-label="Voltar ao hub Jolt">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Jolt</span>
                </Link>
              </Button>
            </div>
          }
        />

        {/* Barra de controle: layouts salvos, motor e execução */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 bg-card/40 px-4 py-2 md:px-6">
          <div className="flex min-w-0 items-center gap-1.5">
            <Select onValueChange={handleLoadLayout} value={selectedLayoutId || ""}>
              <SelectTrigger aria-label="Meus layouts salvos" className="h-8 w-[200px] max-w-full rounded-xl border-border bg-background px-3 text-[10px] font-black uppercase tracking-widest text-foreground">
                <SelectValue placeholder="Meus layouts" />
              </SelectTrigger>
              <SelectContent>
                {sortedLayouts.map(layout => (
                  <SelectItem key={layout.id} value={layout.id} className="text-xs font-bold uppercase">{layout.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedLayoutId ? (
              <Button variant="ghost" size="icon" onClick={() => setIsDeleteDialogOpen(true)} className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Excluir layout" aria-label="Excluir layout selecionado">
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={handleSaveLayout} disabled={isSaving} className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {selectedLayoutId ? 'Atualizar' : 'Salvar'}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Motor</span>
            <div role="group" aria-label="Motor de execução" className="flex items-center rounded-xl border border-border bg-muted p-0.5">
              <button
                type="button"
                onClick={() => setEngineMode('local')}
                aria-pressed={engineMode === 'local'}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  engineMode === 'local' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                title="Execução local rápida em JavaScript no navegador"
              >
                JavaScript
              </button>
              <button
                type="button"
                onClick={() => setEngineMode('java')}
                aria-pressed={engineMode === 'java'}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  engineMode === 'java' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                title="Execução no backend oficial da Bazaarvoice em Java"
              >
                <Cpu className="h-3 w-3" />
                Java
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCompareEngines}
              disabled={isLoading || isComparing}
              className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider"
              title="Executa simultaneamente em JS e Java e compara os resultados"
            >
              {isComparing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitCompare className="h-3.5 w-3.5" />}
              Comparar
            </Button>

            <Button size="sm" onClick={handleRunTransformation} disabled={isLoading} className="h-8 gap-1.5 rounded-xl px-5 text-[10px] font-black uppercase tracking-wider">
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
              Executar
            </Button>
          </div>
        </div>

        {/* Legenda dos motores (dispensável) */}
        {!isEngineHintDismissed && (
          <div role="note" className="flex shrink-0 items-start gap-3 border-b border-border/60 bg-primary/5 px-4 py-2 md:px-6">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <p className="min-w-0 flex-1 text-xs font-medium leading-relaxed text-muted-foreground">
              Aqui você escreve a spec e vê o resultado. <strong className="font-bold text-foreground">JavaScript</strong>: instantâneo, roda no navegador.{' '}
              <strong className="font-bold text-foreground">Java</strong>: motor oficial Bazaarvoice via backend, igual à produção.{' '}
              <strong className="font-bold text-foreground">Comparar</strong>: roda os dois e aponta diferenças.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={dismissEngineHint}
              className="h-6 w-6 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
              aria-label="Dispensar explicação dos motores"
              title="Dispensar"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <GithubIntegrationBar
          currentTitle={currentTitle}
          setCurrentTitle={setCurrentTitle}
          apiUrl={apiUrl}
          setApiUrl={setApiUrl}
          repoInput={repoInput}
          setRepoInput={setRepoInput}
          setGithubRepo={setGithubRepo}
          githubTags={githubTags}
          selectedTag={selectedTag}
          setSelectedTag={setSelectedTag}
          loadingGithubTags={loadingGithubTags}
          githubIntegrations={githubIntegrations}
          selectedIntegration={selectedIntegration}
          handleIntegrationChange={handleIntegrationChange}
          loadingGithubTree={loadingGithubTree}
          githubLayouts={githubLayouts}
          selectedLayoutPath={selectedLayoutPath}
          handleLayoutPathChange={handleLayoutPathChange}
          loadingGithubLayout={loadingGithubLayout}
          isLayoutPopoverOpen={isLayoutPopoverOpen}
          setIsLayoutPopoverOpen={setIsLayoutPopoverOpen}
        />

        {/* Corpo: 3 painéis; empilha no mobile (rola a página interna) e fica zero-scroll no desktop */}
        <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 md:p-4 lg:flex-row lg:overflow-hidden">
          <SandboxPane
            title="JSON de Entrada"
            value={inputJson}
            onChange={setInputJson}
            onPaste={() => handlePaste(setInputJson, 'Entrada')}
            onFormat={handleFormatInput}
            onCopy={() => handleCopy(inputJson, 'Entrada')}
            onMount={(editor) => {
              editorInputRef.current = editor;
            }}
            dotClass="bg-muted-foreground"
          />

          <SandboxPane
            title="Jolt Spec"
            value={joltSpec}
            onChange={setJoltSpec}
            onPaste={() => handlePaste(setJoltSpec, 'Spec')}
            onFormat={handleFormatSpec}
            onCopy={() => handleCopy(joltSpec, 'Spec')}
            onMount={(editor, monaco) => {
              editorSpecRef.current = editor;
              monacoRef.current = monaco;
            }}
            dotClass="bg-primary"
            toolbar={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 rounded-lg px-2 text-[10px] font-black uppercase tracking-wider text-primary hover:text-primary" title="Inserir um modelo de operação Jolt" aria-label="Modelos Jolt (snippets)">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span className="hidden xl:inline">Modelos</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[190px] rounded-xl p-1">
                  <div className="mb-1 border-b border-border px-2 py-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Modelos Jolt (substituem a spec)</div>
                  <DropdownMenuItem onClick={() => handleInjectSnippet('shift')} className={snippetItemClass}>Shift (De/Para)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleInjectSnippet('modify')} className={snippetItemClass}>Modify (Conversão)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleInjectSnippet('default')} className={snippetItemClass}>Default (Valores Padrão)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleInjectSnippet('cardinality')} className={snippetItemClass}>Cardinality (ONE/MANY)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleInjectSnippet('remove')} className={snippetItemClass}>Remove (Exclusão)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          <SandboxPane
            title="Resultado (Output)"
            value={outputJson}
            readOnly
            onClear={() => setOutputJson('')}
            onCopy={() => handleCopy(outputJson, 'Resultado')}
            dotClass="bg-emerald-500"
            toolbar={
              executionStats ? (
                <div className="mr-1 flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[10px] font-bold text-foreground">
                  <span className={cn("h-1.5 w-1.5 rounded-full", executionStats.engine === 'java' ? "bg-purple-500" : "bg-primary")} aria-hidden />
                  <span>{executionStats.engine === 'java' ? 'Java Bazaarvoice' : 'JavaScript'}</span>
                  <span className="text-muted-foreground" aria-hidden>•</span>
                  <span className="font-code text-emerald-600 dark:text-emerald-400">{executionStats.timeMs}ms</span>
                </div>
              ) : null
            }
          />
        </main>

        {/* Modal de Comparação de Motores */}
        <Dialog open={isCompareDialogOpen} onOpenChange={setIsCompareDialogOpen}>
          <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col rounded-2xl border-border bg-card p-6 text-foreground shadow-2xl">
            <DialogHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GitCompare className="h-5 w-5 text-primary" />
                  <DialogTitle className="font-headline text-lg font-black uppercase tracking-tight">
                    Comparação de Motores JOLT
                  </DialogTitle>
                </div>
                {compareResult && (
                  <span className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold",
                    compareResult.identical
                      ? "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-destructive/30 bg-destructive/10 text-destructive"
                  )}>
                    {compareResult.identical ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Saídas 100% Idênticas
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3.5 w-3.5" />
                        Saídas Divergentes
                      </>
                    )}
                  </span>
                )}
              </div>
              <DialogDescription className="mt-1 text-xs text-muted-foreground">
                Comparando a execução do motor local JavaScript (Navegador) contra o motor oficial Bazaarvoice em Java (Backend).
              </DialogDescription>
            </DialogHeader>

            {compareResult && (
              <div className="mt-4 grid min-h-[350px] flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-2">
                <div className="flex min-h-[200px] flex-col overflow-hidden rounded-xl border border-border bg-background">
                  <div className="flex items-center justify-between border-b border-border/60 bg-muted px-3 py-2">
                    <span className="text-xs font-black uppercase tracking-wider text-primary">
                      JavaScript (Navegador)
                    </span>
                    <span className="rounded border border-border bg-card px-2 py-0.5 font-code text-[10px] text-foreground">
                      {compareResult.localTime} ms
                    </span>
                  </div>
                  <pre className="flex-1 overflow-auto p-3 font-code text-xs text-foreground">
                    {compareResult.localOutput}
                  </pre>
                </div>

                <div className="flex min-h-[200px] flex-col overflow-hidden rounded-xl border border-border bg-background">
                  <div className="flex items-center justify-between border-b border-border/60 bg-muted px-3 py-2">
                    <span className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                      Java Bazaarvoice (Backend Oficial)
                    </span>
                    <span className="rounded border border-border bg-card px-2 py-0.5 font-code text-[10px] text-foreground">
                      {compareResult.javaTime} ms
                    </span>
                  </div>
                  <pre className="flex-1 overflow-auto p-3 font-code text-xs text-foreground">
                    {compareResult.javaOutput}
                  </pre>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent className="rounded-2xl border-border bg-card text-foreground shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-headline text-xl font-black uppercase tracking-tight">Excluir Layout?</AlertDialogTitle>
              <AlertDialogDescription className="text-sm font-medium text-muted-foreground">
                O layout <strong className="text-foreground">"{currentTitle}"</strong> será removido permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl text-[10px] font-bold uppercase tracking-widest">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteLayout} className="rounded-xl border-none bg-destructive text-[10px] font-bold uppercase tracking-widest text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TooltipProvider>
    </div>
  );
}
