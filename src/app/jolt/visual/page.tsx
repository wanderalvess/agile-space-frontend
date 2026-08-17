'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Wand2,
  Trash2,
  HelpCircle,
  Sparkles,
  Workflow,
  ArrowRightLeft,
  ClipboardPaste,
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
  Headphones,
} from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useCalmariaStore } from '@/store/useCalmariaStore';
import { useToast } from '@/hooks/use-toast';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { VisualJoltGuide } from '@/components/jolt/VisualJoltGuide';
import Editor from '@monaco-editor/react';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  Handle,
  Position,
  NodeProps,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// --- Types ---
interface Mapping {
  id: string;
  source: string;
  target: string;
  type: 'direct' | 'expression';
  expression?: string;
}

interface PathInfo {
  path: string;
  type: string;
}

// Node data carried by the source/target flow nodes
interface FieldNodeData extends Record<string, unknown> {
  label: string;
  type: string;
}
type SourceNodeType = Node<FieldNodeData, 'source'>;
type TargetNodeType = Node<FieldNodeData, 'target'>;
type AppNode = SourceNodeType | TargetNodeType;

// --- Custom Nodes ---
const SourceNode = ({ data }: NodeProps<SourceNodeType>) => {
  const typeColors: Record<string, string> = {
    string: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    number: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    boolean: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    Array: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    object: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    null: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };
  const typeColor = typeColors[data.type] || typeColors.string;

  return (
    <div className="relative group transition-all duration-200 hover:scale-[1.02]">
      <div className="border border-blue-500/40 hover:border-blue-400/80 bg-slate-900/90 backdrop-blur-sm rounded-2xl px-4 py-2.5 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 min-w-[220px] flex items-center justify-between gap-3 transition-all duration-200">
        <span className="text-[11px] font-bold text-slate-100 truncate font-mono">{data.label}</span>
        <Badge className={cn('text-[8px] h-4 px-1.5 font-black shrink-0 border', typeColor)}>
          {data.type}
        </Badge>
      </div>
      {/* Glow */}
      <div className="absolute inset-0 rounded-2xl bg-blue-500/5 group-hover:bg-blue-500/10 pointer-events-none transition-all duration-200" />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3.5 !h-3.5 !bg-blue-500 !border-2 !border-slate-900 !shadow-lg !shadow-blue-500/40 !right-[-7px]"
      />
    </div>
  );
};

const TargetNode = ({ data }: NodeProps<TargetNodeType>) => {
  const typeColors: Record<string, string> = {
    string: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    number: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    boolean: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    Array: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    object: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    null: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };
  const typeColor = typeColors[data.type] || typeColors.string;

  return (
    <div className="relative group transition-all duration-200 hover:scale-[1.02]">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3.5 !h-3.5 !bg-emerald-500 !border-2 !border-slate-900 !shadow-lg !shadow-emerald-500/40 !left-[-7px]"
      />
      <div className="border border-emerald-500/40 hover:border-emerald-400/80 bg-slate-900/90 backdrop-blur-sm rounded-2xl px-4 py-2.5 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 min-w-[220px] flex items-center justify-between gap-3 transition-all duration-200">
        <span className="text-[11px] font-bold text-slate-100 truncate font-mono">{data.label}</span>
        <Badge className={cn('text-[8px] h-4 px-1.5 font-black shrink-0 border', typeColor)}>
          {data.type}
        </Badge>
      </div>
      {/* Glow */}
      <div className="absolute inset-0 rounded-2xl bg-emerald-500/5 group-hover:bg-emerald-500/10 pointer-events-none transition-all duration-200" />
    </div>
  );
};

const nodeTypes: NodeTypes = {
  source: SourceNode,
  target: TargetNode,
};

// --- Helpers ---
const flattenJsonToPaths = (jsonObj: any, prefix = ''): PathInfo[] => {
  if (jsonObj === null || jsonObj === undefined || typeof jsonObj !== 'object') return [];
  const paths: PathInfo[] = [];

  for (const key in jsonObj) {
    if (Object.prototype.hasOwnProperty.call(jsonObj, key)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      const value = jsonObj[key];
      const type = Array.isArray(value) ? 'Array' : value === null ? 'null' : typeof value;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        paths.push(...flattenJsonToPaths(value, newPrefix));
      } else if (Array.isArray(value)) {
        const arrayPrefix = `${newPrefix}[*]`;
        if (value.length > 0 && typeof value[0] === 'object') {
          paths.push(...flattenJsonToPaths(value[0], arrayPrefix));
        } else {
          paths.push({ path: arrayPrefix, type: 'Array' });
        }
      } else {
        paths.push({ path: newPrefix, type });
      }
    }
  }
  return paths;
};

