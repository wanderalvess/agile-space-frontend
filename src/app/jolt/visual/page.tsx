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
  Eye,
  Copy,
  Check,
  Layers,
  Boxes,
  RotateCcw,
  Play,
  Loader2,
  AlertTriangle,
  FileJson,
  FolderKanban,
  Plus,
  Save,
  Cpu,
  Cloud,
  History,
  RefreshCw,
  GitCommit,
  Clock,
  SlidersHorizontal,
  Settings2,
} from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useCalmariaStore } from '@/store/useCalmariaStore';
import { useToast } from '@/hooks/use-toast';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { VisualJoltGuide } from '@/components/jolt/VisualJoltGuide';
import Editor from '@monaco-editor/react';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { transformJolt, type JoltEngineMode } from '@/lib/jolt-engine';
import {
  listJoltProjects,
  createJoltProject,
  updateJoltProject,
  deleteJoltProject,
  listJoltProjectVersions,
  rollbackJoltProjectVersion,
  type JoltProject,
  type JoltProjectVersion,
} from '@/services/joltService';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
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
const typeBadgeStyles: Record<string, string> = {
  string: 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30',
  number: 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30',
  boolean: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  Array: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/30',
  object: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
  null: 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
};

const SourceNode = ({ data }: NodeProps<SourceNodeType>) => {
  const badgeStyle = typeBadgeStyles[data.type] || typeBadgeStyles.string;

  return (
    <div className="relative group transition-all duration-150 hover:scale-[1.02]">
      <div className="border border-slate-200/90 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-500/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-xl px-3.5 py-2 shadow-sm hover:shadow-md min-w-[210px] flex items-center justify-between gap-3 transition-all">
        <span className="text-xs font-code font-medium text-slate-800 dark:text-slate-200 truncate">
          {data.label}
        </span>
        <Badge className={cn('text-[10px] h-4 px-1.5 font-code font-bold shrink-0 border shadow-none', badgeStyle)}>
          {data.type}
        </Badge>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-sky-500 !border-2 !border-white dark:!border-slate-900 !rounded-full shadow-sm !right-[-6px]"
      />
    </div>
  );
};

