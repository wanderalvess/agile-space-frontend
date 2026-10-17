'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  getNodesBounds,
  getViewportForBounds,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import { Maximize2, Unlink, X, ZoomIn, ZoomOut } from 'lucide-react';
import { ConfirmDialog, IconButton, ModalButton } from '@/components/room-kit';
import { ideaSignature } from '@/lib/brainstorming-utils';
import type { BrainstormingIdea } from '@/lib/types';
import { pageBackground, useExportRequest } from './brainstorm-image';
import { IdeaCard } from './IdeaCard';

interface IdeaNodeData extends Record<string, unknown> {
  idea: BrainstormingIdea;
  onVote: (id: string) => void;
  onUpdate: (id: string, content: string) => Promise<boolean | void> | boolean | void;
}

/** Bolinhas de ligar: sempre visíveis (no toque não existe passar o mouse por cima). */
const HANDLE = '!h-2.5 !w-8 !rounded-full !border-2 !border-card';
const HANDLE_STYLE = { background: 'hsl(var(--primary))' } as const;
const SIDE_STYLE = { background: 'hsl(var(--muted-foreground))' } as const;
const SIDE_HANDLE = '!h-3 !w-3 !border-2 !border-card';

function IdeaNode({ data }: NodeProps<Node<IdeaNodeData>>) {
  return (
    <div className="w-[300px]">
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} className={`${HANDLE} !-top-1.5`} aria-label="Receber ligação" />
      <IdeaCard idea={data.idea} onVote={data.onVote} onUpdate={data.onUpdate} className="shadow-2xl" />
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} className={`${HANDLE} !-bottom-1.5`} aria-label="Puxar ligação para outra ideia" />
      <Handle type="source" position={Position.Right} style={SIDE_STYLE} className={SIDE_HANDLE} />
      <Handle type="target" position={Position.Left} style={SIDE_STYLE} className={SIDE_HANDLE} />
    </div>
  );
}

const nodeTypes = { ideaNode: IdeaNode };

/** Grade de 3 colunas para quem ainda não tem posição, para os cartões não nascerem empilhados. */
function initialPosition(index: number, existing?: { x: number; y: number }) {
  if (existing && (existing.x !== 0 || existing.y !== 0)) return existing;
  return { x: (index % 3) * 400, y: Math.floor(index / 3) * 300 };
}

interface DiagramPhaseProps {
  ideas: BrainstormingIdea[];
  boardId: string;
  onVoteIdea: (id: string) => void;
  onUpdateIdea: (id: string, content: string) => Promise<boolean | void> | boolean | void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onConnectIdeas: (sourceId: string, targetId: string) => void;
  onDisconnectIdea: (id: string) => void;
  /** Número do pedido de imagem (PNG): muda a cada "Salvar imagem". */
  exportRequest?: number;
  onExportDone?: (ok: boolean) => void;
}

/**
 * Etapa 2, Teia: as ideias são nós. Arrastar grava a posição, puxar da bolinha de baixo liga duas ideias
 * (o servidor recusa ciclos) e clicar na linha oferece remover a ligação.
 */