const generateJoltSpec = (mappings: Mapping[]) => {
  const isCloudSyncPattern = mappings.some(
    (m) => m.source.startsWith('items[') || m.source.includes('.items['),
  );

  if (!isCloudSyncPattern) {
    const shiftSpec: any = {};
    mappings.forEach(({ source, target }) => {
      const parts = source.replace(/\[\*\]/g, '.*.').split('.');
      let curr = shiftSpec;
      parts.forEach((p, i) => {
        if (i === parts.length - 1) {
          curr[p] = target.replace(/\[\*\]/g, '[&1]').replace(/^(0\.|\[\*\]\.)/, '');
        } else {
          curr[p] = curr[p] || {};
          curr = curr[p];
        }
      });
    });
    return [{ operation: 'shift', spec: shiftSpec }];
  }

  const getSourceField = (targetField: string) => {
    const found = mappings.find((m) => {
      const normalizedTarget = m.target.replace(/^(0\.|\[\*\]\.|items\[\*\]\.)/, '');
      return normalizedTarget === targetField;
    });
    if (!found) return null;
    const parts = found.source.split('.');
    return parts[parts.length - 1].replace('[*]', '');
  };

  const hasRestricoes = mappings.some(
    (m) => m.source.includes('restricoes') || m.target.includes('Restricoes'),
  );

  const codigoSrc = getSourceField('idRetaguarda') || getSourceField('idInterno') || 'codigo';
  const codigoFilialSrc = getSourceField('idProprietario') || 'codigoFilial';
  const prazosSrc =
    mappings
      .find((m) => m.target.includes('numeroMaximoParcelas'))
      ?.source.split('.')
      .pop()
      ?.replace('[*]', '') || 'prazos';
  const ativoSrc = getSourceField('situacao') || 'ativo';

  const shiftSpecItems: any = {
    idExterno: 'idExterno[]',
    idInterno: 'idInterno[]',
    tipoIdInterno: 'tipoIdInterno[]',
  };

  mappings.forEach(({ source, target }) => {
    const targetClean = target.replace(/^(0\.|\[\*\]\.|items\[\*\]\.)/, '');
    const sourceClean = source.split('.').pop()?.replace('[*]', '') || '';

    if (
      [
        'idExterno',
        'idInterno',
        'tipoIdInterno',
        'idProprietario',
        'situacao',
        'condicoesPagtoRestricoes',
      ].includes(targetClean)
    ) {
      return;
    }

    if (targetClean === 'idRetaguarda') {
      shiftSpecItems[sourceClean] = 'items.[&1].idRetaguarda';
    } else if (targetClean === 'numeroMaximoParcelas') {
      shiftSpecItems[targetClean] = `items.[&1].${targetClean}`;
    } else if (targetClean.startsWith('planoPagamentoIntegracaoExterna.')) {
      const subField = targetClean.split('.').pop();
      shiftSpecItems['planoPagamentoIntegracaoExterna'] =
        shiftSpecItems['planoPagamentoIntegracaoExterna'] || {};
      shiftSpecItems['planoPagamentoIntegracaoExterna'][subField!] = `items.[&2].${subField}`;
    } else {
      shiftSpecItems[sourceClean] = `items.[&1].${targetClean}`;
    }
  });

  shiftSpecItems[codigoFilialSrc] = {
    '99': { '#{{MASTER_ID_PROPRIETARIO}}': 'items[&3].idProprietario' },
    '*': { '@1': 'items[&3].idProprietario' },
  };

  shiftSpecItems[ativoSrc] = {
    true: { '#1': 'items.[&3].situacao' },
    false: { '#0': 'items.[&3].situacao' },
  };

  if (hasRestricoes) {
    shiftSpecItems['condicoesPagtoRestricoes'] = {
      '*': {
        IdRetaguardaCondicaoPagamento: 'items.[&3].condicoesPagtoRestricoes.[&1].&',
        situacao: 'items.[&3].condicoesPagtoRestricoes.[&1].&',
        idRetaguarda: 'items.[&3].condicoesPagtoRestricoes.[&1].&',
        idRetaguardaCategoria: 'items.[&3].condicoesPagtoRestricoes.[&1].&',
        idRetaguardaCliente: 'items.[&3].condicoesPagtoRestricoes.[&1].&',
        idRetaguardaDepartamento: 'items.[&3].condicoesPagtoRestricoes.[&1].&',
        idRetaguardaFornecedor: 'items.[&3].condicoesPagtoRestricoes.[&1].&',
        idRetaguardaRamoAtividade: 'items.[&3].condicoesPagtoRestricoes.[&1].&',
        idRetaguardaSubCategoria: 'items.[&3].condicoesPagtoRestricoes.[&1].&',
        idRetaguardaSecao: 'items.[&3].condicoesPagtoRestricoes.[&1].&',
      },
    };
  }

  const spec: any[] = [];

  spec.push({
    operation: 'modify-overwrite-beta',
    spec: {
      items: {
        '*': {
          idExterno: `=concat('pdvsync-plano-pgmt-', @(1,${codigoSrc}),'-',@(1,${codigoFilialSrc}),'-',@(1,dataUltimaAtualizacao))`,
          idInterno: `=concat('', @(1,${codigoSrc}))`,
          tipoIdInterno: 'PDVSYNC-PLANO-PAGAMENTO',
          codigoFilial: `=concat('', @(1,${codigoFilialSrc}))`,
          codigo: `=toInteger(=concat('', @(1,${codigoSrc})))`,
          idInquilino: '{{ID_INQUILINO}}',
          loteOrigem: '{{LOTE_ORIGEM}}',
          diasEntreParcelas: 30,
          percentualMinimoEntrada: 100,
          solicitaDataDemaisParcelas: 0,
          solicitaDataPrimeiraParcela: 0,
          tipoDadoComplementar: 0,
          dadoComplementarDescricao: '',
          idProprietarioDesc: '{{{MASTER_ID_PROPRIETARIO}}',
          numeroMaximoParcelas: `=size(@(1,${prazosSrc}))`,
          siglaRestricao: '=concat(\'\', @(1,tipoRestricao.sigla))',
        },
      },
    },
  });

  spec.push({
    operation: 'shift',
    spec: { items: { '*': shiftSpecItems } },
  });

  const castingSpec: any = {};
  const targetIndicePreco = mappings
    .find((m) => m.source.endsWith('numColunaPreco'))
    ?.target.replace(/^(0\.|\[\*\]\.|items\[\*\]\.)/, '');
  if (targetIndicePreco) castingSpec[targetIndicePreco] = '=toString';
  castingSpec['idRetaguarda'] = '=toString';
  castingSpec['situacao'] = '=toInteger';
  spec.push({
    operation: 'modify-overwrite-beta',
    spec: { items: { '*': castingSpec } },
  });

  spec.push({ operation: 'default', spec: { _attr_access: 'items' } });

  return spec;
};

