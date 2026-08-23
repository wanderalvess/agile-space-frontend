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
  Terminal
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { transformJolt } from '@/lib/jolt-engine';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
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
import { JoltPanel } from '@/components/jolt/JoltPanel';
import { GithubIntegrationBar } from '@/components/jolt/GithubIntegrationBar';
import Link from 'next/link';

const LAYOUTS_STORAGE_KEY_PREFIX = 'agileSpace_jolt_layouts';

export default function JoltSandboxPage() {
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
    document.title = `Jolt Sandbox | Espaço Ágil`;

    const specFromVisual = localStorage.getItem('jolt_visual_generated_spec');
    const inputFromVisual = localStorage.getItem('jolt_visual_input_json');
    if (specFromVisual) {
      setJoltSpec(specFromVisual);
      localStorage.removeItem('jolt_visual_generated_spec');
      
      if (inputFromVisual) {
        setInputJson(inputFromVisual);
        localStorage.removeItem('jolt_visual_input_json');
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
      const result = await transformJolt(parsedInput, parsedSpec);
      setOutputJson(JSON.stringify(result.outputData, null, 2));
      toast({ title: "Sucesso!", description: "Transformação concluída." });
    } catch (error: any) {
      toast({ title: "Erro na Transformação", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isHydrated) {
    return <LoadingScreen message="Carregando Jolt Sandbox..." />;
  }

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      <TooltipProvider>
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all rounded-xl border border-slate-200 dark:border-slate-900">
              <Link href="/jolt">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
              <Terminal className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <h1 className="text-sm font-black tracking-tight text-slate-900 dark:text-white uppercase italic leading-none">Jolt Sandbox</h1>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 leading-none truncate">Editor e Validador Jolt</p>
            </div>
            
            {/* Cloud layouts dropdown */}
            <div className="flex items-center gap-2 flex-1 max-w-[280px] ml-4">
              <Select onValueChange={handleLoadLayout} value={selectedLayoutId || ""}>
                <SelectTrigger className="h-9 w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest rounded-xl px-4 text-slate-700 dark:text-slate-300">
                  <SelectValue placeholder="MEUS LAYOUTS" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                  {sortedLayouts.map(layout => (
                    <SelectItem key={layout.id} value={layout.id} className="text-xs font-bold uppercase hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-slate-100 dark:focus:bg-slate-800">{layout.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLayoutId ? (
                <Button variant="ghost" size="icon" onClick={() => setIsDeleteDialogOpen(true)} className="h-9 w-9 text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all rounded-xl">
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsGuideOpen(true)}
              className="h-9 px-4 font-black text-[9px] uppercase tracking-widest gap-2 text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-900 transition-all rounded-xl"
            >
              <HelpCircle className="h-4 w-4" />
              GUIA
            </Button>
            <JoltGuide open={isGuideOpen} onOpenChange={setIsGuideOpen} />

            <Button size="sm" onClick={handleSaveLayout} disabled={isSaving} className="h-9 px-4 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-350 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white shadow-none">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-2" />}
              {selectedLayoutId ? 'Atualizar' : 'Salvar'}
            </Button>
            <Button size="sm" onClick={handleRunTransformation} disabled={isLoading} className="h-9 px-6 font-black text-[10px] uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/10 transition-all active:scale-95 rounded-xl border-none">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="mr-2 h-4 w-4 fill-current" />}
              EXECUTAR
            </Button>
          </div>
        </header>
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

        {/* 3-Column Monaco Editor Layout */}
        <div className="flex-1 flex p-4 gap-4 bg-slate-100 dark:bg-slate-950 overflow-hidden">
          {/* Input Panel */}
          <JoltPanel
            title="JSON de Entrada"
            value={inputJson}
            onChange={setInputJson}
            onPaste={() => handlePaste(setInputJson, 'Entrada')}
            onFormat={handleFormatInput}
            onCopy={() => handleCopy(inputJson, 'Entrada')}
            onMount={(editor) => {
              editorInputRef.current = editor;
            }}
            dotColor="bg-slate-500"
            pasteTooltip="Colar JSON de Entrada"
            formatTooltip="Formatar/Identar JSON"
            copyTooltip="Copiar JSON de Entrada"
          />

          {/* Jolt Spec Panel */}
          <JoltPanel
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
            dotColor="bg-blue-500"
            pulse
            pasteTooltip="Colar Jolt Spec"
            formatTooltip="Formatar/Identar Spec"
            copyTooltip="Copiar Jolt Spec"
            actions={
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all rounded-lg">
                        <Sparkles className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 animate-pulse" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-[10px] text-slate-700 dark:text-slate-300 font-sans">Modelos Jolt (Snippets)</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-[180px] p-1 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl">
                  <div className="px-2 py-1.5 text-[8.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 mb-1">Modelos Jolt</div>
                  <DropdownMenuItem onClick={() => handleInjectSnippet('shift')} className="text-[10px] font-bold uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Shift (De/Para)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleInjectSnippet('modify')} className="text-[10px] font-bold uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Modify (Conversão)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleInjectSnippet('default')} className="text-[10px] font-bold uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Default (Valores Padrão)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleInjectSnippet('cardinality')} className="text-[10px] font-bold uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cardinality (ONE/MANY)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleInjectSnippet('remove')} className="text-[10px] font-bold uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Remove (Exclusão)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          {/* Output Panel */}
          <JoltPanel
            title="Resultado (Output)"
            value={outputJson}
            readOnly
            onPaste={() => {}}
            onClear={() => setOutputJson('')}
            onCopy={() => handleCopy(outputJson, 'Resultado')}
            dotColor="bg-emerald-500"
            pulse
            clearTooltip="Limpar Resultado"
            copyTooltip="Copiar Resultado JSON"
          />
        </div>

        {/* Delete Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-black uppercase tracking-tight italic">Excluir Layout?</AlertDialogTitle>
              <AlertDialogDescription className="text-sm font-medium text-slate-500 dark:text-slate-400">
                O layout <strong className="text-slate-800 dark:text-slate-200">"{currentTitle}"</strong> será removido permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px] tracking-widest border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteLayout} className="rounded-xl font-bold uppercase text-[10px] tracking-widest bg-red-600 hover:bg-red-700 text-white transition-all border-none">EXCLUIR</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TooltipProvider>
    </div>
  );
}
