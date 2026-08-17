'use client';

import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Handle,
  Position,
  Panel,
  ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import { IdeaCard } from './IdeaCard';
import { BrainstormingIdea } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Maximize2, ZoomIn, ZoomOut, Download } from 'lucide-react';

// --- Custom Node Component ---
const IdeaNode = ({ data }: { data: { 
  idea: BrainstormingIdea, 
  isAnonymous: boolean, 
  onVote: (id: string) => void,
  onUpdate: (id: string, content: string) => void 
} }) => {
  return (
    <div className="w-[300px] group">
      {/* Handles: Visíveis ao passar o mouse ou em tons suaves para não poluir */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-16 h-4 -top-2 rounded-full bg-amber-200 border-2 border-amber-500 opacity-0 group-hover:opacity-100 transition-opacity z-10" 
      />
      
      <IdeaCard 
        idea={data.idea} 
        isAnonymous={data.isAnonymous} 
        onVote={data.onVote}
        onUpdate={data.onUpdate}
        className="shadow-2xl" 
      />
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-16 h-4 -bottom-2 rounded-full bg-amber-500 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity z-10" 
      />

      {/* Side Handles for more complex webs */}
      <Handle type="source" position={Position.Right} className="opacity-0 group-hover:opacity-30" />
      <Handle type="target" position={Position.Left} className="opacity-0 group-hover:opacity-30" />
    </div>
  );
};

const nodeTypes = {
  ideaNode: IdeaNode,
};

interface DiagramPhaseProps {
  ideas: BrainstormingIdea[];
  boardId: string;
  isAnonymous: boolean;
  // Aceito para compatibilidade com o call site (brainstorming/[id]/page.tsx). Atualmente não é
  // repassado ao IdeaCard (que assume isRevealed=true) para preservar o comportamento existente.
  isRevealed?: boolean;
  onVoteIdea: (id: string) => void;
  onUpdateIdea: (id: string, content: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onConnectIdeas: (sourceId: string, targetId: string) => void;
  onDisconnectIdea: (id: string) => void;
  isExporting: boolean;
  onExportComplete: () => void;
}

export function DiagramPhase({
  ideas,
  boardId,
  isAnonymous,
  onVoteIdea,
  onUpdateIdea,
  onUpdatePosition,
  onConnectIdeas,
  onDisconnectIdea,
  isExporting,
  onExportComplete
}: DiagramPhaseProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const rfInstance = useRef<ReactFlowInstance | null>(null);

  // Sync Nodes and Edges from ideas
  useEffect(() => {
    // Calculamos novas posições iniciais se não existirem
    const getInitialPosition = (index: number, existingPos?: {x: number, y: number}) => {
      if (existingPos && (existingPos.x !== 0 || existingPos.y !== 0)) return existingPos;
      
      // Algoritmo de Grade para evitar sobreposição inicial
      const cols = 3;
      const spacingX = 400;
      const spacingY = 300;
      return {
        x: (index % cols) * spacingX,
        y: Math.floor(index / cols) * spacingY
      };
    };

    const newNodes: Node[] = ideas.map((idea, index) => ({
      id: idea.id,
      type: 'ideaNode',
      data: { 
        idea, 
        isAnonymous, 
        onVote: onVoteIdea,
        onUpdate: onUpdateIdea
      },
      position: getInitialPosition(index, idea.position),
    }));

    const newEdges: Edge[] = ideas
      .filter((idea) => idea.parentId)
      .map((idea) => ({
        id: `e-${idea.parentId}-${idea.id}`,
        source: idea.parentId!,
        target: idea.id,
        animated: true,
        style: { stroke: '#f59e0b', strokeWidth: 3 },
      }));

    setNodes(newNodes);
    setEdges(newEdges);
  }, [ideas.length, isAnonymous, onVoteIdea, setNodes, setEdges]); // Sincroniza apenas quando o número de ideias muda ou configurações globais

  // Handler para persistir arrasto
  const onNodeDragStop = useCallback((event: any, node: Node) => {
    onUpdatePosition(node.id, node.position.x, node.position.y);
  }, [onUpdatePosition]);

  // Handler para persistir conexão
  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        onConnectIdeas(params.source, params.target);
      }
    },
    [onConnectIdeas]
  );

  // Handler para deletar conexão
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    // Se o usuário clicar em uma linha, perguntamos se deseja remover
    if (window.confirm("Deseja remover esta conexão?")) {
      onDisconnectIdea(edge.target);
    }
  }, [onDisconnectIdea]);

  // Export Logic
  useEffect(() => {
    if (isExporting) {
      const element = document.querySelector('.react-flow__viewport') as HTMLElement;
      if (element) {
        toPng(element, {
          backgroundColor: '#f8fafc',
          style: {
             transform: 'scale(1)',
          }
        }).then((dataUrl) => {
          const link = document.createElement('a');
          link.download = `brainstorming-web-${boardId}.png`;
          link.href = dataUrl;
          link.click();
          onExportComplete();
        }).catch((err) => {
          console.error('Export failed', err);
          onExportComplete();
        });
      } else {
        onExportComplete();
      }
    }
  }, [isExporting, boardId, onExportComplete]);

  return (
    <div className="h-full w-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        onInit={(instance) => { rfInstance.current = instance; }}
        fitView
        // Habilitar estas opções para uma experiência premium de teia
        panOnScroll
        selectionOnDrag
        panOnDrag={[1, 2]}
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: '#f59e0b', strokeWidth: 3 },
        }}
      >
        <Background color="#cbd5e1" gap={20} />
        <Controls 
          className="bg-white border-none shadow-xl rounded-2xl p-1 overflow-hidden" 
          showInteractive={false}
        />
        <MiniMap 
          className="rounded-3xl border-4 border-white shadow-2xl overflow-hidden" 
          maskColor="rgba(241, 245, 249, 0.7)"
          nodeColor="#f59e0b"
          style={{ width: 150, height: 100 }}
        />
        
        {/* Helper Panel */}
        <Panel position="top-right" className="bg-white/80 backdrop-blur px-4 py-2 rounded-2xl border border-slate-200 shadow-lg text-[10px] font-black uppercase tracking-widest text-slate-500">
          Scroll para Zoom • Arraste para Mover
        </Panel>

        {/* Zoom Controls Overlay */}
        <Panel position="bottom-center" className="flex gap-2 mb-4">
           <Button 
             variant="secondary" 
             className="h-12 w-12 rounded-2xl bg-white shadow-xl hover:bg-slate-50"
             onClick={() => rfInstance.current?.zoomIn()}
            >
              <ZoomIn className="h-5 w-5" />
           </Button>
           <Button 
             variant="secondary" 
             className="h-12 w-12 rounded-2xl bg-white shadow-xl hover:bg-slate-50"
             onClick={() => rfInstance.current?.zoomOut()}
            >
              <ZoomOut className="h-5 w-5" />
           </Button>
           <Button 
             variant="secondary" 
             className="h-12 px-6 rounded-2xl bg-white shadow-xl hover:bg-slate-50 font-black uppercase text-[10px] tracking-widest"
             onClick={() => rfInstance.current?.fitView()}
            >
              <Maximize2 className="h-5 w-5 mr-2" />
              Centralizar
           </Button>
        </Panel>
      </ReactFlow>
    </div>
  );
}
