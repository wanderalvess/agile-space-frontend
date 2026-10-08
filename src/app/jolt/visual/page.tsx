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
  Wrench,
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
  Network,
  ChevronRight,
  Lightbulb,
  ArrowUpRight,
} from 'lucide-react';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { QuickStart, QUICKSTART_STORAGE_KEY } from './QuickStart';
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
  parseLayoutText,
  layoutToCanvas,
  buildJsonFromNodePaths,
  applyMapperChanges,
  type ExistingEdge,
  type LayoutParts,
} from '@/lib/jolt-maintenance';
import { ExistingLayoutDialog, type LoadLayoutResult } from '@/components/jolt/ExistingLayoutDialog';
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

/** Layout existente em manutenção: o que já está na spec e o que o mapa consegue desenhar dele. */
interface BaseLayoutState {
  text: string;
  parts: LayoutParts;
  /** Ligações desenhadas a partir do layout: servem de base para saber o que mudou no mapa. */
  existing: ExistingEdge[];
  advancedCount: number;
  orphanCount: number;
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
      <div className="border border-border hover:border-sky-400 dark:hover:border-sky-500/80 bg-card rounded-xl px-3.5 py-2 shadow-sm hover:shadow-md min-w-[210px] flex items-center justify-between gap-3 transition-all">
        <span className="text-xs font-code font-medium text-foreground truncate">
          {data.label}
        </span>
        <Badge className={cn('text-[10px] h-4 px-1.5 font-code font-bold shrink-0 border shadow-none', badgeStyle)}>
          {data.type}
        </Badge>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-sky-500 !border-2 !border-card !rounded-full shadow-sm !right-[-6px]"
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
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-card !rounded-full shadow-sm !left-[-6px]"
      />
      <div className="border border-border hover:border-emerald-400 dark:hover:border-emerald-500/80 bg-card rounded-xl px-3.5 py-2 shadow-sm hover:shadow-md min-w-[210px] flex items-center justify-between gap-3 transition-all">
        <span className="text-xs font-code font-medium text-foreground truncate">
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
  const iconBtn = cn('h-7 w-7 rounded-lg text-muted-foreground', accentHover);
  return (
    <section
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300',
        isExpanded ? 'flex-1' : 'shrink-0',
      )}
    >
      {/* Cabeçalho no padrão do ToolPane: título à esquerda, ações à direita */}
      <header className={cn('flex shrink-0 items-center justify-between gap-2 px-3 py-1.5', isExpanded && 'border-b border-border/60')}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          className="group flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className={cn('h-2 w-2 shrink-0 rounded-full', dotColor, !isExpanded && 'opacity-50')} aria-hidden />
          <h2 className="truncate text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</h2>
          <span className="ml-1 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden>
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className={iconBtn} onClick={onPaste} aria-label={`Colar JSON em ${label}`}>
                <ClipboardPaste className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] font-bold">Colar JSON</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className={iconBtn} onClick={onFormat} aria-label={`Formatar JSON de ${label}`}>
                <Wand2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] font-bold">Formatar JSON</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* Editor area */}
      {isExpanded && (
        <div className="relative min-h-0 flex-1">
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
        <div className="border-t border-border/60 px-3 py-1.5">
          <code className="block truncate font-code text-[10px] text-muted-foreground">
            {value.trim().slice(0, 80)}…
          </code>
        </div>
      )}
    </section>
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
  baseLayout: 'jolt_visual_base_layout',
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

  // Modo manutenção: parte de um layout que já existe em vez de gerar do zero
  const [baseLayout, setBaseLayout] = useState<BaseLayoutState | null>(null);
  const [isBaseDialogOpen, setIsBaseDialogOpen] = useState(false);
  const [maintenanceNotes, setMaintenanceNotes] = useState<{ added: string[]; removed: string[]; errors: string[] } | null>(null);

  // Passo-a-passo de primeira visita (dispensável, persistido em localStorage)
  const [showQuickStart, setShowQuickStart] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(QUICKSTART_STORAGE_KEY) !== 'true') setShowQuickStart(true);
    } catch {
      setShowQuickStart(true);
    }
    // Em telas estreitas o painel de ações do canvas começa recolhido para não cobrir o mapa.
    try {
      if (window.matchMedia('(max-width: 639px)').matches) setIsCanvasPanelOpen(false);
    } catch {}
  }, []);
  const dismissQuickStart = useCallback(() => {
    setShowQuickStart(false);
    try { localStorage.setItem(QUICKSTART_STORAGE_KEY, 'true'); } catch {}
  }, []);
  const reopenQuickStart = useCallback(() => {
    setShowQuickStart(true);
    try { localStorage.removeItem(QUICKSTART_STORAGE_KEY); } catch {}
  }, []);

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
    const savedBase = localStorage.getItem(STORAGE_KEYS.baseLayout);
    if (importedFromSandbox === 'true') localStorage.removeItem('jolt_visual_imported_from_sandbox');
    if (savedBase) {
      // Layout existente: vindo da Sandbox monta o mapa; numa recarga só reativa o modo (o mapa já foi restaurado).
      setTimeout(() => {
        const res = loadBaseLayout(savedBase, { rebuildCanvas: importedFromSandbox === 'true', input: s.input });
        if (!res.ok) {
          localStorage.removeItem(STORAGE_KEYS.baseLayout);
          toast({ title: 'Layout existente não carregado', description: res.error, variant: 'destructive' });
        }
      }, 350);
    } else if (importedFromSandbox === 'true') {
      setTimeout(() => {
        analyzeStructures(s.input, s.target);
        toast({
          title: "Importado da Sandbox!",
          description: "Estruturas analisadas e nós gerados automaticamente."
        });
      }, 350);
    }

    setIsHydrated(true);
    document.title = `Mapeador Visual Jolt | Portal Tech V&D`;

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

  // ── Modo manutenção: partir de um layout que já existe ─────────────────────
  const loadBaseLayout = useCallback(
    (text: string, opts: { rebuildCanvas: boolean; input?: string }): LoadLayoutResult => {
      const parsed = parseLayoutText(text);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      let inputObj: unknown;
      try {
        inputObj = JSON.parse(opts.input ?? inputJson ?? '{}');
      } catch {
        return { ok: false, error: 'O JSON de entrada do mapeador não é válido. Corrija-o antes de carregar o layout.' };
      }
      const sPaths = flattenJsonToPaths(inputObj);
      const canvas = layoutToCanvas(parsed.parts.spec, new Set(sPaths.map((p) => p.path)));
      if (canvas.edges.length + canvas.advanced.length + canvas.orphans.length === 0) {
        return { ok: false, error: 'Este layout não tem nenhum mapeamento em uma operação shift.' };
      }

      if (opts.rebuildCanvas) {
        const targetObj = buildJsonFromNodePaths(canvas.edges.map((e) => e.target));
        setAndSaveTarget(JSON.stringify(targetObj, null, 2));
        const tPaths = flattenJsonToPaths(targetObj);
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
        const targetIds = new Set(targetNodes.map((n) => n.id));
        // Ligações que já existem no layout: tracejadas, para se distinguirem do que você ligar agora.
        const existingEdges: Edge[] = canvas.edges
          .filter((e) => targetIds.has(`target-${e.target}`))
          .map((e) => ({
            id: `existing-${e.mappingId}`,
            source: `source-${e.source}`,
            target: `target-${e.target}`,
            animated: false,
            style: { stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '6 4' },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
            data: { existing: true },
          }));
        setNodes(allNodes);
        setEdges(existingEdges);
        localStorage.setItem(STORAGE_KEYS.nodes, JSON.stringify(allNodes));
        localStorage.setItem(STORAGE_KEYS.edges, JSON.stringify(existingEdges));
      }

      setBaseLayout({
        text,
        parts: parsed.parts,
        existing: canvas.edges,
        advancedCount: canvas.advanced.length,
        orphanCount: canvas.orphans.length,
      });
      setMaintenanceNotes(null);
      try {
        localStorage.setItem(STORAGE_KEYS.baseLayout, text);
      } catch {
        /* sem armazenamento: o modo vale só nesta sessão */
      }
      if (opts.rebuildCanvas) {
        toast({
          title: 'Layout existente carregado',
          description: `${canvas.edges.length} ligação(ões) desenhada(s)${canvas.advanced.length ? `, ${canvas.advanced.length} avançada(s) preservada(s)` : ''}. Ligue só o que é novo.`,
        });
      }
      return { ok: true };
    },
    [inputJson, setNodes, setEdges, setAndSaveTarget, toast],
  );

  const exitMaintenance = useCallback(() => {
    setBaseLayout(null);
    setMaintenanceNotes(null);
    try {
      localStorage.removeItem(STORAGE_KEYS.baseLayout);
    } catch {
      /* ignora */
    }
    toast({ title: 'Saiu do modo manutenção', description: 'A spec volta a ser gerada do zero a partir das ligações do mapa.' });
  }, [toast]);

  /** Aplica no layout existente só o que mudou no mapa (ligações novas entram; as apagadas saem). */
  const buildMaintenanceSpec = useCallback(() => {
    if (!baseLayout) return null;
    const current = edges.map((e) => ({
      source: e.source.replace('source-', ''),
      target: e.target.replace('target-', ''),
    }));
    const res = applyMapperChanges(baseLayout.parts.spec, baseLayout.existing, current);
    const notes = { added: res.added, removed: res.removed, errors: res.errors };
    setMaintenanceNotes(notes);
    return { text: JSON.stringify(baseLayout.parts.rebuild(res.spec), null, 2), notes };
  }, [baseLayout, edges]);

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
    setBaseLayout(null);
    setMaintenanceNotes(null);
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

    if (baseLayout) {
      // Modo manutenção: acrescenta só o que ainda não tem ligação; o que já existe no layout fica.
      const taken = new Set(edges.map((e) => e.target));
      const fresh = newEdges.filter((e) => !taken.has(e.target));
      if (fresh.length === 0) {
        toast({ title: 'Nada novo para ligar', description: 'Os campos de saída com nome parecido já estão ligados.' });
        return;
      }
      const merged = [...edges, ...fresh];
      setEdges(merged);
      localStorage.setItem(STORAGE_KEYS.edges, JSON.stringify(merged));
      toast({ title: 'Auto-mapeamento concluído', description: `${fresh.length} ligação(ões) nova(s). As do layout foram mantidas.` });
      return;
    }

    setEdges(newEdges);
    localStorage.setItem(STORAGE_KEYS.edges, JSON.stringify(newEdges));
    toast({
      title: 'Auto-mapeamento concluído',
      description: `${newEdges.length} conexões detectadas e ligadas com sucesso.`,
    });
  }, [nodes, edges, baseLayout, setEdges, toast]);

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

    setBaseLayout(null);
    setMaintenanceNotes(null);
    localStorage.removeItem(STORAGE_KEYS.baseLayout);
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
    setBaseLayout(null);
    setMaintenanceNotes(null);
    localStorage.removeItem(STORAGE_KEYS.baseLayout);
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
    setBaseLayout(null);
    setMaintenanceNotes(null);
    localStorage.removeItem(STORAGE_KEYS.baseLayout);
    localStorage.removeItem(STORAGE_KEYS.nodes);
    localStorage.removeItem(STORAGE_KEYS.edges);
    localStorage.setItem(STORAGE_KEYS.input, DEFAULT_INPUT);
    localStorage.setItem(STORAGE_KEYS.target, DEFAULT_TARGET);
    toast({ title: 'Novo Mapeamento', description: 'Canvas limpo para novo design.' });
  }, [setNodes, setEdges, toast]);

  const handlePreviewSpec = useCallback(() => {
    if (baseLayout) {
      const built = buildMaintenanceSpec();
      if (!built) return;
      setPreviewSpec(built.text);
      setPreviewTab('spec');
      setPreviewOutput('');
      setPreviewError(null);
      setPreviewExecutionTime(null);
      setIsPreviewOpen(true);
      if (built.notes.errors.length > 0) {
        toast({ title: 'Algumas ligações não puderam ser aplicadas', description: built.notes.errors[0], variant: 'destructive' });
      }
      return;
    }
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
  }, [edges, baseLayout, buildMaintenanceSpec, mappingMode, entityName, inputJson, targetJson, useEnvelopeTemplate, envelopeTemplate, toast]);

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
    if (baseLayout) {
      const built = buildMaintenanceSpec();
      if (!built) return;
      if (built.notes.errors.length > 0) {
        toast({
          title: 'Algumas ligações não puderam ser aplicadas',
          description: `${built.notes.errors[0]}${built.notes.errors.length > 1 ? ` (e mais ${built.notes.errors.length - 1})` : ''}`,
          variant: 'destructive',
        });
        return;
      }
      localStorage.setItem(STORAGE_KEYS.spec, built.text);
      localStorage.setItem('jolt_visual_from_maintenance', 'true');
      localStorage.setItem(STORAGE_KEYS.input, inputJson);
      localStorage.setItem(STORAGE_KEYS.target, targetJson);
      localStorage.setItem(STORAGE_KEYS.nodes, JSON.stringify(nodes));
      localStorage.setItem(STORAGE_KEYS.edges, JSON.stringify(edges));
      toast({
        title: 'Layout atualizado',
        description: `${built.notes.added.length} adicionado(s), ${built.notes.removed.length} removido(s). Abrindo na Sandbox...`,
      });
      router.push('/jolt/sandbox');
      return;
    }
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
  }, [edges, nodes, baseLayout, buildMaintenanceSpec, inputJson, targetJson, mappingMode, entityName, router, toast]);

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
      <div className="flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-background text-foreground">

        {/* ── Cabeçalho unificado ───────────────────────────────────────────── */}
        <RoomHeader
          title="Mapeador Visual"
          toolIcon={<Network className="h-4 w-4" />}
          actions={
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Grupo: projetos salvos */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-8 gap-1.5 rounded-xl px-2.5 text-[10px] font-black uppercase tracking-wider',
                      currentCloudProjectId && 'border-primary/40 bg-primary/5 text-primary',
                    )}
                    aria-label="Projetos salvos (nuvem e local)"
                    title="Projetos salvos (nuvem e local)"
                  >
                    {currentCloudProjectId ? <Cloud className="h-3.5 w-3.5" aria-hidden /> : <FolderKanban className="h-3.5 w-3.5" aria-hidden />}
                    <span className="hidden max-w-[120px] truncate md:inline">{currentProjectName || 'Projetos'}</span>
                    {currentCloudProjectId && (
                      <span className="hidden rounded bg-primary/10 px-1.5 font-code text-[9px] text-primary lg:inline">NUVEM</span>
                    )}
                    <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl border-border bg-popover p-2 text-popover-foreground shadow-xl">
                  {/* Seção 1: Projetos na Nuvem (PostgreSQL) */}
                  <div className="flex items-center justify-between px-2 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Cloud className="h-3 w-3" aria-hidden />
                      Projetos na nuvem ({cloudProjects.length})
                    </span>
                    <button
                      type="button"
                      onClick={fetchCloudProjects}
                      className="rounded-md p-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title="Atualizar lista da nuvem"
                      aria-label="Atualizar lista da nuvem"
                    >
                      <RefreshCw className={cn('h-3 w-3', isLoadingCloud && 'animate-spin')} aria-hidden />
                    </button>
                  </div>
                  {cloudProjects.length === 0 ? (
                    <div className="px-2 py-1.5 text-[11px] italic text-muted-foreground">Nenhum projeto salvo na nuvem</div>
                  ) : (
                    <div className="max-h-40 space-y-0.5 overflow-y-auto">
                      {cloudProjects.map((proj) => (
                        <div
                          key={proj.id}
                          className={cn(
                            'group flex items-center justify-between rounded-lg px-1 text-xs transition-colors hover:bg-muted',
                            currentCloudProjectId === proj.id && 'bg-primary/10 font-bold text-primary',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => handleLoadCloudProject(proj)}
                            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="truncate">{proj.name}</span>
                            <span className="rounded bg-muted px-1 font-code text-[9px] text-muted-foreground">v{proj.versionCount || 1}</span>
                          </button>
                          <div className="flex items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenVersionHistory(proj.id);
                              }}
                              className="rounded-md p-1.5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              title="Histórico de versões"
                              aria-label={`Histórico de versões de ${proj.name}`}
                            >
                              <History className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteCloudProject(proj.id, e)}
                              className="rounded-md p-1.5 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              title="Excluir da nuvem"
                              aria-label={`Excluir ${proj.name} da nuvem`}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <DropdownMenuSeparator className="my-1.5 bg-border" />

                  {/* Seção 2: Rascunhos Locais */}
                  <div className="px-2 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Rascunhos locais ({savedProjects.length})
                  </div>
                  {savedProjects.length === 0 ? (
                    <div className="px-2 py-1 text-[11px] italic text-muted-foreground">Nenhum rascunho local</div>
                  ) : (
                    <div className="max-h-28 space-y-0.5 overflow-y-auto">
                      {savedProjects.map((proj) => (
                        <div
                          key={proj.id}
                          className={cn(
                            'group flex items-center justify-between rounded-lg px-1 text-xs transition-colors hover:bg-muted',
                            !currentCloudProjectId && currentProjectId === proj.id && 'bg-primary/10 font-bold text-primary',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => handleLoadProject(proj.id)}
                            className="min-w-0 flex-1 truncate rounded-lg px-1 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {proj.name}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteProject(proj.id, e)}
                            className="rounded-md p-1.5 text-muted-foreground opacity-70 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Excluir rascunho local"
                            aria-label={`Excluir rascunho local ${proj.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <DropdownMenuSeparator className="my-1.5 bg-border" />

                  {currentCloudProjectId && (
                    <DropdownMenuItem
                      onClick={() => handleOpenVersionHistory(currentCloudProjectId)}
                      className="cursor-pointer gap-2 rounded-xl text-xs font-semibold"
                    >
                      <History className="h-3.5 w-3.5 text-primary" aria-hidden />
                      Histórico de versões
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem
                    onClick={() => {
                      setProjectNameInput(currentProjectName !== 'Novo Mapeamento' ? currentProjectName : '');
                      setIsSaveDialogOpen(true);
                    }}
                    className="cursor-pointer gap-2 rounded-xl text-xs font-semibold"
                  >
                    <Save className="h-3.5 w-3.5 text-primary" aria-hidden />
                    Salvar projeto...
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleNewProject} className="cursor-pointer gap-2 rounded-xl text-xs font-semibold">
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    Novo mapeamento
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant={baseLayout ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setIsBaseDialogOpen(true)}
                className="hidden h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider md:inline-flex"
                aria-label="Partir de um layout existente"
                title="Mexer num layout que já existe: você liga só o que é novo e o resto fica como está"
              >
                <Wrench className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden lg:inline">Layout existente</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsGuideOpen(true)}
                className="hidden h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider md:inline-flex"
                aria-label="Abrir o guia visual"
              >
                <HelpCircle className="h-3.5 w-3.5" aria-hidden /> Guia
              </Button>
              <VisualJoltGuide open={isGuideOpen} onOpenChange={setIsGuideOpen} />

              <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" aria-hidden />

              {/* Grupo: gerar spec */}
              <Button
                onClick={handlePreviewSpec}
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider"
                aria-label="Ver a spec Jolt gerada e executar a prévia"
                title="Ver a spec Jolt gerada e executar a prévia"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden lg:inline">Ver spec</span>
              </Button>

              <Button
                onClick={generateSpecFromEdges}
                size="sm"
                className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider"
                aria-label="Gerar a spec e abrir na Sandbox"
                title="Gerar a spec e abrir na Sandbox"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">Abrir na Sandbox</span>
              </Button>

              <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
                <Link href="/jolt" aria-label="Voltar ao hub do Jolt">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> <span className="hidden sm:inline">Jolt</span>
                </Link>
              </Button>
            </div>
          }
        />

        {/* ── Faixa de contexto: trilha, descrição e estado ─────────────────── */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 px-4 py-2 md:px-6">
          <nav aria-label="Trilha" className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <Link href="/jolt" className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Jolt</Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <span>Mapeador Visual</span>
            {currentProjectName && (
              <span className="hidden max-w-[160px] truncate font-semibold normal-case tracking-normal sm:inline" title={currentProjectName}>
                • {currentProjectName}
              </span>
            )}
          </nav>
          <p className="hidden min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground md:block">
            Desenhe o mapa de campos e a spec Jolt é gerada para você.
          </p>
          <div className="ml-auto flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold',
                mappingsCount > 0 ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground',
              )}
              aria-live="polite"
            >
              {mappingsCount > 0 && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden />}
              {mappingsCount} {mappingsCount === 1 ? 'conexão' : 'conexões'}
            </span>
            {!showQuickStart && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={reopenQuickStart}
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                aria-label="Rever o passo-a-passo"
                title="Rever o passo-a-passo"
              >
                <Lightbulb className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-pressed={sidebarOpen}
              aria-label={sidebarOpen ? 'Ocultar painéis de JSON' : 'Mostrar painéis de JSON'}
              className="h-7 gap-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider"
            >
              {sidebarOpen ? <PanelLeftClose className="h-3.5 w-3.5" aria-hidden /> : <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden />}
              <span className="hidden sm:inline">JSONs</span>
            </Button>
          </div>
        </div>

        {baseLayout && (
          <div role="status" className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-primary/20 bg-primary/5 px-4 py-2 text-xs md:px-6">
            <Wrench className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <p className="min-w-0 flex-1 leading-relaxed text-muted-foreground">
              <strong className="font-bold text-foreground">Modo manutenção.</strong>{' '}
              {baseLayout.existing.length} ligação(ões) do layout aparecem tracejadas. Ligue só o que é novo; apagar uma tracejada tira o campo do layout.
              {baseLayout.advancedCount > 0 && <> {baseLayout.advancedCount} mapeamento(s) condicional(is) ou avançado(s) não aparecem no mapa e ficam como estão.</>}
              {baseLayout.orphanCount > 0 && <> {baseLayout.orphanCount} usa(m) campos que não estão no JSON de entrada atual e também ficam como estão.</>}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsBaseDialogOpen(true)} className="h-7 rounded-lg px-2 text-[10px] font-black uppercase tracking-wider">Trocar layout</Button>
            <Button type="button" variant="ghost" size="sm" onClick={exitMaintenance} className="h-7 rounded-lg px-2 text-[10px] font-black uppercase tracking-wider">Sair do modo</Button>
          </div>
        )}

        {/* ── Corpo zero-scroll ─────────────────────────────────────────────── */}
        <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 md:p-4">
          {showQuickStart && <QuickStart onDismiss={dismissQuickStart} />}

          <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
            {/* Painéis de JSON (empilham acima do canvas em telas estreitas) */}
            {sidebarOpen && (
              <aside
                aria-label="JSONs de origem e destino"
                className="flex min-h-0 w-full shrink-0 flex-col gap-3 max-lg:h-[42%] lg:w-[420px] xl:w-[460px]"
              >
                <EditorPanel
                  label="Origem (JSON de entrada)"
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

                <EditorPanel
                  label="Destino (JSON de saída de exemplo)"
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
              </aside>
            )}

            {/* ── ReactFlow Canvas ───────────────────────────────────────────── */}
            <section aria-label="Canvas de mapeamento" className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-border bg-muted/30 shadow-sm">
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
                  className="h-full w-full bg-transparent"
                >
                  <Background
                    color={isDark ? '#334155' : '#cbd5e1'}
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={1.5}
                  />
                  <Controls
                    className="!overflow-hidden !rounded-xl !border !border-border !bg-card !shadow-md [&>button]:!border-b [&>button]:!border-border [&>button]:!bg-card [&>button]:!fill-foreground [&>button:hover]:!bg-muted [&>button:last-child]:!border-b-0"
                  />

                  {/* Painel de ações do canvas */}
                  <Panel position="top-right" className="!m-2 z-50 sm:!m-3">
                    {isCanvasPanelOpen ? (
                      <section
                        aria-label="Painel de ações"
                        className="flex max-h-[calc(100dvh-14rem)] w-[min(16.5rem,calc(100vw-5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
                      >
                        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                          <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            Painel de ações
                          </h2>
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                              edges.length > 0 ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground',
                            )}>
                              {edges.length} {edges.length === 1 ? 'conexão' : 'conexões'}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setIsCanvasPanelOpen(false)}
                              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                              title="Recolher painel"
                              aria-label="Recolher painel de ações"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </header>

                        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                          {/* Gerar */}
                          <div className="space-y-1.5">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Gerar</h3>
                            <Button
                              onClick={handlePreviewSpec}
                              size="sm"
                              className="h-9 w-full justify-center gap-2 rounded-xl text-xs font-bold"
                            >
                              <Sparkles className="h-4 w-4" aria-hidden />
                              <span>{edges.length > 0 ? `Gerar spec Jolt (${edges.length})` : 'Gerar / ver spec'}</span>
                            </Button>
                            <Button
                              onClick={generateSpecFromEdges}
                              variant="outline"
                              size="sm"
                              className="h-8 w-full justify-center gap-2 rounded-xl text-xs font-semibold"
                            >
                              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> Abrir na Sandbox
                            </Button>
                          </div>

                          {/* Modo de saída */}
                          <div className="space-y-1.5 border-t border-border/60 pt-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                              Modo de saída
                            </label>
                            <Select value={mappingMode} onValueChange={(val: any) => setMappingMode(val)}>
                              <SelectTrigger className="h-8 rounded-xl border-border bg-background px-2.5 text-xs font-medium">
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
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                  Entidade (opcional)
                                </label>
                                <Input
                                  value={entityName}
                                  onChange={(e) => setEntityName(e.target.value)}
                                  placeholder="Ex: PRECOPROMOCIONAL"
                                  className="h-8 rounded-xl border-border bg-background font-code text-xs uppercase placeholder:text-muted-foreground"
                                  title="Nome da Entidade para idExterno e tipoIdInterno"
                                />
                              </div>
                            )}

                            {/* Template de Integração (Winthor/Tabela) */}
                            <div className="space-y-1.5 pt-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                  Envelope de integração
                                </span>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={useEnvelopeTemplate}
                                  aria-label="Usar envelope de integração"
                                  onClick={() => {
                                    const next = !useEnvelopeTemplate;
                                    setUseEnvelopeTemplate(next);
                                    localStorage.setItem(STORAGE_KEYS.useEnvelope, String(next));
                                  }}
                                  className={cn(
                                    'select-none rounded-full border px-2 py-0.5 text-[9px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    useEnvelopeTemplate
                                      ? 'border-primary/30 bg-primary/10 text-primary'
                                      : 'border-border bg-muted text-muted-foreground',
                                  )}
                                >
                                  {useEnvelopeTemplate ? 'ATIVADO' : 'DESATIVADO'}
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
                                  className="h-7 w-full justify-center gap-1.5 rounded-xl text-[11px] font-semibold"
                                >
                                  <Settings2 className="h-3.5 w-3.5 text-primary" aria-hidden />
                                  Configurar envelope
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Mapear */}
                          <div className="space-y-1.5 border-t border-border/60 pt-3">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mapear</h3>
                            <Button
                              onClick={autoMapNodes}
                              size="sm"
                              variant="secondary"
                              className="h-8 w-full justify-start gap-2 rounded-xl text-xs font-semibold shadow-none"
                            >
                              <Wand2 className="h-3.5 w-3.5 text-primary" aria-hidden /> Auto-mapear campos
                            </Button>
                            <Button
                              onClick={() => analyzeStructures()}
                              variant="outline"
                              size="sm"
                              className="h-8 w-full justify-start gap-2 rounded-xl text-xs font-semibold"
                              title="Recarrega os campos a partir dos JSONs dos painéis (mantém conexões compatíveis)"
                            >
                              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> Recarregar campos JSON
                            </Button>
                          </div>

                          {/* Limpar */}
                          <div className="space-y-1.5 border-t border-border/60 pt-3">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Limpar</h3>
                            <div className="flex gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEdges([])}
                                disabled={edges.length === 0}
                                className="h-7 flex-1 rounded-lg text-[11px] font-semibold hover:border-destructive/40 hover:text-destructive"
                                title="Apagar apenas as conexões desenhadas"
                              >
                                <Trash2 className="mr-1 h-3 w-3" aria-hidden /> Conexões
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleClearSession}
                                className="h-7 flex-1 rounded-lg text-[11px] font-semibold hover:border-destructive/40 hover:text-destructive"
                                title="Resetar tudo: JSONs, nós e conexões"
                              >
                                <RotateCcw className="mr-1 h-3 w-3" aria-hidden /> Tudo
                              </Button>
                            </div>
                          </div>
                        </div>
                      </section>
                    ) : (
                      <Button
                        onClick={() => setIsCanvasPanelOpen(true)}
                        variant="outline"
                        size="sm"
                        className="h-9 gap-2 rounded-xl bg-card px-3 text-xs font-bold shadow-md"
                        title="Expandir painel de ações"
                        aria-label="Expandir painel de ações"
                      >
                        <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden />
                        <span className="hidden sm:inline">Painel de ações</span>
                        {edges.length > 0 && (
                          <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                            {edges.length}
                          </span>
                        )}
                      </Button>
                    )}
                  </Panel>

                  {/* Barra flutuante de ação rápida */}
                  {edges.length > 0 && (
                    <Panel position="bottom-center" className="!mb-3 hidden sm:block">
                      <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-card px-4 py-2 shadow-lg">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" aria-hidden />
                          <span className="text-xs font-bold text-foreground">
                            {edges.length} {edges.length === 1 ? 'campo conectado' : 'campos conectados'}
                          </span>
                        </div>
                        <div className="h-4 w-px bg-border" aria-hidden />
                        <Button onClick={handlePreviewSpec} size="sm" className="h-7 gap-1.5 rounded-xl px-3 text-xs font-bold">
                          <Sparkles className="h-3.5 w-3.5" aria-hidden />
                          Gerar spec Jolt
                        </Button>
                        <Button onClick={generateSpecFromEdges} variant="outline" size="sm" className="h-7 rounded-xl px-3 text-xs font-semibold">
                          Abrir na Sandbox
                        </Button>
                      </div>
                    </Panel>
                  )}
                </ReactFlow>
              ) : (
                /* Estado vazio */
                <div className="flex h-full select-none flex-col items-center justify-center gap-5 overflow-y-auto p-6">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-card shadow-sm">
                    <Workflow className="h-10 w-10 text-muted-foreground" aria-hidden />
                  </div>

                  <div className="max-w-sm space-y-2 text-center">
                    <h2 className="font-headline text-xl font-black uppercase tracking-tight text-foreground">
                      Canvas de mapeamento
                    </h2>
                    <p className="text-xs font-medium leading-relaxed text-muted-foreground">
                      {sidebarOpen
                        ? 'Cole os seus JSONs de origem e destino nos painéis e clique em Analisar JSON para carregar os campos aqui.'
                        : 'Abra os painéis de JSON para colar origem e destino e carregar os campos no canvas.'}
                    </p>
                    <div className="flex flex-col justify-center gap-2 pt-2 sm:flex-row">
                      {!sidebarOpen && (
                        <Button
                          onClick={() => setSidebarOpen(true)}
                          variant="outline"
                          size="sm"
                          className="h-9 gap-2 rounded-xl px-4 text-xs font-semibold"
                        >
                          <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden /> Abrir painéis
                        </Button>
                      )}
                      <Button
                        onClick={() => analyzeStructures()}
                        size="sm"
                        className="h-9 gap-2 rounded-xl px-5 text-xs font-semibold"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden /> Analisar JSON
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </main>

        <ExistingLayoutDialog
          open={isBaseDialogOpen}
          onOpenChange={setIsBaseDialogOpen}
          onLoad={(text) => loadBaseLayout(text, { rebuildCanvas: true })}
        />

        {/* ── Modal de Pré-visualização da Spec Jolt com Execução Instantânea ─── */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="flex h-[85dvh] max-h-[88dvh] max-w-3xl flex-col rounded-2xl border border-border bg-card p-4 shadow-2xl sm:p-6">
            <DialogHeader className="shrink-0">
              <div className="flex flex-col justify-between gap-3 pr-6 sm:flex-row sm:items-center">
                <div>
                  <DialogTitle className="flex items-center gap-2 font-headline text-base font-black uppercase tracking-tight">
                    <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                    Transformação Jolt
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                    Modo ativo:{' '}
                    <span className="font-semibold text-primary">
                      {mappingMode === 'smarthub'
                        ? 'SmartHub (Envelope _attr_access)'
                        : 'Direto (Array Puro)'}
                    </span>
                  </DialogDescription>
                </div>

                {/* Seletor de abas (spec vs resultado) e de motor */}
                <div className="flex shrink-0 flex-wrap items-center gap-1 rounded-xl border border-border bg-muted p-1">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('spec')}
                    aria-pressed={previewTab === 'spec'}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      previewTab === 'spec'
                        ? 'bg-card text-primary shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <FileJson className="h-3.5 w-3.5" aria-hidden />
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
                    aria-pressed={previewTab === 'output'}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      previewTab === 'output'
                        ? 'bg-card text-primary shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                    Resultado
                    {previewOutput && (
                      <span className="ml-0.5 h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden />
                    )}
                  </button>

                  {/* Seletor de Motor no Modal */}
                  <div className="ml-1 flex items-center rounded-lg border border-border bg-background p-0.5 sm:ml-2">
                    <button
                      type="button"
                      onClick={() => setPreviewEngine('local')}
                      aria-pressed={previewEngine === 'local'}
                      className={cn(
                        'rounded px-2 py-1 text-[10px] font-bold uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        previewEngine === 'local'
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                      title="Executar no navegador (JavaScript)"
                    >
                      JS Local
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewEngine('java')}
                      aria-pressed={previewEngine === 'java'}
                      className={cn(
                        'flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        previewEngine === 'java'
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                      title="Executar no servidor (Java Bazaarvoice oficial)"
                    >
                      <Cpu className="h-3 w-3" aria-hidden />
                      Java Oficial
                    </button>
                  </div>
                </div>
              </div>
            </DialogHeader>
            {baseLayout && maintenanceNotes && (
              <div className="shrink-0 space-y-1 rounded-xl border border-border bg-muted/40 p-3 text-xs" role="status">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">O que mudou no layout</p>
                {maintenanceNotes.added.length === 0 && maintenanceNotes.removed.length === 0 && maintenanceNotes.errors.length === 0 && (
                  <p className="text-muted-foreground">Nenhuma mudança: o mapa está igual ao layout.</p>
                )}
                {maintenanceNotes.added.map((a) => (
                  <p key={`a-${a}`} className="font-code text-[11px] text-emerald-600 dark:text-emerald-400">+ {a}</p>
                ))}
                {maintenanceNotes.removed.map((r) => (
                  <p key={`r-${r}`} className="font-code text-[11px] text-rose-600 dark:text-rose-400">− {r}</p>
                ))}
                {maintenanceNotes.errors.map((er) => (
                  <p key={`e-${er}`} className="text-[11px] text-destructive">{er}</p>
                ))}
              </div>
            )}

            {/* Corpo do Modal */}
            <div className="relative my-2 min-h-[240px] w-full flex-1 overflow-hidden rounded-xl border border-border">
              {previewTab === 'spec' ? (
                <Editor
                  height="100%"
                  language="json"
                  theme={isDark ? 'vs-dark' : 'vs'}
                  value={previewSpec || '// Nenhuma especificação gerada ainda.'}
                  loading={
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
                <div className="flex h-full flex-col items-center justify-center overflow-y-auto bg-destructive/5 p-6 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-6 w-6" aria-hidden />
                  </div>
                  <h3 className="mb-1 text-sm font-bold text-destructive">
                    Falha na execução do motor
                  </h3>
                  <p className="mb-4 max-w-md rounded-xl border border-destructive/30 bg-card p-3 font-code text-xs text-muted-foreground">
                    {previewError}
                  </p>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleRunPreview}
                    disabled={isPreviewRunning}
                    className="gap-2 rounded-xl text-xs font-semibold"
                  >
                    {isPreviewRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    Tentar novamente
                  </Button>
                </div>
              ) : previewOutput ? (
                <div className="flex h-full flex-col">
                  {previewExecutionTime !== null && (
                    <div className="flex shrink-0 items-center justify-between border-b border-border/60 bg-muted/50 px-4 py-1.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className={cn(
                          'h-2 w-2 rounded-full',
                          previewEngineUsed === 'java' ? 'bg-sky-500' : 'bg-emerald-500',
                        )} />
                        Saída gerada via {previewEngineUsed === 'java' ? 'Java Bazaarvoice (Oficial)' : 'motor local JS'}
                      </span>
                      <span className="font-code font-bold text-primary">
                        {previewExecutionTime}ms
                      </span>
                    </div>
                  )}
                  <div className="min-h-0 flex-1">
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
                <div className="flex h-full flex-col items-center justify-center overflow-y-auto bg-muted/30 p-6 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Play className="h-6 w-6 fill-current" aria-hidden />
                  </div>
                  <h3 className="mb-1 text-sm font-bold text-foreground">
                    Prévia pronta para executar
                  </h3>
                  <p className="mb-4 max-w-sm text-xs text-muted-foreground">
                    O motor local processará a especificação gerada contra o JSON de origem imediatamente.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleRunPreview}
                    disabled={isPreviewRunning}
                    className="gap-2 rounded-xl text-xs font-semibold"
                  >
                    {isPreviewRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                    Executar transformação agora
                  </Button>
                </div>
              )}
            </div>

            <DialogFooter className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {previewTab === 'spec' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopySpec}
                    className="gap-2 rounded-xl text-xs font-semibold"
                  >
                    {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {isCopied ? 'Copiado!' : 'Copiar spec'}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyOutput}
                    disabled={!previewOutput}
                    className="gap-2 rounded-xl text-xs font-semibold"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar resultado
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRunPreview}
                  disabled={isPreviewRunning}
                  className="gap-1.5 rounded-xl border-primary/30 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                >
                  {isPreviewRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                  {previewOutput ? 'Reexecutar' : 'Executar prévia'}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsPreviewOpen(false)}
                  className="rounded-xl text-xs font-semibold"
                >
                  Fechar
                </Button>
                <Button
                  size="sm"
                  onClick={generateSpecFromEdges}
                  className="gap-2 rounded-xl text-xs font-semibold"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Abrir na Sandbox
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Dialog Salvar Projeto Visual ─────────────────────────────────── */}
        <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
          <DialogContent className="max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-headline text-base font-black uppercase tracking-tight">
                <Save className="h-4 w-4 text-primary" aria-hidden />
                Salvar mapeamento visual
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Guarde este diagrama, nós e regras para editar ou exportar a qualquer momento.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-3">
              <div>
                <label htmlFor="visual-project-name" className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Nome do projeto
                </label>
                <Input
                  id="visual-project-name"
                  placeholder="Ex: Campanhas PDVSync"
                  value={projectNameInput}
                  onChange={(e) => setProjectNameInput(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveProject();
                  }}
                />
              </div>

              <div>
                <label htmlFor="visual-project-commit" className="mb-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <span>Mensagem da versão (changelog)</span>
                  <span className="font-medium normal-case tracking-normal">Opcional</span>
                </label>
                <Input
                  id="visual-project-commit"
                  placeholder="Ex: v2: Adiciona mapeamento de itens e descontos"
                  value={versionCommitMessage}
                  onChange={(e) => setVersionCommitMessage(e.target.value)}
                  className="h-9 rounded-xl font-code text-[11px]"
                />
              </div>

              {/* Opção de Nuvem */}
              <div className="pt-1">
                <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={saveToCloud}
                    onChange={(e) => setSaveToCloud(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <span className="flex items-center gap-1.5">
                    <Cloud className="h-3.5 w-3.5 text-primary" aria-hidden />
                    Sincronizar na nuvem (PostgreSQL) com versionamento
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
                className="gap-1.5 rounded-xl text-xs font-semibold"
              >
                <Save className="h-3.5 w-3.5" />
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Dialog Histórico de Versões ───────────────────────────────────── */}
        <Dialog open={isVersionModalOpen} onOpenChange={setIsVersionModalOpen}>
          <DialogContent className="max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <DialogTitle className="flex items-center gap-2 font-headline text-base font-black uppercase tracking-tight">
                  <History className="h-4 w-4 text-primary" aria-hidden />
                  Histórico de versões
                </DialogTitle>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-code text-[10px] font-bold text-primary">
                  {projectVersions.length} {projectVersions.length === 1 ? 'versão' : 'versões'}
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Ponto de restauração e histórico de modificações salvas no banco de dados.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[360px] space-y-2.5 overflow-y-auto py-3">
              {isLoadingVersions ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-xs">Carregando histórico...</span>
                </div>
              ) : projectVersions.length === 0 ? (
                <div className="py-8 text-center text-xs italic text-muted-foreground">
                  Nenhuma versão registrada para este projeto.
                </div>
              ) : (
                projectVersions.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="rounded bg-primary px-2 py-0.5 font-code text-xs font-black text-primary-foreground">
                          v{v.versionNumber}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                          <Clock className="h-3 w-3" aria-hidden />
                          {new Date(v.createdAt).toLocaleString('pt-BR')}
                        </span>
                        {v.authorName && (
                          <span className="truncate text-[10px] text-muted-foreground">
                            • por {v.authorName}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs font-medium text-foreground">
                        {v.commitMessage || 'Snapshot da versão'}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRollbackVersion(v.id)}
                      className="h-7 shrink-0 gap-1 rounded-lg border-primary/30 px-2.5 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10 hover:text-primary"
                      title="Restaurar o projeto para esta versão"
                    >
                      <RotateCcw className="h-3 w-3" aria-hidden />
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
          <DialogContent className="flex h-[85dvh] max-h-[88dvh] max-w-3xl flex-col rounded-2xl border border-border bg-card p-4 shadow-2xl sm:p-6">
            <DialogHeader className="shrink-0">
              <DialogTitle className="flex items-center gap-2 font-headline text-base font-black uppercase tracking-tight">
                <Settings2 className="h-4 w-4 text-primary" aria-hidden />
                Template do envelope de integração
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                Defina o payload completo da tabela de integração (ex: Winthor / PCINTEGRACAOROTASERVICO).
                Use <code className="rounded border border-primary/20 bg-primary/10 px-1 py-0.5 font-code font-bold text-primary">"_JOLT_SPEC_"</code> no valor do campo onde o array Jolt deve ser injetado.
              </DialogDescription>
            </DialogHeader>

            <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
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

            <DialogFooter className="flex shrink-0 flex-wrap items-center justify-between gap-2 pt-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTemplateDraft(DEFAULT_ENVELOPE_TEMPLATE)}
                className="rounded-xl text-xs font-semibold"
              >
                Restaurar padrão Winthor
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
                  className="gap-1.5 rounded-xl text-xs font-semibold"
                >
                  <Save className="h-3.5 w-3.5" />
                  Salvar template
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