// ─── Collapsible Editor Panel ─────────────────────────────────────────────────
interface EditorPanelProps {
  label: string;
  dotColor: string;
  accentHover: string;
  value: string;
  onChange: (val: string) => void;
  onPaste: () => void;
  onFormat: () => void;
  isDark: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

function EditorPanel({
  label,
  dotColor,
  accentHover,
  value,
  onChange,
  onPaste,
  onFormat,
  isDark,
  isExpanded,
  onToggle,
}: EditorPanelProps) {
  return (
    <div
      className={cn(
        'flex flex-col border-b border-slate-200/60 dark:border-slate-800/60 transition-all duration-300',
        isExpanded ? 'flex-1 min-h-0' : 'shrink-0',
      )}
    >
      {/* Header — clickable to toggle */}
      <button
        onClick={onToggle}
        className="group w-full flex items-center justify-between px-4 py-3 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all duration-200 shrink-0"
      >
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300 flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full', dotColor, !isExpanded && 'opacity-50')} />
          {label}
        </span>
        <div className="flex items-center gap-1">
          {/* Action buttons — stop propagation so they don't toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                onClick={(e) => { e.stopPropagation(); onPaste(); }}
                className={cn(
                  'h-6 w-6 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 transition-all duration-200 cursor-pointer',
                  accentHover,
                  'hover:bg-slate-200/60 dark:hover:bg-slate-700/60',
                )}
              >
                <ClipboardPaste className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] font-bold">Colar JSON</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                onClick={(e) => { e.stopPropagation(); onFormat(); }}
                className={cn(
                  'h-6 w-6 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 transition-all duration-200 cursor-pointer',
                  accentHover,
                  'hover:bg-slate-200/60 dark:hover:bg-slate-700/60',
                )}
              >
                <Wand2 className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] font-bold">Formatar JSON</TooltipContent>
          </Tooltip>
          <span className="ml-1 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
        </div>
      </button>

      {/* Editor area */}
      {isExpanded && (
        <div className="flex-1 min-h-0 relative">
          <Editor
            height="100%"
            language="json"
            theme={isDark ? 'vs-dark' : 'vs'}
            value={value}
            onChange={(val) => onChange(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              fontFamily: 'var(--font-jetbrains-mono), "JetBrains Mono", monospace',
              wordWrap: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              lineNumbersMinChars: 3,
              padding: { top: 10, bottom: 10 },
              bracketPairColorization: { enabled: true },
              renderLineHighlight: 'gutter',
              smoothScrolling: true,
            }}
          />
        </div>
      )}

      {/* Collapsed preview */}
      {!isExpanded && value.trim() && (
        <div className="px-4 py-2 bg-slate-50/50 dark:bg-slate-950/50">
          <code className="text-[9px] text-slate-400 dark:text-slate-500 font-mono truncate block">
            {value.trim().slice(0, 80)}…
          </code>
        </div>
      )}
    </div>
  );
}

// ─── Persistence helpers (outside component to avoid stale closures) ───────────
const STORAGE_KEYS = {
  input:  'jolt_visual_input_json',
  target: 'jolt_visual_target_json',
  nodes:  'jolt_visual_nodes',
  edges:  'jolt_visual_edges',
  spec:   'jolt_visual_generated_spec',
} as const;

const DEFAULT_INPUT = '{\n  "first": false,\n  "items": [\n    {\n      "id": "1",\n      "corporateName": "TOTVS BRASILIA SOFTWARE",\n      "codigoFilial": 99,\n      "situacao": true,\n      "prazos": [10, 20, 30]\n    }\n  ],\n  "hasNext": false\n}';

const DEFAULT_TARGET = '{\n  "items": [\n    {\n      "idRetaguarda": "",\n      "idProprietario": "",\n      "situacao": 1,\n      "numeroMaximoParcelas": 0\n    }\n  ]\n}';

function readSession() {
  try {
    return {
      input:  localStorage.getItem(STORAGE_KEYS.input)  || DEFAULT_INPUT,
      target: localStorage.getItem(STORAGE_KEYS.target) || DEFAULT_TARGET,
      nodes:  JSON.parse(localStorage.getItem(STORAGE_KEYS.nodes)  || '[]'),
      edges:  JSON.parse(localStorage.getItem(STORAGE_KEYS.edges)  || '[]'),
    };
  } catch {
    return { input: DEFAULT_INPUT, target: DEFAULT_TARGET, nodes: [], edges: [] };
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function VisualJoltMapperPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [inputJson, setInputJson] = useState(DEFAULT_INPUT);
  const [targetJson, setTargetJson] = useState(DEFAULT_TARGET);
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isDark, setIsDark] = useState(true);

  // Calmaria (Focus Mode with audio + timer)
  const { toggleOpen: toggleCalmaria, isTimerRunning, activeSounds } = useCalmariaStore();
  const isFocusActive = isTimerRunning || Object.keys(activeSounds).length > 0;

  // Panel state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sourceExpanded, setSourceExpanded] = useState(true);
  const [targetExpanded, setTargetExpanded] = useState(true);

  // ── Single restore on mount — runs BEFORE any auto-save can fire ────────────
  useEffect(() => {
    const s = readSession();
    // Only override defaults if localStorage has real values
    if (s.input  !== DEFAULT_INPUT)  setInputJson(s.input);
    if (s.target !== DEFAULT_TARGET) setTargetJson(s.target);
    if (s.nodes.length > 0)  setNodes(s.nodes);
    if (s.edges.length > 0)  setEdges(s.edges);

    setIsHydrated(true);
    document.title = `Mapeador Visual Jolt | Espaço Ágil`;

    setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Typed setters that always persist to localStorage ──────────────────────
  const setAndSaveInput = useCallback((val: string) => {
    setInputJson(val);
    localStorage.setItem(STORAGE_KEYS.input, val);
  }, []);

  const setAndSaveTarget = useCallback((val: string) => {
    setTargetJson(val);
    localStorage.setItem(STORAGE_KEYS.target, val);
  }, []);

  const analyzeStructures = useCallback(() => {
    try {
      const sObj = JSON.parse(inputJson || '{}');
      const tObj = JSON.parse(targetJson || '{}');

      const sPaths = flattenJsonToPaths(sObj);
      const tPaths = flattenJsonToPaths(tObj);

      const sourceNodes: SourceNodeType[] = sPaths.map((p, i) => ({
        id: `source-${p.path}`,
        type: 'source',
        data: { label: p.path, type: p.type },
        position: { x: 40, y: 50 + i * 72 },
      }));

      const targetNodes: TargetNodeType[] = tPaths.map((p, i) => ({
        id: `target-${p.path}`,
        type: 'target',
        data: { label: p.path, type: p.type },
        position: { x: 680, y: 50 + i * 72 },
      }));

      const allNodes = [...sourceNodes, ...targetNodes];
      setNodes(allNodes);
      setEdges([]);
      localStorage.setItem(STORAGE_KEYS.nodes, JSON.stringify(allNodes));
      localStorage.setItem(STORAGE_KEYS.edges, '[]');
      toast({ title: '✅ Estruturas analisadas!', description: 'Conecte os nós para gerar o mapeamento.' });
    } catch (e: any) {
      toast({ title: 'Erro de JSON', description: e.message, variant: 'destructive' });
    }
  }, [inputJson, targetJson, setNodes, setEdges, toast]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        // Assigned to a variable so it is treated as a `Connection` (addEdge
        // generates the id) instead of triggering an excess-property check.
        const connection = {
          ...params,
          animated: true,
          style: { stroke: '#3b82f6', strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
        };
        const newEdges = addEdge(connection, eds);
        localStorage.setItem(STORAGE_KEYS.edges, JSON.stringify(newEdges));
        return newEdges;
      });
    },
    [setEdges],
  );

  const onEdgeDoubleClick = useCallback(
    (_event: React.MouseEvent, edge: any) => {
      setEdges((eds) => {
        const newEdges = eds.filter((e) => e.id !== edge.id);
        localStorage.setItem(STORAGE_KEYS.edges, JSON.stringify(newEdges));
        return newEdges;
      });
      toast({ title: 'Conexão removida!' });
    },
    [setEdges, toast],
  );

  const handleClearSession = useCallback(() => {
    setInputJson(DEFAULT_INPUT);
    setTargetJson(DEFAULT_TARGET);
    setNodes([]);
    setEdges([]);
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    toast({ title: 'Sessão limpa!', description: 'Todos os mapeamentos foram removidos.' });
  }, [setNodes, setEdges, toast]);

  const generateSpecFromEdges = useCallback(() => {
    if (edges.length === 0) {
      toast({
        title: 'Nenhum mapeamento',
        description: 'Conecte os nós para gerar a Spec.',
        variant: 'destructive',
      });
      return;
    }

    const mappings: Mapping[] = edges.map((e) => ({
      id: e.id,
      source: e.source.replace('source-', ''),
      target: e.target.replace('target-', ''),
      type: 'direct',
    }));

    const specResult = generateJoltSpec(mappings);
    // Persist everything before navigating
    localStorage.setItem(STORAGE_KEYS.spec,   JSON.stringify(specResult, null, 2));
    localStorage.setItem(STORAGE_KEYS.input,  inputJson);
    localStorage.setItem(STORAGE_KEYS.target, targetJson);
    localStorage.setItem(STORAGE_KEYS.nodes,  JSON.stringify(nodes));
    localStorage.setItem(STORAGE_KEYS.edges,  JSON.stringify(edges));

    toast({ title: '🚀 Jolt Spec Gerado!', description: 'Redirecionando para a Sandbox...' });
    router.push('/jolt/sandbox');
  }, [edges, nodes, inputJson, targetJson, router, toast]);

  const handleFormat = (text: string, setter: (val: string) => void, label: string) => {
    try {
      if (!text.trim()) return;
      setter(JSON.stringify(JSON.parse(text), null, 2));
      toast({ title: `${label} formatado!` });
    } catch (e: any) {
      toast({ title: 'Erro ao formatar', description: e.message, variant: 'destructive' });
    }
  };

  const handlePaste = async (setter: (val: string) => void, label: string) => {
    try {
      setter(await navigator.clipboard.readText());
      toast({ title: `${label} colado!` });
    } catch {
      toast({ title: 'Erro ao colar', variant: 'destructive' });
    }
  };

  if (!isHydrated) return <LoadingScreen message="Carregando Mapeador Visual Jolt..." />;

  const mappingsCount = edges.length;

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans">

        {/* ── Header Bento ────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-5 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 shadow-sm shrink-0 relative z-20">
          {/* Left */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0"
            >
              <Link href="/jolt">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>

            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
              <Workflow className="h-4 w-4 text-white" />
            </div>

            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">
                  Mapeador Visual Jolt
                </h1>
                <Badge className="text-[8px] h-4 px-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-black uppercase tracking-wider shrink-0">
                  Visual
                </Badge>
              </div>
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mt-0.5 leading-none">
                Design de Transformações por Fluxo
              </p>
            </div>
          </div>

          {/* Mapping counter */}
          {mappingsCount > 0 && (
            <div className="flex items-center gap-2 mx-4 px-3 py-1.5 bg-blue-500/10 dark:bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                {mappingsCount} {mappingsCount === 1 ? 'conexão' : 'conexões'}
              </span>
            </div>
          )}

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <ThemeToggle className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-800" />

            {/* Calmaria — Modo Foco com áudio e timer */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleCalmaria}
                  className={cn(
                    'h-9 w-9 rounded-xl border transition-all relative',
                    isFocusActive
                      ? 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/20 text-orange-500 border-orange-500/30'
                      : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-orange-500 hover:bg-orange-100/50',
                  )}
                  title="Modo de Foco (Calmaria)"
                  aria-label="Toggle Calmaria Focus Mode"
                >
                  <Headphones className={cn('h-4 w-4', isFocusActive && 'animate-pulse')} />
                  {isFocusActive && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px] font-bold">
                {isFocusActive ? 'Calmaria ativa — sons e timer rodando' : 'Modo Foco — sons ambiente e timer'}
              </TooltipContent>
            </Tooltip>

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-800" />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsGuideOpen(true)}
              className="h-9 px-4 font-black text-[9px] uppercase tracking-widest gap-2 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-200 dark:border-slate-800 transition-all rounded-xl"
            >
              <HelpCircle className="h-4 w-4" />
              Guia Visual
            </Button>
            <VisualJoltGuide open={isGuideOpen} onOpenChange={setIsGuideOpen} />

            <Button
              onClick={generateSpecFromEdges}
              className="bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white font-black uppercase text-[10px] px-5 h-9 rounded-xl shadow-lg shadow-emerald-500/20 gap-2 border-none transition-all active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5" /> Gerar Jolt Spec & Testar
            </Button>
          </div>
        </header>

        {/* ── Main workspace ───────────────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden relative">

          {/* Sidebar — collapsible */}
          <div
            className={cn(
              'flex flex-col border-r border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shrink-0 transition-[width] duration-300 overflow-hidden',
              sidebarOpen ? 'w-[460px]' : 'w-0',
            )}
          >
            {sidebarOpen && (
              <>
                {/* Source editor */}
                <EditorPanel
                  label="Origem (JSON de Entrada)"
                  dotColor="bg-blue-500 animate-pulse"
                  accentHover="hover:text-blue-500 dark:hover:text-blue-400"
                  value={inputJson}
                  onChange={setAndSaveInput}
                  onPaste={() => handlePaste(setAndSaveInput, 'Origem')}
                  onFormat={() => handleFormat(inputJson, setAndSaveInput, 'Origem')}
                  isDark={isDark}
                  isExpanded={sourceExpanded}
                  onToggle={() => setSourceExpanded((v) => !v)}
                />

                {/* Target editor */}
                <EditorPanel
                  label="Destino (JSON de Saída Mock)"
                  dotColor="bg-emerald-500"
                  accentHover="hover:text-emerald-500 dark:hover:text-emerald-400"
                  value={targetJson}
                  onChange={setAndSaveTarget}
                  onPaste={() => handlePaste(setAndSaveTarget, 'Destino')}
                  onFormat={() => handleFormat(targetJson, setAndSaveTarget, 'Destino')}
                  isDark={isDark}
                  isExpanded={targetExpanded}
                  onToggle={() => setTargetExpanded((v) => !v)}
                />
              </>
            )}
          </div>

          {/* Sidebar toggle button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                className="absolute top-1/2 -translate-y-1/2 z-30 h-12 w-5 flex items-center justify-center bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-r-xl shadow-md text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-300"
                style={{ left: sidebarOpen ? '460px' : '0px' }}
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="h-3.5 w-3.5" />
                ) : (
                  <PanelLeftOpen className="h-3.5 w-3.5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-[10px] font-bold">
              {sidebarOpen ? 'Ocultar painel' : 'Mostrar painel'}
            </TooltipContent>
          </Tooltip>

          {/* ── ReactFlow Canvas ───────────────────────────────────────────── */}
          <div className="flex-1 relative bg-slate-100/50 dark:bg-slate-950 h-full">
            {nodes.length > 0 ? (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onEdgeDoubleClick={onEdgeDoubleClick}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                className="bg-transparent h-full w-full"
              >
                <Background
                  color={isDark ? '#1e293b' : '#cbd5e1'}
                  variant={BackgroundVariant.Dots}
                  gap={20}
                  size={1.5}
                />
                <Controls className="!bg-white/80 dark:!bg-slate-900/80 !backdrop-blur-xl !border-slate-200/60 dark:!border-slate-800/60 !rounded-2xl !overflow-hidden !shadow-lg" />

                {/* Canvas action panel */}
                <Panel position="top-right">
                  <div className="flex flex-col gap-2 p-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 rounded-2xl shadow-lg">
                    <Button
                      onClick={analyzeStructures}
                      className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-black uppercase text-[9px] px-4 h-9 rounded-xl shadow-sm gap-2 border-none transition-all active:scale-95"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" /> Analisar JSON
                    </Button>

                    <Button
                      onClick={generateSpecFromEdges}
                      className="bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white font-black uppercase text-[9px] px-4 h-9 rounded-xl shadow-lg shadow-emerald-500/20 gap-2 border-none transition-all active:scale-95"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Gerar Spec
                    </Button>

                    <div className="h-px bg-slate-200 dark:bg-slate-800 my-0.5" />

                    <Button
                      variant="outline"
                      onClick={() => setEdges([])}
                      disabled={edges.length === 0}
                      className="bg-white/50 hover:bg-red-50 dark:bg-slate-900/50 dark:hover:bg-red-950/30 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900/50 font-black uppercase text-[9px] px-4 h-8 rounded-xl transition-all active:scale-95 disabled:opacity-40"
                      title="Apagar apenas as conexões desenhadas"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Limpar Conexões
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleClearSession}
                      className="bg-white/50 hover:bg-red-50 dark:bg-slate-900/50 dark:hover:bg-red-950/30 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-500 hover:border-red-200 dark:hover:border-red-900/50 font-black uppercase text-[9px] px-4 h-8 rounded-xl transition-all active:scale-95"
                      title="Resetar tudo — JSONs, nós e conexões"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Resetar Sessão
                    </Button>
                  </div>
                </Panel>
              </ReactFlow>
            ) : (
              /* Empty state */
              <div className="h-full flex flex-col items-center justify-center gap-6 select-none p-8">
                <div className="relative">
                  <div className="w-28 h-28 rounded-[2.5rem] bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl flex items-center justify-center border border-slate-200/60 dark:border-slate-800/60 shadow-xl">
                    <Workflow className="h-14 w-14 text-slate-300 dark:text-slate-700" />
                  </div>
                  <div className="absolute inset-0 rounded-[2.5rem] bg-emerald-500/5 dark:bg-emerald-500/10 pointer-events-none" />
                </div>

                <div className="text-center space-y-3 max-w-sm">
                  <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-slate-200">
                    Canvas de Mapeamento
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
                    {sidebarOpen
                      ? 'Cole os seus JSONs de Origem e Destino no painel esquerdo e clique em Analisar.'
                      : 'Abra o painel lateral (→) para colar os seus JSONs e analisar.'}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                    {!sidebarOpen && (
                      <Button
                        onClick={() => setSidebarOpen(true)}
                        variant="outline"
                        className="h-10 px-5 border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 font-black uppercase text-[10px] tracking-widest rounded-xl gap-2 transition-all active:scale-95"
                      >
                        <PanelLeftOpen className="h-4 w-4" /> Abrir Painel
                      </Button>
                    )}
                    <Button
                      onClick={analyzeStructures}
                      className="h-10 px-6 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-xl gap-2 transition-all active:scale-95 border-none"
                    >
                      <ArrowRightLeft className="h-4 w-4" /> Analisar JSON
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