const TargetNode = ({ data }: NodeProps<TargetNodeType>) => {
  const badgeStyle = typeBadgeStyles[data.type] || typeBadgeStyles.string;

  return (
    <div className="relative group transition-all duration-150 hover:scale-[1.02]">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white dark:!border-slate-900 !rounded-full shadow-sm !left-[-6px]"
      />
      <div className="border border-slate-200/90 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-xl px-3.5 py-2 shadow-sm hover:shadow-md min-w-[210px] flex items-center justify-between gap-3 transition-all">
        <span className="text-xs font-code font-medium text-slate-800 dark:text-slate-200 truncate">
          {data.label}
        </span>
        <Badge className={cn('text-[10px] h-4 px-1.5 font-code font-bold shrink-0 border shadow-none', badgeStyle)}>
          {data.type}
        </Badge>
      </div>
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

  if (Array.isArray(jsonObj)) {
    const arrayPrefix = prefix ? `${prefix}[*]` : '[*]';
    if (jsonObj.length > 0 && typeof jsonObj[0] === 'object' && jsonObj[0] !== null) {
      paths.push(...flattenJsonToPaths(jsonObj[0], arrayPrefix));
    } else {
      paths.push({ path: arrayPrefix, type: 'Array' });
    }
    return paths;
  }

  for (const key in jsonObj) {
    if (Object.prototype.hasOwnProperty.call(jsonObj, key)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      const value = jsonObj[key];
      const type = Array.isArray(value) ? 'Array' : value === null ? 'null' : typeof value;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        paths.push(...flattenJsonToPaths(value, newPrefix));
      } else if (Array.isArray(value)) {
        const arrayPrefix = `${newPrefix}[*]`;
        if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
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

interface GenerateSpecOptions {
  mode: 'smarthub' | 'direct';
  entityName?: string;
  inputJson?: string;
  targetJson?: string;
}

const generateJoltSpec = (mappings: Mapping[], options: GenerateSpecOptions) => {
  const { mode = 'smarthub', entityName = '', inputJson = '', targetJson = '' } = options;

  let sObj: any = {};
  let tObj: any = {};
  try { sObj = JSON.parse(inputJson || '{}'); } catch {}
  try { tObj = JSON.parse(targetJson || '{}'); } catch {}

  const targetSample = Array.isArray(tObj)
    ? tObj[0] || {}
    : Array.isArray(tObj?.items)
      ? tObj.items[0] || {}
      : tObj;
  const targetKeysWithValues: Record<string, any> = {};
  if (targetSample && typeof targetSample === 'object') {
    Object.entries(targetSample).forEach(([k, v]) => {
      targetKeysWithValues[k] = v;
    });
  }

  const mappedTargetCleanSet = new Set(
    mappings.map((m) => m.target.replace(/^(0\.|\[\*\]\.|items\[\*\]\.)/, '')),
  );

  const inputSampleItem = Array.isArray(sObj?.items)
    ? sObj.items[0]
    : Array.isArray(sObj)
      ? sObj[0]
      : sObj;

  const findInputKey = (candidates: string[]) => {
    if (!inputSampleItem || typeof inputSampleItem !== 'object') return null;
    const lowerCandidates = candidates.map((c) => c.toLowerCase());
    return (
      Object.keys(inputSampleItem).find((k) => lowerCandidates.includes(k.toLowerCase())) || null
    );
  };

  const idSrc =
    findInputKey(['id', 'promotionId', 'codigo', 'idRetaguarda']) ||
    mappings
      .find((m) => m.target.toLowerCase().includes('retaguarda') || m.target.toLowerCase().includes('id'))
      ?.source.split('.')
      .pop()
      ?.replace('[*]', '') ||
    'id';

  const branchSrc =
    findInputKey(['branchId', 'codigoFilial', 'filial', 'idLoja']) ||
    mappings
      .find((m) => m.target.toLowerCase().includes('loja') || m.target.toLowerCase().includes('proprietario'))
      ?.source.split('.')
      .pop()
      ?.replace('[*]', '');

  const dateSrc =
    findInputKey(['lastChangeDate', 'dataUltimaAtualizacao', 'startDate', 'dataAlteracao', 'data']) ||
    'lastChangeDate';

  // Deduzir nome da entidade se não fornecido
  let resolvedEntity = entityName.trim();
  if (!resolvedEntity) {
    const allKeysStr = (
      Object.keys(targetKeysWithValues).join(' ') +
      ' ' +
      (inputSampleItem ? Object.keys(inputSampleItem).join(' ') : '')
    ).toLowerCase();

    if (allKeysStr.includes('vigencia') || allKeysStr.includes('promotion') || allKeysStr.includes('oferta')) {
      resolvedEntity = 'CAMPANHA-OFERTA';
    } else if (allKeysStr.includes('endereco') || allKeysStr.includes('receiver') || allKeysStr.includes('bairro')) {
      resolvedEntity = 'ENDERECO-ENTREGA-CLIENTE';
    } else if (allKeysStr.includes('plano') || allKeysStr.includes('parcelas') || allKeysStr.includes('prazos')) {
      resolvedEntity = 'PLANO-PAGAMENTO';
    } else if (allKeysStr.includes('cliente') || allKeysStr.includes('customer')) {
      resolvedEntity = 'CLIENTE';
    } else if (allKeysStr.includes('produto') || allKeysStr.includes('product')) {
      resolvedEntity = 'PRODUTO';
    } else {
      resolvedEntity = 'INTEGRACAO-DADOS';
    }
  }

  const slugEntity = resolvedEntity.toLowerCase().replace(/_/g, '-');
  const upperEntity = resolvedEntity.toUpperCase().replace(/-/g, '_');

  // MODO SMARTHUB (Envelope _attr_access)
  if (mode === 'smarthub') {
    const spec: any[] = [];

    // 1. base64ToObject (Apenas se o JSON de entrada possuir campo base64: conteudo)
    const hasConteudoTag = inputJson.includes('"conteudo"') || (inputSampleItem && typeof inputSampleItem === 'object' && 'conteudo' in inputSampleItem);

    if (hasConteudoTag) {
      spec.push({
        operation: 'custom-totvs',
        spec: {
          data: {
            '*': {
              conteudo: '=base64ToObject',
            },
          },
        },
      });
    }

    // 2. idExterno, idInterno, tipoIdInterno
    const idExternoParts = [`'pdvsync-${slugEntity}-'`];
    if (idSrc) idExternoParts.push(`@(1,${idSrc})`);
    if (branchSrc) idExternoParts.push(`@(1,${branchSrc})`);
    if (dateSrc) idExternoParts.push(`@(1,${dateSrc})`);

    spec.push({
      operation: 'modify-overwrite-beta',
      spec: {
        items: {
          '*': {
            idExterno: `=concat(${idExternoParts.join(", '-', ")})`,
            idInterno: idSrc ? `=concat('', @(1,${idSrc}))` : "=concat('', @(1,id))",
            tipoIdInterno: `PDVSYNC-${upperEntity}`,
          },
        },
      },
    });

    // 3. Shift
    const shiftSpecItems: any = {
      tipoIdInterno: 'tipoIdInterno',
      idExterno: 'idExterno',
      idInterno: 'idInterno',
    };

    mappings.forEach(({ source, target }) => {
      const targetClean = target.replace(/^(0\.|\[\*\]\.|items\[\*\]\.)/, '');
      const sourceClean = source.split('.').pop()?.replace('[*]', '') || '';
      if (!sourceClean || !targetClean) return;
      if (['idExterno', 'idInterno', 'tipoIdInterno'].includes(targetClean)) return;

      if (targetClean.toLowerCase() === 'situacao' || targetClean.toLowerCase() === 'ativo') {
        shiftSpecItems[sourceClean] = {
          true: { '#1': `items.[&3].${targetClean}` },
          false: { '#0': `items.[&3].${targetClean}` },
          '*': { '#0': `items.[&3].${targetClean}` },
        };
      } else if (targetClean.toLowerCase() === 'prioritaria') {
        shiftSpecItems[sourceClean] = {
          '0': { '#false': `items.[&3].${targetClean}` },
          '*': { '#true': `items.[&3].${targetClean}` },
        };
      } else {
        shiftSpecItems[sourceClean] = `items.[&1].${targetClean}`;
      }
    });

    spec.push({
      operation: 'shift',
      spec: { items: { '*': shiftSpecItems } },
    });

    // 4. Modify casting & formatação de data
    const castingSpec: any = {};
    mappings.forEach(({ target }) => {
      const targetClean = target.replace(/^(0\.|\[\*\]\.|items\[\*\]\.)/, '');
      const tLower = targetClean.toLowerCase();
      if (
        ['idretaguarda', 'idretguardaproduto', 'idretguardaloja', 'idclienteretaguarda', 'idretguardaprodutoembalagem', 'idcliente'].includes(
          tLower,
        )
      ) {
        castingSpec[targetClean] = '=toString';
      }
      if (tLower === 'situacao') {
        castingSpec[targetClean] = '=toInteger';
      }
      if (tLower === 'prioritaria') {
        castingSpec[targetClean] = '=toBoolean';
      }
      if (['valor', 'offerprice', 'preco', 'precovenda'].includes(tLower)) {
        castingSpec[targetClean] = '=toDouble';
      }
      if (tLower.includes('data') || tLower.includes('vigencia')) {
        castingSpec[targetClean] = `=concat(=replace(@(1,${targetClean}),'T',' '),'.000')`;
      }
    });

    if (Object.keys(castingSpec).length > 0) {
      spec.push({
        operation: 'modify-overwrite-beta',
        spec: { items: { '*': castingSpec } },
      });
    }

    // 5. Default spec: campos do destino não mapeados
    const defaultItems: any = {};

    Object.entries(targetKeysWithValues).forEach(([k, v]) => {
      if (['idExterno', 'idInterno', 'tipoIdInterno'].includes(k)) return;
      if (!mappedTargetCleanSet.has(k)) {
        if (k.toLowerCase() === 'idinquilino') {
          defaultItems[k] = '{{ID_INQUILINO}}';
        } else if (k.toLowerCase() === 'loteorigem') {
          defaultItems[k] = '{{LOTE_ORIGEM}}';
        } else if (k.toLowerCase() === 'idproprietario' && (v === 'string' || !v)) {
          defaultItems[k] = '{{MASTER_ID_PROPRIETARIO}}';
        } else {
          defaultItems[k] = v !== undefined ? v : 'string';
        }
      }
    });

    if (Object.keys(defaultItems).length > 0) {
      spec.push({
        operation: 'default',
        spec: {
          _attr_access: 'items',
          'items[]': {
            '*': defaultItems,
          },
        },
      });
    }

    return spec;
  }

  // MODO DIRETO (Array Puro [ { ... } ])
  const directSpec: any[] = [];
  const shiftSpecItems: any = {};
  const isSourceInItems = mappings.some((m) => m.source.includes('items['));

  mappings.forEach(({ source, target }) => {
    const targetClean = target.replace(/^(0\.|\[\*\]\.|items\[\*\]\.)/, '');
    const sourceClean = source.split('.').pop()?.replace('[*]', '') || '';
    if (!sourceClean || !targetClean) return;

    if (targetClean.toLowerCase() === 'situacao' || targetClean.toLowerCase() === 'ativo') {
      shiftSpecItems[sourceClean] = {
        true: { '#1': `[&3].${targetClean}` },
        false: { '#0': `[&3].${targetClean}` },
        '*': { '#0': `[&3].${targetClean}` },
      };
    } else if (targetClean.toLowerCase() === 'prioritaria') {
      shiftSpecItems[sourceClean] = {
        '0': { '#false': `[&3].${targetClean}` },
        '*': { '#true': `[&3].${targetClean}` },
      };
    } else {
      shiftSpecItems[sourceClean] = `[&1].${targetClean}`;
    }
  });

  if (isSourceInItems) {
    directSpec.push({
      operation: 'shift',
      spec: { items: { '*': shiftSpecItems } },
    });
  } else {
    directSpec.push({
      operation: 'shift',
      spec: { '*': shiftSpecItems },
    });
  }

  // Default para campos não mapeados
  const defaultItems: any = {};
  Object.entries(targetKeysWithValues).forEach(([k, v]) => {
    if (!mappedTargetCleanSet.has(k)) {
      defaultItems[k] = v !== undefined ? v : 'string';
    }
  });

  if (Object.keys(defaultItems).length > 0) {
    directSpec.push({
      operation: 'default',
      spec: {
        '*': defaultItems,
      },
    });
  }

  // Modify casting
  const castingSpec: any = {};
  mappings.forEach(({ target }) => {
    const targetClean = target.replace(/^(0\.|\[\*\]\.|items\[\*\]\.)/, '');
    const tLower = targetClean.toLowerCase();
    if (
      ['idretaguarda', 'idretguardaproduto', 'idretguardaloja', 'idclienteretaguarda', 'idretguardaprodutoembalagem', 'idcliente'].includes(
        tLower,
      )
    ) {
      castingSpec[targetClean] = '=toString';
    }
    if (tLower === 'situacao') {
      castingSpec[targetClean] = '=toInteger';
    }
    if (tLower === 'prioritaria') {
      castingSpec[targetClean] = '=toBoolean';
    }
    if (['valor', 'offerprice', 'preco', 'precovenda'].includes(tLower)) {
      castingSpec[targetClean] = '=toDouble';
    }
    if (tLower.includes('data') || tLower.includes('vigencia')) {
      castingSpec[targetClean] = `=concat(=replace(@(1,${targetClean}),'T',' '),'.000')`;
    }
  });

  if (Object.keys(castingSpec).length > 0) {
    directSpec.push({
      operation: 'modify-overwrite-beta',
      spec: { '*': castingSpec },
    });
  }

  directSpec.push({ operation: 'sort' });

  return directSpec;
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
          <code className="text-[9px] text-slate-400 dark:text-slate-500 font-code truncate block">
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
  useEnvelope: 'jolt_visual_use_envelope',
  envelopeTemplate: 'jolt_visual_envelope_template',
} as const;

export const DEFAULT_ENVELOPE_TEMPLATE = JSON.stringify(
  {
    tabela: {
      nome: 'PCINTEGRACAOROTASERVICO',
      campos: [
        {
          nome: 'SOMENTEATUALIZARINTEGRACAOCORE',
          valor: 'N',
        },
        {
          nome: 'ID',
          valor: 'WTA - Buscar dados',
        },
        {
          nome: 'IDEMPRESAAPI',
          valor: 'WINTHOR-WTA',
        },
        {
          nome: 'SERVICO',
          valor: 'WTA - Buscar dados',
        },
        {
          nome: 'LAYOUTCOMUNICACAO',
          valor: {
            name: 'WTA - Buscar dados',
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{TOKEN}}',
                },
                {
                  key: 'Accept',
                  value: '*/*',
                },
              ],
              url: {
                raw: '{{URL_BASE}}/winthor/venda/v0/servico/pdv-sync',
              },
            },
            response: [],
          },
        },
        {
          nome: 'LAYOUTTRANSFORMACAO',
          valor: '_JOLT_SPEC_',
        },
        {
          nome: 'ATIVO',
          valor: 'S',
        },
        {
          nome: 'AUTENTICADOR',
          valor: 'N',
        },
        {
          nome: 'DATASINCRONISMO',
          valor: '14-NOV-23',
        },
        {
          nome: 'REFRESHTOKEN',
          valor: '',
        },
        {
          nome: 'TIPOPROCESSO',
          valor: 'BUSCAR',
        },
      ],
    },
  },
  null,
  2
);