export function DiagramPhase({
  ideas,
  boardId,
  onVoteIdea,
  onUpdateIdea,
  onUpdatePosition,
  onConnectIdeas,
  onDisconnectIdea,
  exportRequest,
  onExportDone,
}: DiagramPhaseProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<IdeaNodeData>>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [confirmEdgeId, setConfirmEdgeId] = useState<string | null>(null);
  const rfInstance = useRef<ReactFlowInstance<Node<IdeaNodeData>, Edge> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Muda quando qualquer coisa visível das ideias muda (posição, texto, ligação, votos), não só a contagem.
  const signature = useMemo(() => ideaSignature(ideas), [ideas]);

  useEffect(() => {
    setNodes((prev) => {
      // o cartão que a própria pessoa está arrastando agora não pode pular de volta para a posição salva
      const dragging = new Map(prev.filter((n) => n.dragging).map((n) => [n.id, n.position]));
      return ideas.map((idea, index) => ({
        id: idea.id,
        type: 'ideaNode',
        data: { idea, onVote: onVoteIdea, onUpdate: onUpdateIdea },
        position: dragging.get(idea.id) ?? initialPosition(index, idea.position),
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, onVoteIdea, onUpdateIdea, setNodes]);

  const edges = useMemo<Edge[]>(
    () =>
      ideas
        .filter((idea) => idea.parentId)
        .map((idea) => {
          const id = `e-${idea.parentId}-${idea.id}`;
          const selected = id === selectedEdgeId;
          return {
            id,
            source: idea.parentId!,
            target: idea.id,
            interactionWidth: 24,
            style: { stroke: selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))', strokeWidth: selected ? 4 : 2.5 },
          };
        }),
    [ideas, selectedEdgeId]
  );

  const onNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => onUpdatePosition(node.id, node.position.x, node.position.y), [onUpdatePosition]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) onConnectIdeas(params.source, params.target);
    },
    [onConnectIdeas]
  );

  const confirmEdge = edges.find((e) => e.id === confirmEdgeId);

  // PNG da teia inteira (não só o pedaço visível): enquadra todos os nós numa imagem de tamanho fixo.
  useExportRequest(exportRequest, async () => {
    const viewportEl = containerRef.current?.querySelector<HTMLElement>('.react-flow__viewport');
    const instance = rfInstance.current;
    let ok = false;
    if (viewportEl && instance && instance.getNodes().length > 0) {
      try {
        const bounds = getNodesBounds(instance.getNodes());
        const width = Math.min(4096, Math.max(1280, Math.round(bounds.width + 200)));
        const height = Math.min(4096, Math.max(720, Math.round(bounds.height + 200)));
        const viewport = getViewportForBounds(bounds, width, height, 0.1, 2, 0.1);
        const dataUrl = await toPng(viewportEl, {
          backgroundColor: pageBackground(),
          width,
          height,
          style: { width: `${width}px`, height: `${height}px`, transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` },
        });
        const link = document.createElement('a');
        link.download = `brainstorming-teia-${boardId}.png`;
        link.href = dataUrl;
        link.click();
        ok = true;
      } catch (error) {
        console.error('Não foi possível gerar a imagem da teia', error);
      }
    }
    onExportDone?.(ok);
  });

  return (
    <div
      ref={containerRef}
      className={[
        'h-full min-h-[420px] w-full overflow-hidden rounded-2xl border border-border bg-background',
        '[&_.react-flow__minimap]:!overflow-hidden [&_.react-flow__minimap]:!rounded-xl [&_.react-flow__minimap]:!border [&_.react-flow__minimap]:!border-border [&_.react-flow__minimap]:!bg-card',
        '[&_.react-flow__minimap-mask]:fill-background/70 [&_.react-flow__minimap-node]:fill-primary [&_.react-flow__minimap-node]:stroke-none',
        '[&_.react-flow__background-pattern]:stroke-border [&_.react-flow__background-pattern]:fill-border',
        '[&_.react-flow__attribution]:!bg-transparent [&_.react-flow__attribution]:!text-muted-foreground',
      ].join(' ')}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onEdgeClick={(_, edge) => setSelectedEdgeId(edge.id)}
        onPaneClick={() => setSelectedEdgeId(null)}
        nodeTypes={nodeTypes}
        onInit={(instance) => {
          rfInstance.current = instance;
        }}
        // Sem colorMode: o React Flow poria a classe "dark" no quadro e ela redefine as cores do tema (a do tema padrão).
        fitView
        fitViewOptions={{ padding: 0.2 }}
        // A rolagem move o quadro; Ctrl + rolagem aproxima; o botão do meio ou o direito arrasta o quadro.
        panOnScroll
        selectionOnDrag
        panOnDrag={[1, 2]}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} />
        <MiniMap pannable zoomable ariaLabel="Mapa da teia" bgColor="hsl(var(--card))" maskColor="hsl(var(--background) / 0.7)" nodeColor="hsl(var(--primary))" nodeStrokeWidth={0} style={{ width: 150, height: 100 }} className="max-sm:!hidden" />

        <Panel position="bottom-left" className="mb-3 max-w-[20rem] rounded-xl border border-border bg-card/95 p-2.5 text-xs leading-relaxed text-muted-foreground shadow-md max-2xl:hidden">
          <strong className="block text-[13px] font-semibold text-foreground">Como mexer</strong>
          Arraste uma ideia para movê-la. Puxe da bolinha de baixo até outra ideia para ligar.{' '}
          <kbd className="rounded border border-border px-1">Ctrl</kbd> + rolagem aproxima; botão do meio ou direito arrasta o quadro.
        </Panel>

        {selectedEdgeId && (
          <Panel position="top-center" className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-lg">
            <span className="px-2 text-[13px] font-medium text-foreground">Ligação entre duas ideias</span>
            <ModalButton className="h-9 gap-1.5 px-3 text-[13px]" onClick={() => setConfirmEdgeId(selectedEdgeId)}>
              <Unlink className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Remover ligação
            </ModalButton>
            <IconButton size="sm" label="Fechar" icon={X} onClick={() => setSelectedEdgeId(null)} className="border-transparent" />
          </Panel>
        )}

        <Panel position="bottom-center" className="mb-3 flex gap-2">
          <IconButton label="Aproximar" icon={ZoomIn} onClick={() => void rfInstance.current?.zoomIn()} className="bg-card shadow-md" />
          <IconButton label="Afastar" icon={ZoomOut} onClick={() => void rfInstance.current?.zoomOut()} className="bg-card shadow-md" />
          <ModalButton className="gap-2 bg-card shadow-md" onClick={() => void rfInstance.current?.fitView()}>
            <Maximize2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Centralizar
          </ModalButton>
        </Panel>
      </ReactFlow>

      <ConfirmDialog
        open={!!confirmEdge}
        onOpenChange={(next) => { if (!next) setConfirmEdgeId(null); }}
        tone="warn"
        icon={Unlink}
        title="Remover a ligação?"
        description="As duas ideias continuam no quadro; só a linha entre elas some."
        cancelLabel="Manter"
        confirmLabel="Remover ligação"
        onConfirm={() => {
          if (confirmEdge) onDisconnectIdea(confirmEdge.target);
          setSelectedEdgeId(null);
        }}
      />
    </div>
  );
}
