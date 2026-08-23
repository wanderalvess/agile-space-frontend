'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Excalidraw, exportToSvg, serializeAsJSON } from '@excalidraw/excalidraw';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/UserContext';
import "@excalidraw/excalidraw/index.css";

const BOARD_STORAGE_KEY_PREFIX = 'agileSpace_excalidraw_board';

export default function ExcalidrawRoom({ onExportReady }: { onExportReady?: (exportFn: () => void) => void }) {
  const { toast } = useToast();
  const { userProfile } = useUserContext();
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);

  const getBoardStorageKey = useCallback(() => {
    return userProfile?.id ? `${BOARD_STORAGE_KEY_PREFIX}_${userProfile.id}` : BOARD_STORAGE_KEY_PREFIX;
  }, [userProfile?.id]);

  // Load Initial Snapshot from localStorage
  useEffect(() => {
    if (isReady) return;

    try {
      const raw = localStorage.getItem(getBoardStorageKey());
      if (raw) {
        const stored = JSON.parse(raw);
        const snapshot = JSON.parse(stored.content);
        setInitialData({
          elements: snapshot.elements || [],
          appState: { ...snapshot.appState, viewBackgroundColor: '#ffffff' },
          scrollToContent: true,
        });
      }
    } catch (e) {
      console.error("Failed to load excalidraw snapshot", e);
    }
    setIsReady(true);
  }, [isReady, getBoardStorageKey]);

  // Save Snapshot on changes (Debounced)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Excalidraw's onChange provides a readonly elements array; accept readonly to match its signature
  const handleChange = useCallback((elements: readonly any[], appState: any, files: any) => {
    if (!isReady || appState.isLoading) return;

    // Apenas salva se houver mudanças reais nos elementos ou se não for apenas movimentação de câmera/cursor
    // O Excalidraw chama o onChange com frequência.

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      try {
        const content = serializeAsJSON(elements, appState, files, "database");
        localStorage.setItem(getBoardStorageKey(), JSON.stringify({
          type: 'architecture_visual',
          content,
          updatedAt: new Date().toISOString()
        }));
      } catch (e) {
        console.error("Failed to save excalidraw snapshot", e);
      }
    }, 1500); // 1.5s debounce
  }, [isReady, getBoardStorageKey]);

  // Handle Export
  useEffect(() => {
    if (excalidrawAPI && onExportReady) {
      onExportReady(async () => {
        const elements = excalidrawAPI.getSceneElements();
        if (!elements || elements.length === 0) {
          return toast({ title: "Canvas Vazio", description: "Desenhe algo para exportar.", variant: "destructive" });
        }

        try {
          const svg = await exportToSvg({
            elements,
            appState: excalidrawAPI.getAppState(),
            files: excalidrawAPI.getFiles(),
          });

          const url = URL.createObjectURL(new Blob([svg.outerHTML], { type: 'image/svg+xml' }));
          const a = document.createElement('a');
          a.href = url;
          a.download = 'architecture_visual.svg';
          a.click();
          URL.revokeObjectURL(url);
        } catch (e: any) {
          toast({ title: "Erro na Exportação", description: e.message, variant: "destructive" });
        }
      });
    }
  }, [excalidrawAPI, onExportReady, toast]);

  const handleExcalidrawAPI = useCallback((api: any) => {
    setExcalidrawAPI(api);
  }, []);

  if (!isReady) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-card rounded-xl border border-border/50 shadow-sm text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <span className="text-xs font-bold uppercase tracking-widest">Iniciando Excalidraw...</span>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 rounded-xl overflow-hidden border border-border/50 shadow-sm excalidraw-wrapper bg-white">
      <Excalidraw
        excalidrawAPI={handleExcalidrawAPI}
        initialData={initialData}
        onChange={handleChange}
        theme="light"
        gridModeEnabled={true}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
          }
        }}
      />
    </div>
  );
}