export function injectSpecIntoEnvelope(specArray: any[], templateStr: string): string {
  try {
    if (!templateStr || !templateStr.trim()) {
      return JSON.stringify(specArray, null, 2);
    }
    
    // Se tiver a tag literal "_JOLT_SPEC_"
    if (templateStr.includes('"_JOLT_SPEC_"')) {
      const specJson = JSON.stringify(specArray, null, 2);
      const injected = templateStr.replace('"_JOLT_SPEC_"', specJson);
      return JSON.stringify(JSON.parse(injected), null, 2);
    }
    
    if (templateStr.includes('_JOLT_SPEC_')) {
      const specJson = JSON.stringify(specArray, null, 2);
      const injected = templateStr.replace('_JOLT_SPEC_', specJson);
      return JSON.stringify(JSON.parse(injected), null, 2);
    }

    // Fallback: parse como JSON e procura campo LAYOUTTRANSFORMACAO
    const parsed = JSON.parse(templateStr);
    if (parsed?.tabela?.campos && Array.isArray(parsed.tabela.campos)) {
      const campo = parsed.tabela.campos.find((c: any) => c.nome === 'LAYOUTTRANSFORMACAO');
      if (campo) {
        campo.valor = specArray;
        return JSON.stringify(parsed, null, 2);
      }
    }

    return JSON.stringify(specArray, null, 2);
  } catch {
    return JSON.stringify(specArray, null, 2);
  }
}

export interface VisualProject {
  id: string;
  name: string;
  updatedAt: string;
  nodes: AppNode[];
  edges: Edge[];
  inputJson: string;
  targetJson: string;
  mappingMode: 'smarthub' | 'direct';
  entityName: string;
}

const VISUAL_PROJECTS_STORAGE_KEY = 'agileSpace_jolt_visual_projects';

function readVisualProjects(): VisualProject[] {
  try {
    const raw = localStorage.getItem(VISUAL_PROJECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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
  const [isCanvasPanelOpen, setIsCanvasPanelOpen] = useState(true);
  const [sourceExpanded, setSourceExpanded] = useState(true);
  const [targetExpanded, setTargetExpanded] = useState(true);

  // Modo de geração (SmartHub vs Direto) e Entidade
  const [mappingMode, setMappingMode] = useState<'smarthub' | 'direct'>('smarthub');
  const [entityName, setEntityName] = useState('');
  const [useEnvelopeTemplate, setUseEnvelopeTemplate] = useState(false);
  const [envelopeTemplate, setEnvelopeTemplate] = useState<string>(DEFAULT_ENVELOPE_TEMPLATE);
  const [templateDraft, setTemplateDraft] = useState<string>(DEFAULT_ENVELOPE_TEMPLATE);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewSpec, setPreviewSpec] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Preview Instantâneo (Execução local da Spec)
  const [previewTab, setPreviewTab] = useState<'spec' | 'output'>('spec');
  const [previewOutput, setPreviewOutput] = useState<string>('');
  const [isPreviewRunning, setIsPreviewRunning] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewExecutionTime, setPreviewExecutionTime] = useState<number | null>(null);
  const [previewEngine, setPreviewEngine] = useState<JoltEngineMode>('local');
  const [previewEngineUsed, setPreviewEngineUsed] = useState<JoltEngineMode>('local');

  // Projetos Visuais Salvos (Local)
  const [savedProjects, setSavedProjects] = useState<VisualProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectName, setCurrentProjectName] = useState<string>('Novo Mapeamento');
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState('');

  // Projetos na Nuvem (PostgreSQL) e Versionamento
  const [cloudProjects, setCloudProjects] = useState<JoltProject[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [currentCloudProjectId, setCurrentCloudProjectId] = useState<string | null>(null);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [projectVersions, setProjectVersions] = useState<JoltProjectVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [versionCommitMessage, setVersionCommitMessage] = useState('');
  const [saveToCloud, setSaveToCloud] = useState(true);

  // ── Single restore on mount — runs BEFORE any auto-save can fire ────────────
  useEffect(() => {
    const s = readSession();
    const projects = readVisualProjects();
    setSavedProjects(projects);

    // Only override defaults if localStorage has real values
    if (s.input  !== DEFAULT_INPUT)  setInputJson(s.input);
    if (s.target !== DEFAULT_TARGET) setTargetJson(s.target);
    if (s.nodes.length > 0)  setNodes(s.nodes);
    if (s.edges.length > 0)  setEdges(s.edges);

    const savedUseEnvelope = localStorage.getItem(STORAGE_KEYS.useEnvelope) === 'true';
    const savedTemplate = localStorage.getItem(STORAGE_KEYS.envelopeTemplate) || DEFAULT_ENVELOPE_TEMPLATE;
    setUseEnvelopeTemplate(savedUseEnvelope);
    setEnvelopeTemplate(savedTemplate);
    setTemplateDraft(savedTemplate);

    // Detecta importação vinda do Sandbox
    const importedFromSandbox = localStorage.getItem('jolt_visual_imported_from_sandbox');
    if (importedFromSandbox === 'true') {
      localStorage.removeItem('jolt_visual_imported_from_sandbox');
      setTimeout(() => {
        analyzeStructures(s.input, s.target);
        toast({
          title: "Importado da Sandbox!",
          description: "Estruturas analisadas e nós gerados automaticamente."
        });
      }, 350);
    }

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

  const analyzeStructures = useCallback((customIn?: string, customTarget?: string) => {
    try {
      const sObj = JSON.parse(customIn ?? inputJson ?? '{}');
      const tObj = JSON.parse(customTarget ?? targetJson ?? '{}');

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
        position: { x: 520, y: 50 + i * 72 },
      }));

      const allNodes = [...sourceNodes, ...targetNodes];
      setNodes((prevNodes) => {
        const prevNodesMap = new Map(prevNodes.map(n => [n.id, n]));
        const preservedNodes = allNodes.map(node => {
          const prevNode = prevNodesMap.get(node.id);
          if (prevNode) {
            return { ...node, position: prevNode.position };
          }
          return node;
        });
        localStorage.setItem(STORAGE_KEYS.nodes, JSON.stringify(preservedNodes));
        return preservedNodes;
      });

      // Preserva conexões existentes que ainda são válidas
      const validSourceIds = new Set(sourceNodes.map((n) => n.id));
      const validTargetIds = new Set(targetNodes.map((n) => n.id));

      setEdges((prevEdges) => {
        const preserved = prevEdges.filter(
          (e) => validSourceIds.has(e.source) && validTargetIds.has(e.target)
        );
        localStorage.setItem(STORAGE_KEYS.edges, JSON.stringify(preserved));

        if (preserved.length > 0) {
          toast({
            title: 'Campos atualizados!',
            description: `${preserved.length} conexão(ões) mantida(s). Clique em "Gerar Spec Jolt" para visualizar o resultado.`,
          });
        } else {
          toast({
            title: 'Estruturas analisadas!',
            description: 'Conecte os nós arrastando da esquerda para a direita ou clique em Auto-Mapear.',
          });
        }
        return preserved;
      });
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
          style: { stroke: '#10b981', strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
        };
        const newEdges = addEdge(connection, eds);
        localStorage.setItem(STORAGE_KEYS.edges, JSON.stringify(newEdges));
        return newEdges;
      });

      const srcName = params.source?.replace('source-', '') || 'campo';
      const tgtName = params.target?.replace('target-', '') || 'campo';
      toast({
        title: 'Campo conectado!',
        description: `${srcName} ➔ ${tgtName}. Clique em "Gerar Spec" no painel para ver a transformação.`,
      });
    },
    [setEdges, toast],
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

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      setEdges((eds) => {
        const deletedIds = new Set(deletedEdges.map((e) => e.id));
        const newEdges = eds.filter((e) => !deletedIds.has(e.id));
        localStorage.setItem(STORAGE_KEYS.edges, JSON.stringify(newEdges));
        return newEdges;
      });
      toast({
        title: 'Conexão removida!',
        description: `${deletedEdges.length} vínculo(s) excluído(s) com sucesso.`,
      });
    },
    [setEdges, toast],
  );

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, _edge: any) => {
      toast({
        title: 'Conexão Selecionada',
        description: 'Pressione Delete ou Backspace no teclado (ou dê duplo clique) para remover esta conexão.',
      });
    },
    [toast],
  );

  const handleClearSession = useCallback(() => {
    setInputJson(DEFAULT_INPUT);
    setTargetJson(DEFAULT_TARGET);
    setNodes([]);
    setEdges([]);
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    toast({ title: 'Sessão limpa!', description: 'Todos os mapeamentos foram removidos.' });
  }, [setNodes, setEdges, toast]);

  const autoMapNodes = useCallback(() => {
    const sourceNodes = nodes.filter((n) => n.type === 'source');
    const targetNodes = nodes.filter((n) => n.type === 'target');
    if (sourceNodes.length === 0 || targetNodes.length === 0) {
      toast({
        title: 'Analise os JSONs primeiro',
        description: 'Cole seus JSONs de entrada e saída e clique em "Analisar JSON" antes de auto-mapear.',
        variant: 'destructive',
      });
      return;
    }

    const SYNONYMS: Record<string, string[]> = {
      idretaguarda: ['id', 'promotionid', 'codigo', 'cod', 'identificador'],
      idclienteretaguarda: ['customerid', 'idcliente', 'clienteid', 'codcliente', 'client'],
      idretguardaloja: ['branchid', 'filial', 'codigofilial', 'loja', 'idloja'],
      idretguardaproduto: ['productid', 'produto', 'codigoproduto', 'codprod'],
      idretguardaprodutoembalagem: ['packingid', 'embalagem', 'codembalagem'],
      datahoravigenciainicial: ['startdate', 'datainicio', 'vigenciainicial', 'dtinicio'],
      datahoravigenciafinal: ['enddate', 'datafim', 'vigenciafinal', 'dtfim'],
      dataatualizacao: ['lastchangedate', 'dataalteracao', 'dataultimaatualizacao'],
      valor: ['offerprice', 'preco', 'precovenda', 'valoroferta', 'price'],
      situacao: ['active', 'ativo', 'status', 'situacao'],
      prioritaria: ['priority', 'prioridade'],
      cep: ['zipcode', 'receiverzipcode', 'cep'],
      cidade: ['city', 'municipio', 'cidade'],
      estado: ['state', 'uf', 'estado'],
      bairro: ['district', 'bairro'],
      endereco: ['address', 'logradouro', 'rua', 'endereco'],
      complemento: ['complement', 'complemento'],
      numero: ['number', 'numero', 'num'],
    };

    const newEdges: Edge[] = [];
    const usedSourceIds = new Set<string>();

    targetNodes.forEach((tNode) => {
      const tClean = tNode.data.label.replace(/^(0\.|\[\*\]\.|items\[\*\]\.)/, '').toLowerCase();

      // 1. Match exato
      let match = sourceNodes.find((sNode) => {
        const sClean = sNode.data.label.split('.').pop()?.replace('[*]', '').toLowerCase() || '';
        return sClean === tClean && !usedSourceIds.has(sNode.id);
      });

      // 2. Match por sinônimos
      if (!match && SYNONYMS[tClean]) {
        const synList = SYNONYMS[tClean];
        match = sourceNodes.find((sNode) => {
          const sClean = sNode.data.label.split('.').pop()?.replace('[*]', '').toLowerCase() || '';
          return synList.includes(sClean) && !usedSourceIds.has(sNode.id);
        });
      }

      if (match) {
        usedSourceIds.add(match.id);
        newEdges.push({
          id: `e-${match.id}-${tNode.id}`,
          source: match.id,
          target: tNode.id,
          animated: true,
          style: { stroke: '#10b981', strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
        });
      }
    });

    if (newEdges.length === 0) {
      toast({
        title: 'Nenhum campo equivalente encontrado',
        description: 'Você pode ligar os nós manualmente arrastando da esquerda para a direita.',
      });
      return;
    }

    setEdges(newEdges);
    localStorage.setItem(STORAGE_KEYS.edges, JSON.stringify(newEdges));
    toast({
      title: 'Auto-mapeamento concluído',
      description: `${newEdges.length} conexões detectadas e ligadas com sucesso.`,
    });
  }, [nodes, setEdges, toast]);

  const fetchCloudProjects = useCallback(async () => {
    setIsLoadingCloud(true);
    try {
      const projs = await listJoltProjects();
      setCloudProjects(projs);
    } catch (e: any) {
      console.warn('Projetos na nuvem indisponíveis:', e.message);
    } finally {
      setIsLoadingCloud(false);
    }
  }, []);

  useEffect(() => {
    fetchCloudProjects();
  }, [fetchCloudProjects]);

  const handleSaveProject = useCallback(async (nameToSave?: string) => {
    const finalName = (nameToSave || projectNameInput || entityName || currentProjectName || 'Mapeamento').trim();
    if (!finalName) {
      toast({ title: 'Nome obrigatório', description: 'Informe um nome para o projeto.', variant: 'destructive' });
      return;
    }

    // 1. Salva na Nuvem (PostgreSQL) se ativado
    if (saveToCloud) {
      try {
        const payload = {
          name: finalName,
          entityName,
          mappingMode,
          inputJson,
          targetJson,
          specJson: previewSpec || '[]',
          flowNodes: JSON.stringify(nodes),
          flowEdges: JSON.stringify(edges),
          commitMessage: versionCommitMessage.trim() || undefined,
        };

        let saved: JoltProject;
        if (currentCloudProjectId) {
          saved = await updateJoltProject(currentCloudProjectId, payload);
        } else {
          saved = await createJoltProject(payload);
          setCurrentCloudProjectId(saved.id);
        }
        fetchCloudProjects();
        toast({
          title: "Salvo na Nuvem (PostgreSQL)!",
          description: `"${finalName}" registrado no banco de dados.`
        });
      } catch (err: any) {
        toast({
          title: "Aviso de Nuvem",
          description: `Sincronização em nuvem: ${err.message}. O projeto foi salvo localmente.`,
          variant: "destructive"
        });
      }
    }

    // 2. Backup Local no localStorage
    const currentList = readVisualProjects();
    const targetId = currentProjectId || currentCloudProjectId || crypto.randomUUID();
    const newProject: VisualProject = {
      id: targetId,
      name: finalName,
      updatedAt: new Date().toISOString(),
      nodes,
      edges,
      inputJson,
      targetJson,
      mappingMode,
      entityName,
    };

    const existsIndex = currentList.findIndex(p => p.id === targetId);
    let updated: VisualProject[];
    if (existsIndex >= 0) {
      updated = [...currentList];
      updated[existsIndex] = newProject;
    } else {
      updated = [newProject, ...currentList];
    }

    localStorage.setItem(VISUAL_PROJECTS_STORAGE_KEY, JSON.stringify(updated));
    setSavedProjects(updated);
    setCurrentProjectId(targetId);
    setCurrentProjectName(finalName);
    setIsSaveDialogOpen(false);
    setProjectNameInput('');
    setVersionCommitMessage('');
    if (!saveToCloud) {
      toast({ title: 'Projeto Salvo!', description: `"${finalName}" foi salvo localmente.` });
    }
  }, [projectNameInput, entityName, currentProjectName, currentProjectId, currentCloudProjectId, saveToCloud, versionCommitMessage, previewSpec, nodes, edges, inputJson, targetJson, mappingMode, fetchCloudProjects, toast]);

  const handleLoadProject = useCallback((id: string) => {
    const p = savedProjects.find(item => item.id === id);
    if (!p) return;

    setCurrentProjectId(p.id);
    setCurrentCloudProjectId(null);
    setCurrentProjectName(p.name);
    setInputJson(p.inputJson);
    setTargetJson(p.targetJson);
    setNodes(p.nodes || []);
    setEdges(p.edges || []);
    setMappingMode(p.mappingMode || 'smarthub');
    setEntityName(p.entityName || '');

    localStorage.setItem(STORAGE_KEYS.input, p.inputJson);
    localStorage.setItem(STORAGE_KEYS.target, p.targetJson);
    localStorage.setItem(STORAGE_KEYS.nodes, JSON.stringify(p.nodes || []));
    localStorage.setItem(STORAGE_KEYS.edges, JSON.stringify(p.edges || []));

    toast({ title: 'Projeto Carregado', description: `"${p.name}" pronto para edição.` });
  }, [savedProjects, setNodes, setEdges, toast]);

  const handleLoadCloudProject = useCallback((proj: JoltProject) => {
    setCurrentCloudProjectId(proj.id);
    setCurrentProjectId(proj.id);
    setCurrentProjectName(proj.name);
    if (proj.inputJson) {
      setInputJson(proj.inputJson);
      localStorage.setItem(STORAGE_KEYS.input, proj.inputJson);
    }
    if (proj.targetJson) {
      setTargetJson(proj.targetJson);
      localStorage.setItem(STORAGE_KEYS.target, proj.targetJson);
    }
    if (proj.entityName) setEntityName(proj.entityName);
    if (proj.mappingMode) setMappingMode(proj.mappingMode as any);

    try {
      const parsedNodes = proj.flowNodes ? JSON.parse(proj.flowNodes) : [];
      const parsedEdges = proj.flowEdges ? JSON.parse(proj.flowEdges) : [];
      setNodes(parsedNodes);
      setEdges(parsedEdges);
      localStorage.setItem(STORAGE_KEYS.nodes, JSON.stringify(parsedNodes));
      localStorage.setItem(STORAGE_KEYS.edges, JSON.stringify(parsedEdges));
    } catch (e) {
      console.error('Erro ao restaurar nós do projeto na nuvem:', e);
    }

    toast({
      title: "Projeto Carregado da Nuvem",
      description: `"${proj.name}" (v${proj.versionCount || 1}) pronto para edição.`
    });
  }, [setNodes, setEdges, toast]);

  const handleOpenVersionHistory = useCallback(async (projId?: string) => {
    const targetId = projId || currentCloudProjectId;
    if (!targetId) {
      toast({
        title: "Projeto sem histórico na nuvem",
        description: "Salve o projeto na nuvem para acessar o controle de versões.",
        variant: "destructive"
      });
      return;
    }
    setIsLoadingVersions(true);
    setIsVersionModalOpen(true);
    try {
      const versions = await listJoltProjectVersions(targetId);
      setProjectVersions(versions);
    } catch (e: any) {
      toast({ title: "Erro ao carregar versões", description: e.message, variant: "destructive" });
    } finally {
      setIsLoadingVersions(false);
    }
  }, [currentCloudProjectId, toast]);

  const handleRollbackVersion = useCallback(async (versionId: string) => {
    if (!currentCloudProjectId) return;
    try {
      const restored = await rollbackJoltProjectVersion(currentCloudProjectId, versionId);
      handleLoadCloudProject(restored);
      setIsVersionModalOpen(false);
      toast({
        title: "Rollback Concluído!",
        description: "O projeto foi revertido para a versão selecionada com sucesso."
      });
      fetchCloudProjects();
    } catch (e: any) {
      toast({ title: "Falha no Rollback", description: e.message, variant: "destructive" });
    }
  }, [currentCloudProjectId, handleLoadCloudProject, fetchCloudProjects, toast]);

  const handleDeleteCloudProject = useCallback(async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await deleteJoltProject(id);
      if (currentCloudProjectId === id) {
        setCurrentCloudProjectId(null);
        setCurrentProjectName('Novo Mapeamento');
      }
      fetchCloudProjects();
      toast({ title: "Projeto excluído da nuvem" });
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
  }, [currentCloudProjectId, fetchCloudProjects, toast]);

  const handleDeleteProject = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const currentList = readVisualProjects();
    const updated = currentList.filter(p => p.id !== id);
    localStorage.setItem(VISUAL_PROJECTS_STORAGE_KEY, JSON.stringify(updated));
    setSavedProjects(updated);

    if (currentProjectId === id) {
      setCurrentProjectId(null);
      setCurrentProjectName('Novo Mapeamento');
    }
    toast({ title: 'Projeto Local Excluído' });
  }, [currentProjectId, toast]);

  const handleNewProject = useCallback(() => {
    setCurrentProjectId(null);
    setCurrentCloudProjectId(null);
    setCurrentProjectName('Novo Mapeamento');
    setInputJson(DEFAULT_INPUT);
    setTargetJson(DEFAULT_TARGET);
    setNodes([]);
    setEdges([]);
    setEntityName('');
    localStorage.removeItem(STORAGE_KEYS.nodes);
    localStorage.removeItem(STORAGE_KEYS.edges);
    localStorage.setItem(STORAGE_KEYS.input, DEFAULT_INPUT);
    localStorage.setItem(STORAGE_KEYS.target, DEFAULT_TARGET);
    toast({ title: 'Novo Mapeamento', description: 'Canvas limpo para novo design.' });
  }, [setNodes, setEdges, toast]);

  const handlePreviewSpec = useCallback(() => {
    const mappings: Mapping[] = edges.map((e) => ({
      id: e.id,
      source: e.source.replace('source-', ''),
      target: e.target.replace('target-', ''),
      type: 'direct',
    }));

    try {
      const rawSpec = generateJoltSpec(mappings, {
        mode: mappingMode,
        entityName,
        inputJson,
        targetJson,
      });

      const formattedSpec = useEnvelopeTemplate
        ? injectSpecIntoEnvelope(rawSpec, envelopeTemplate)
        : JSON.stringify(rawSpec, null, 2);

      setPreviewSpec(formattedSpec);
      setPreviewTab('spec');
      setPreviewOutput('');
      setPreviewError(null);
      setPreviewExecutionTime(null);
      setIsPreviewOpen(true);

      if (mappings.length === 0) {
        toast({
          title: 'Nenhum campo conectado',
          description: 'Exibindo estrutura padrão Jolt. Conecte nós arrastando da esquerda para a direita ou clique em Auto-Mapear.',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar Spec Jolt',
        description: err.message || 'Falha ao processar mapeamentos.',
        variant: 'destructive',
      });
    }
  }, [edges, mappingMode, entityName, inputJson, targetJson, useEnvelopeTemplate, envelopeTemplate, toast]);

  const handleRunPreview = useCallback(async () => {
    if (!previewSpec) return;
    setIsPreviewRunning(true);
    setPreviewError(null);
    const startTime = performance.now();
    try {
      const parsedInput = JSON.parse(inputJson || '{}');
      const parsedSpec = JSON.parse(previewSpec || '[]');
      const result = await transformJolt(parsedInput, parsedSpec, { engine: previewEngine });
      const duration = result.executionTimeMs ?? Math.round(performance.now() - startTime);
      setPreviewExecutionTime(duration);
      setPreviewEngineUsed(result.engine);
      setPreviewOutput(JSON.stringify(result.outputData, null, 2));
      setPreviewTab('output');
      toast({
        title: "Transformação executada!",
        description: `Concluída em ${duration}ms via ${result.engine === 'java' ? 'Java Bazaarvoice (Oficial)' : 'motor local (JS)'}.`
      });
    } catch (err: any) {
      setPreviewError(err.message || 'Erro ao executar o motor Jolt');
      setPreviewTab('output');
      toast({
        title: "Erro na Transformação",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsPreviewRunning(false);
    }
  }, [previewSpec, inputJson, previewEngine, toast]);

  const handleCopyOutput = useCallback(() => {
    if (!previewOutput) return;
    navigator.clipboard.writeText(previewOutput);
    toast({ title: 'Resultado copiado para a área de transferência!' });
  }, [previewOutput, toast]);

  const handleCopySpec = useCallback(() => {
    if (!previewSpec) return;
    navigator.clipboard.writeText(previewSpec);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    toast({ title: 'Spec copiada para a área de transferência!' });
  }, [previewSpec, toast]);

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

    const rawSpec = generateJoltSpec(mappings, {
      mode: mappingMode,
      entityName,
      inputJson,
      targetJson,
    });

    const finalSpec = useEnvelopeTemplate
      ? injectSpecIntoEnvelope(rawSpec, envelopeTemplate)
      : JSON.stringify(rawSpec, null, 2);

    // Persist everything before navigating
    localStorage.setItem(STORAGE_KEYS.spec,   finalSpec);
    localStorage.setItem(STORAGE_KEYS.input,  inputJson);
    localStorage.setItem(STORAGE_KEYS.target, targetJson);
    localStorage.setItem(STORAGE_KEYS.nodes,  JSON.stringify(nodes));
    localStorage.setItem(STORAGE_KEYS.edges,  JSON.stringify(edges));

    toast({ title: 'Especificação Jolt gerada com sucesso', description: 'Redirecionando para a Sandbox...' });
    router.push('/jolt/sandbox');
  }, [edges, nodes, inputJson, targetJson, mappingMode, entityName, router, toast]);

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
      <div className="flex flex-col h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950">

        {/* ── Header Bento ────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-5 py-2.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm shrink-0 relative z-20">
          {/* Left */}
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0"
            >
              <Link href="/jolt">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>

            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-lg flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
              <Workflow className="h-4 w-4 text-white" />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  Mapeador Visual Jolt
                </h1>
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold uppercase tracking-wider">
                  Visual
                </Badge>
                {currentProjectName && (
                  <span className="hidden sm:inline-block text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[140px]" title={currentProjectName}>
                    • {currentProjectName}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                Design de transformações por fluxo
              </p>
            </div>
          </div>

          {/* Center: Mapping counter status pill */}
          {mappingsCount > 0 ? (
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {mappingsCount} {mappingsCount === 1 ? 'conexão mapeada' : 'conexões mapeadas'}
              </span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>Arraste da esquerda para a direita para mapear</span>
            </div>
          )}

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <ThemeToggle className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-800" />

            {/* Calmaria — Modo Foco */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleCalmaria}
                  className={cn(
                    'h-8 w-8 rounded-lg border transition-all relative',
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
              <TooltipContent side="bottom" className="text-xs font-medium">
                {isFocusActive ? 'Calmaria ativa — sons e timer rodando' : 'Modo Foco — sons ambiente e timer'}
              </TooltipContent>
            </Tooltip>

            {/* Menu Projetos Salvos (Nuvem + Local) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 px-2.5 font-bold text-xs gap-1.5 border rounded-lg transition-all",
                    currentCloudProjectId
                      ? "text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20"
                      : "text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                  title="Gerenciar Projetos Salvos (Nuvem e Local)"
                >
                  {currentCloudProjectId ? (
                    <Cloud className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  ) : (
                    <FolderKanban className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span className="hidden sm:inline truncate max-w-[120px]">
                    {currentProjectName || 'Projetos'}
                  </span>
                  {currentCloudProjectId && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-code">
                      NUVEM
                    </span>
                  )}
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-2 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-2xl">
                {/* Seção 1: Projetos na Nuvem (PostgreSQL) */}
                <div className="flex items-center justify-between px-2 py-1 text-[9px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  <span className="flex items-center gap-1.5">
                    <Cloud className="h-3 w-3" />
                    Projetos na Nuvem ({cloudProjects.length})
                  </span>
                  <button
                    type="button"
                    onClick={fetchCloudProjects}
                    className="hover:text-purple-800 dark:hover:text-purple-200 p-0.5"
                    title="Atualizar lista da nuvem"
                  >
                    <RefreshCw className={cn("h-2.5 w-2.5", isLoadingCloud && "animate-spin")} />
                  </button>
                </div>
                {cloudProjects.length === 0 ? (
                  <div className="px-2 py-1.5 text-[11px] text-slate-400 italic">
                    Nenhum projeto salvo na nuvem
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-0.5">
                    {cloudProjects.map((proj) => (
                      <div
                        key={proj.id}
                        className={cn(
                          "flex items-center justify-between text-xs rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group cursor-pointer",
                          currentCloudProjectId === proj.id && "bg-purple-50 dark:bg-purple-950/40 font-bold text-purple-700 dark:text-purple-300"
                        )}
                        onClick={() => handleLoadCloudProject(proj)}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="truncate">{proj.name}</span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-code">
                            v{proj.versionCount || 1}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenVersionHistory(proj.id);
                            }}
                            className="p-1 hover:text-purple-600 dark:hover:text-purple-400"
                            title="Histórico de Versões"
                          >
                            <History className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCloudProject(proj.id, e)}
                            className="p-1 hover:text-red-500"
                            title="Excluir da Nuvem"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <DropdownMenuSeparator className="my-1.5 bg-slate-100 dark:bg-slate-800" />

                {/* Seção 2: Rascunhos Locais */}
                <div className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Rascunhos Locais ({savedProjects.length})
                </div>
                {savedProjects.length === 0 ? (
                  <div className="px-2 py-1 text-[11px] text-slate-400 italic">Nenhum rascunho local</div>
                ) : (
                  <div className="max-h-28 overflow-y-auto space-y-0.5">
                    {savedProjects.map((proj) => (
                      <div
                        key={proj.id}
                        className={cn(
                          "flex items-center justify-between text-xs rounded-lg px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group cursor-pointer",
                          !currentCloudProjectId && currentProjectId === proj.id && "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 font-bold"
                        )}
                        onClick={() => handleLoadProject(proj.id)}
                      >
                        <span className="truncate">{proj.name}</span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteProject(proj.id, e)}
                          className="text-slate-400 hover:text-red-500 p-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
                          title="Excluir local"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <DropdownMenuSeparator className="my-1.5 bg-slate-100 dark:bg-slate-800" />

                {currentCloudProjectId && (
                  <DropdownMenuItem
                    onClick={() => handleOpenVersionHistory(currentCloudProjectId)}
                    className="text-xs font-semibold cursor-pointer gap-2 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                  >
                    <History className="h-3.5 w-3.5" />
                    Histórico de Versões
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  onClick={() => {
                    setProjectNameInput(currentProjectName !== 'Novo Mapeamento' ? currentProjectName : '');
                    setIsSaveDialogOpen(true);
                  }}
                  className="text-xs font-semibold cursor-pointer gap-2 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  <Save className="h-3.5 w-3.5" />
                  Salvar Projeto...
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleNewProject}
                  className="text-xs font-semibold cursor-pointer gap-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Novo Mapeamento
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsGuideOpen(true)}
              className="h-8 px-3 font-semibold text-xs gap-1.5 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-200 dark:border-slate-800 rounded-lg"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Guia Visual
            </Button>
            <VisualJoltGuide open={isGuideOpen} onOpenChange={setIsGuideOpen} />

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1" />

            <Button
              onClick={handlePreviewSpec}
              variant="outline"
              size="sm"
              className="h-8 px-3 font-semibold text-xs gap-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg shadow-sm"
              title="Visualizar a Spec Jolt gerada em uma janela modal"
            >
              <Eye className="h-3.5 w-3.5" />
              Ver Spec
            </Button>

            <Button
              onClick={generateSpecFromEdges}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 h-8 rounded-lg shadow-sm gap-1.5 transition-all active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5" /> Abrir no Sandbox
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
            <TooltipContent side="right" className="text-xs font-medium">
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
                onEdgeClick={onEdgeClick}
                onEdgesDelete={onEdgesDelete}
                deleteKeyCode={['Backspace', 'Delete']}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.25 }}
                proOptions={{ hideAttribution: true }}
                className="bg-transparent h-full w-full"
              >
                <Background
                  color={isDark ? '#334155' : '#cbd5e1'}
                  variant={BackgroundVariant.Dots}
                  gap={20}
                  size={1.5}
                />
                <Controls
                  className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 !rounded-xl !overflow-hidden !shadow-xl [&>button]:!bg-white dark:[&>button]:!bg-slate-900 [&>button]:!border-b [&>button]:!border-slate-200 dark:[&>button]:!border-slate-800 [&>button]:!fill-slate-600 dark:[&>button]:!fill-slate-300 [&>button:hover]:!bg-slate-100 dark:[&>button:hover]:!bg-slate-800 [&>button:last-child]:!border-b-0"
                />

                {/* Canvas action panel */}
                <Panel position="top-right" className="!mt-4 !mr-4 z-50">
                  {isCanvasPanelOpen ? (
                    <div className="flex flex-col gap-2.5 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xl w-64 transition-all">
                      {/* Header do painel com contador */}
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                            Painel de Ações
                          </span>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full transition-all",
                            edges.length > 0
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                          )}>
                            {edges.length} {edges.length === 1 ? 'conexão' : 'conexões'}
                          </span>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsCanvasPanelOpen(false)}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg shrink-0"
                          title="Recolher painel"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Botão Primário em Destaque: Gerar / Ver Spec */}
                      <div className="flex flex-col gap-1.5 pt-0.5">
                        <Button
                          onClick={handlePreviewSpec}
                          size="sm"
                          className={cn(
                            "w-full h-9 text-xs font-bold justify-center gap-2 rounded-xl transition-all shadow-md",
                            edges.length > 0
                              ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/25 ring-2 ring-emerald-500/40"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          )}
                        >
                          <Sparkles className="h-4 w-4" />
                          <span>{edges.length > 0 ? `Gerar Spec Jolt (${edges.length})` : 'Gerar / Ver Spec'}</span>
                        </Button>

                        <Button
                          onClick={generateSpecFromEdges}
                          variant="outline"
                          size="sm"
                          className="w-full h-8 text-xs font-semibold justify-center gap-2 border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 rounded-xl transition-all"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-emerald-500" /> Abrir no Sandbox
                        </Button>
                      </div>

                      <div className="h-px bg-slate-100 dark:bg-slate-800 my-0.5" />

                      {/* Modo de Saída Jolt */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Modo de Saída
                        </label>
                        <Select value={mappingMode} onValueChange={(val: any) => setMappingMode(val)}>
                          <SelectTrigger className="h-8 px-2.5 text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl focus:ring-0">
                            <div className="flex items-center gap-2">
                              {mappingMode === 'smarthub' ? (
                                <Layers className="h-3.5 w-3.5 text-sky-500" />
                              ) : (
                                <Boxes className="h-3.5 w-3.5 text-emerald-500" />
                              )}
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="text-xs">
                            <SelectItem value="smarthub" className="text-xs font-medium">
                              <div className="flex items-center gap-2">
                                <Layers className="h-3.5 w-3.5 text-sky-500" />
                                <span>SmartHub (Envelope)</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="direct" className="text-xs font-medium">
                              <div className="flex items-center gap-2">
                                <Boxes className="h-3.5 w-3.5 text-emerald-500" />
                                <span>Direto (Array Puro)</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        {mappingMode === 'smarthub' && (
                          <div className="space-y-1 pt-1">
                            <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                              Entidade (Opcional)
                            </label>
                            <Input
                              value={entityName}
                              onChange={(e) => setEntityName(e.target.value)}
                              placeholder="Ex: PRECOPROMOCIONAL"
                              className="h-8 text-xs font-code uppercase bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500"
                              title="Nome da Entidade para idExterno e tipoIdInterno"
                            />
                          </div>
                        )}

                        {/* Configuração de Template de Integração (Winthor/Tabela) */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                              Envelope Integração
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const next = !useEnvelopeTemplate;
                                setUseEnvelopeTemplate(next);
                                localStorage.setItem(STORAGE_KEYS.useEnvelope, String(next));
                              }}
                              className={cn(
                                "text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all select-none",
                                useEnvelopeTemplate
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
                              )}
                            >
                              {useEnvelopeTemplate ? "ATIVADO" : "DESATIVADO"}
                            </button>
                          </div>

                          {useEnvelopeTemplate && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setTemplateDraft(envelopeTemplate);
                                setIsTemplateDialogOpen(true);
                              }}
                              className="w-full h-7 text-[11px] font-semibold justify-center gap-1.5 border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 rounded-xl transition-all"
                            >
                              <Settings2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              Configurar Envelope
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="h-px bg-slate-100 dark:bg-slate-800 my-0.5" />

                      {/* Ferramentas de Mapeamento */}
                      <div className="flex flex-col gap-1.5">
                        <Button
                          onClick={autoMapNodes}
                          size="sm"
                          variant="secondary"
                          className="h-8 text-xs font-semibold justify-start gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl shadow-none transition-all"
                        >
                          <Wand2 className="h-3.5 w-3.5 text-emerald-500" /> Auto-Mapear Campos
                        </Button>

                        <Button
                          onClick={() => analyzeStructures()}
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-semibold justify-start gap-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                          title="Recarrega os campos a partir dos JSONs das abas laterais (mantém conexões compatíveis)"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-slate-500" /> Recarregar Campos JSON
                        </Button>
                      </div>

                      <div className="h-px bg-slate-100 dark:bg-slate-800 my-0.5" />

                      {/* Ações de limpeza */}
                      <div className="flex gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEdges([])}
                          disabled={edges.length === 0}
                          className="flex-1 h-7 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-slate-200/60 dark:border-slate-800 rounded-lg transition-all disabled:opacity-30"
                          title="Apagar apenas as conexões desenhadas"
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Limpar
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearSession}
                          className="flex-1 h-7 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-slate-200/60 dark:border-slate-800 rounded-lg transition-all"
                          title="Resetar tudo — JSONs, nós e conexões"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" /> Resetar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setIsCanvasPanelOpen(true)}
                      size="sm"
                      className="h-9 px-3 text-xs font-bold bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 text-slate-700 dark:text-slate-200 rounded-xl shadow-lg gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                      title="Expandir Painel de Ações"
                    >
                      <SlidersHorizontal className="h-4 w-4 text-emerald-500" />
                      <span>Painel de Ações</span>
                      {edges.length > 0 && (
                        <span className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                          {edges.length}
                        </span>
                      )}
                    </Button>
                  )}
                </Panel>

                {/* Barra Flutuante de Ação Rápida no Canvas */}
                {edges.length > 0 && (
                  <Panel position="bottom-center" className="!mb-4">
                    <div className="flex items-center gap-3 px-4 py-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-emerald-500/40 rounded-2xl shadow-2xl">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {edges.length} {edges.length === 1 ? 'campo conectado' : 'campos conectados'}
                        </span>
                      </div>
                      <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                      <Button
                        onClick={handlePreviewSpec}
                        size="sm"
                        className="h-7 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm gap-1.5"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Gerar Spec Jolt
                      </Button>
                      <Button
                        onClick={generateSpecFromEdges}
                        variant="outline"
                        size="sm"
                        className="h-7 px-3 text-xs font-semibold border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl"
                      >
                        Abrir no Sandbox
                      </Button>
                    </div>
                  </Panel>
                )}
              </ReactFlow>
            ) : (
              /* Empty state */
              <div className="h-full flex flex-col items-center justify-center gap-6 select-none p-8">
                <div className="relative">
                  <div className="w-24 h-24 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex items-center justify-center border border-slate-200/80 dark:border-slate-800/80 shadow-lg">
                    <Workflow className="h-12 w-12 text-slate-400 dark:text-slate-600" />
                  </div>
                  <div className="absolute inset-0 rounded-3xl bg-emerald-500/5 dark:bg-emerald-500/10 pointer-events-none" />
                </div>

                <div className="text-center space-y-2 max-w-sm">
                  <h3 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-200">
                    Canvas de Mapeamento
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {sidebarOpen
                      ? 'Cole os seus JSONs de Origem e Destino no painel lateral e clique em Analisar JSON.'
                      : 'Abra o painel lateral para colar os seus JSONs e carregar os campos no canvas.'}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                    {!sidebarOpen && (
                      <Button
                        onClick={() => setSidebarOpen(true)}
                        variant="outline"
                        size="sm"
                        className="h-9 px-4 border-slate-200 dark:border-slate-800 font-semibold text-xs rounded-xl gap-2"
                      >
                        <PanelLeftOpen className="h-3.5 w-3.5" /> Abrir Painel
                      </Button>
                    )}
                    <Button
                      onClick={() => analyzeStructures()}
                      size="sm"
                      className="h-9 px-5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs rounded-xl shadow-md gap-2"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" /> Analisar JSON
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Modal de Pré-visualização da Spec Jolt com Execução Instantânea ─── */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-3xl h-[85vh] max-h-[88vh] flex flex-col p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <DialogHeader className="shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6">
                <div>
                  <DialogTitle className="text-base font-bold tracking-tight flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-500" />
                    Transformação Jolt
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Modo ativo:{' '}
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {mappingMode === 'smarthub'
                        ? 'SmartHub (Envelope _attr_access)'
                        : 'Direto (Array Puro)'}
                    </span>
                  </DialogDescription>
                </div>

                {/* Seletor de Abas: Spec vs Output */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('spec')}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      previewTab === 'spec'
                        ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                    )}
                  >
                    <FileJson className="h-3.5 w-3.5" />
                    Spec Jolt
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!previewOutput && !previewError) {
                        handleRunPreview();
                      } else {
                        setPreviewTab('output');
                      }
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      previewTab === 'output'
                        ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                    )}
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Resultado
                    {previewOutput && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
                    )}
                  </button>

                  {/* Seletor de Motor no Modal */}
                  <div className="flex items-center rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ml-2">
                    <button
                      type="button"
                      onClick={() => setPreviewEngine('local')}
                      className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold uppercase transition-all",
                        previewEngine === 'local'
                          ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                      title="Executar no navegador (JavaScript)"
                    >
                      JS Local
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewEngine('java')}
                      className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1",
                        previewEngine === 'java'
                          ? "bg-purple-600 text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                      title="Executar no servidor (Java Bazaarvoice oficial)"
                    >
                      <Cpu className="h-3 w-3" />
                      Java Oficial
                    </button>
                  </div>
                </div>
              </div>
            </DialogHeader>

            {/* Corpo do Modal */}
            <div className="flex-1 min-h-[380px] h-[52vh] w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 my-2 relative">
              {previewTab === 'spec' ? (
                <Editor
                  height="100%"
                  language="json"
                  theme={isDark ? 'vs-dark' : 'vs'}
                  value={previewSpec || '// Nenhuma especificação gerada ainda.'}
                  loading={
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                      <span className="text-xs">Carregando editor...</span>
                    </div>
                  }
                  onMount={(editor) => {
                    setTimeout(() => {
                      editor.layout();
                    }, 150);
                  }}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 12,
                    fontFamily: 'var(--font-jetbrains-mono), "JetBrains Mono", monospace',
                    wordWrap: 'on',
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    padding: { top: 12, bottom: 12 },
                    bracketPairColorization: { enabled: true },
                  }}
                />
              ) : previewError ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-red-50/50 dark:bg-red-950/20">
                  <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/40 text-red-600 flex items-center justify-center mb-3">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-red-700 dark:text-red-400 mb-1">
                    Falha na Execução do Motor
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md font-code mb-4 bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-red-200 dark:border-red-900/60">
                    {previewError}
                  </p>
                  <Button
                    size="sm"
                    onClick={handleRunPreview}
                    disabled={isPreviewRunning}
                    className="gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl"
                  >
                    {isPreviewRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    Tentar Novamente
                  </Button>
                </div>
              ) : previewOutput ? (
                <div className="h-full flex flex-col">
                  {previewExecutionTime !== null && (
                    <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          previewEngineUsed === 'java' ? "bg-purple-500" : "bg-emerald-500"
                        )} />
                        Saída gerada via {previewEngineUsed === 'java' ? 'Java Bazaarvoice (Oficial)' : 'motor local JS'}
                      </span>
                      <span className="font-code text-emerald-600 dark:text-emerald-400 font-bold">
                        {previewExecutionTime}ms
                      </span>
                    </div>
                  )}
                  <div className="flex-1">
                    <Editor
                      height="100%"
                      language="json"
                      theme={isDark ? 'vs-dark' : 'vs'}
                      value={previewOutput}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 12,
                        fontFamily: 'var(--font-jetbrains-mono), "JetBrains Mono", monospace',
                        wordWrap: 'on',
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                        padding: { top: 12, bottom: 12 },
                        bracketPairColorization: { enabled: true },
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-slate-50/50 dark:bg-slate-950/50">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mb-3">
                    <Play className="h-6 w-6 fill-current" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Prévia Pronta para Executar
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">
                    O motor local processará a especificação gerada contra o JSON de origem imediatamente.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleRunPreview}
                    disabled={isPreviewRunning}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm"
                  >
                    {isPreviewRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                    Executar Transformação Agora
                  </Button>
                </div>
              )}
            </div>

            <DialogFooter className="shrink-0 flex items-center justify-between sm:justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {previewTab === 'spec' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopySpec}
                    className="gap-2 font-semibold text-xs rounded-xl"
                  >
                    {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {isCopied ? 'Copiado!' : 'Copiar Spec'}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyOutput}
                    disabled={!previewOutput}
                    className="gap-2 font-semibold text-xs rounded-xl"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar Resultado
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRunPreview}
                  disabled={isPreviewRunning}
                  className="gap-1.5 font-semibold text-xs rounded-xl text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  {isPreviewRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                  {previewOutput ? 'Reexecutar' : 'Executar Prévia'}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsPreviewOpen(false)}
                  className="font-semibold text-xs rounded-xl"
                >
                  Fechar
                </Button>
                <Button
                  size="sm"
                  onClick={generateSpecFromEdges}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-2 rounded-xl shadow-sm"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Abrir no Sandbox
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Dialog Salvar Projeto Visual ─────────────────────────────────── */}
        <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
          <DialogContent className="max-w-md p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Save className="h-4 w-4 text-emerald-500" />
                Salvar Mapeamento Visual
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Guarde este diagrama, nós e regras para editar ou exportar a qualquer momento.
              </DialogDescription>
            </DialogHeader>
            <div className="py-3 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Nome do Projeto
                </label>
                <Input
                  placeholder="Ex: Campanhas PDVSync"
                  value={projectNameInput}
                  onChange={(e) => setProjectNameInput(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveProject();
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Mensagem da Versão (Changelog)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                </label>
                <Input
                  placeholder="Ex: v2: Adiciona mapeamento de itens e descontos"
                  value={versionCommitMessage}
                  onChange={(e) => setVersionCommitMessage(e.target.value)}
                  className="h-9 text-xs rounded-xl font-code text-[11px]"
                />
              </div>

              {/* Opção de Nuvem */}
              <div className="pt-1">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveToCloud}
                    onChange={(e) => setSaveToCloud(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-purple-600 focus:ring-purple-500 h-4 w-4"
                  />
                  <span className="flex items-center gap-1.5">
                    <Cloud className="h-3.5 w-3.5 text-purple-500" />
                    Sincronizar na Nuvem (PostgreSQL) com Versionamento
                  </span>
                </label>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSaveDialogOpen(false)}
                className="rounded-xl text-xs font-semibold"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => handleSaveProject()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Dialog Histórico de Versões ───────────────────────────────────── */}
        <Dialog open={isVersionModalOpen} onOpenChange={setIsVersionModalOpen}>
          <DialogContent className="max-w-lg p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-base font-bold flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <History className="h-4 w-4" />
                  Histórico de Versões
                </DialogTitle>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-code">
                  {projectVersions.length} {projectVersions.length === 1 ? 'versão' : 'versões'}
                </span>
              </div>
              <DialogDescription className="text-xs text-slate-500">
                Ponto de restauração e histórico de modificações salvas no banco de dados.
              </DialogDescription>
            </DialogHeader>

            <div className="py-3 max-h-[360px] overflow-y-auto space-y-2.5">
              {isLoadingVersions ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-xs">Carregando histórico...</span>
                </div>
              ) : projectVersions.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 italic">
                  Nenhuma versão registrada para este projeto.
                </div>
              ) : (
                projectVersions.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black px-2 py-0.5 rounded bg-purple-600 text-white font-code">
                          v{v.versionNumber}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(v.createdAt).toLocaleString('pt-BR')}
                        </span>
                        {v.authorName && (
                          <span className="text-[10px] text-slate-400 truncate">
                            • por {v.authorName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
                        {v.commitMessage || 'Snapshot da versão'}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRollbackVersion(v.id)}
                      className="shrink-0 h-7 px-2.5 text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg gap-1"
                      title="Restaurar o projeto para esta versão"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restaurar
                    </Button>
                  </div>
                ))
              )}
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsVersionModalOpen(false)}
                className="rounded-xl text-xs font-semibold"
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Modal de Configuração do Template de Integração (Winthor/PCINTEGRACAOROTASERVICO) ─── */}
        <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
          <DialogContent className="max-w-3xl h-[85vh] max-h-[88vh] flex flex-col p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <DialogHeader className="shrink-0">
              <div className="flex items-center justify-between pr-6">
                <div>
                  <DialogTitle className="text-base font-bold tracking-tight flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-emerald-500" />
                    Template do Envelope de Integração
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Defina o payload completo da tabela de integração (ex: Winthor / PCINTEGRACAOROTASERVICO).
                    Use <code className="text-emerald-600 dark:text-emerald-400 font-code font-bold bg-emerald-50 dark:bg-emerald-950/50 px-1 py-0.5 rounded border border-emerald-500/20">"_JOLT_SPEC_"</code> no valor do campo onde o array Jolt deve ser injetado.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 min-h-0 relative border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-950">
              <Editor
                height="100%"
                language="json"
                theme={isDark ? 'vs-dark' : 'light'}
                value={templateDraft}
                onChange={(val) => setTemplateDraft(val || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                }}
              />
            </div>

            <DialogFooter className="gap-2 shrink-0 pt-2 flex items-center justify-between sm:justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTemplateDraft(DEFAULT_ENVELOPE_TEMPLATE)}
                className="rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Restaurar Padrão Winthor
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsTemplateDialogOpen(false)}
                  className="rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setEnvelopeTemplate(templateDraft);
                    localStorage.setItem(STORAGE_KEYS.envelopeTemplate, templateDraft);
                    setIsTemplateDialogOpen(false);
                    toast({
                      title: "Template Salvo!",
                      description: "O envelope de integração foi atualizado e será usado na geração da Spec."
                    });
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold gap-1.5 shadow-md shadow-emerald-500/20"
                >
                  <Save className="h-3.5 w-3.5" />
                  Salvar Template
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
