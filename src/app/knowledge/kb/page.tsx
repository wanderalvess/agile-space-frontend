"use client";

import { ModuleIcon } from '@/components/brand/ModuleIcon';
import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  ShieldAlert,
  FileText, 
  Clock,
  FolderTree,
  FileUp,
  RefreshCw,
  Download,
  AlertTriangle,
  ArchiveRestore,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ArticleReader } from '@/components/knowledge/ArticleReader';
import { useSearchParams, useRouter } from 'next/navigation';
import { Modal, ModalButton } from '@/components/room-kit';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import { knowledgeApi } from '../api';
import type { KnowledgeDocument } from '@/lib/knowledge-types';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTdnSettings } from '@/hooks/useTdnSettings';
import { getTdnPageContent, importTdnToKnowledgeBase, parseConfluenceMacros } from '@/services/tdnService';
import { TdnImportDialog } from '@/components/knowledge/TdnImportDialog';
import { ConfirmTrashDialog, type TrashTarget } from '@/components/knowledge/ConfirmTrashDialog';
import { ModuleIntegrationButton } from '@/components/shared/ModuleIntegrationDialog';
import { htmlToMarkdown, htmlToPlainText } from '@/lib/knowledge-export';

type KbStatusView = 'published' | 'draft' | 'archived';

const STATUS_VIEWS: { id: KbStatusView; label: string }[] = [
  { id: 'published', label: 'Publicados' },
  { id: 'draft', label: 'Meus rascunhos' },
  { id: 'archived', label: 'Arquivados' },
];

/** "Publicados" é a lista padrão do servidor (sem parâmetro); as outras visões usam `?status=`. */
function statusFilterParam(view: KbStatusView): string | undefined {
  return view === 'published' ? undefined : view;
}

const STATUS_COUNT_LABEL: Record<KbStatusView, string> = {
  published: 'Artigos ativos',
  draft: 'Meus rascunhos',
  archived: 'Arquivados',
};

const EMPTY_LABEL: Record<KbStatusView, string> = {
  published: 'Nenhum documento encontrado nesta busca',
  draft: 'Você não tem rascunhos. Use "Salvar rascunho" no editor para guardar um artigo sem publicar.',
  archived: 'Nenhum artigo arquivado que você possa editar.',
};

function KBExplorerContent() {
  const { session } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const initialDocId = searchParams.get('id');
  
  // Estados de Leitura
  const [selectedFile, setSelectedFile] = useState<KnowledgeDocument | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const [isDownloadFormatOpen, setIsDownloadFormatOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'md' | 'html' | 'txt'>('md');
  const [isSyncingDoc, setIsSyncingDoc] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem('kb_favorites') || '[]');
        return Array.isArray(saved) ? saved : [];
      } catch {
        return []; // valor corrompido não pode derrubar a página
      }
    }
    return [];
  });

  // Estados de Gestão (vindos do admin)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTdnOpen, setIsTdnOpen] = useState(false);
  const [failedDocs, setFailedDocs] = useState<{ title: string; reason: string }[]>([]);
  const { settings: tdnSettings } = useTdnSettings();

  useEffect(() => {
    try {
      localStorage.setItem('kb_favorites', JSON.stringify(favorites));
    } catch { /* armazenamento bloqueado: favoritos valem só nesta sessão */ }
  }, [favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const executeDownload = () => {
    if (!selectedFile) return;
    
    let content = '';
    let filename = `${selectedFile.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    let mimeType = 'text/plain';

    if (selectedFormat === 'md') {
      content = htmlToMarkdown(selectedFile.content || '');
      filename += '.md';
    } else if (selectedFormat === 'html') {
      content = selectedFile.content || '';
      filename += '.html';
      mimeType = 'text/html';
    } else {
      content = htmlToPlainText(selectedFile.content || '');
      filename += '.txt';
    }

    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setIsDownloadFormatOpen(false);
    toast.success("Download concluído!");
  };

  const handleSyncActiveDocument = async () => {
    if (!selectedFile || !session) return;
    
    if (!selectedFile.tdnId) {
      toast.error("Apenas documentos importados do TDN podem ser sincronizados automaticamente.");
      return;
    }

    if (!tdnSettings || !tdnSettings.baseUrl || !tdnSettings.token) {
      toast.error("Configurações do TDN não encontradas. Configure o token de acesso primeiro.");
      return;
    }

    setIsSyncingDoc(true);
    const pageId = selectedFile.tdnId;

    try {
      const fullContent = await getTdnPageContent(tdnSettings.baseUrl, tdnSettings.token, pageId);
      await importTdnToKnowledgeBase(session.id, {
        id: pageId,
        title: fullContent.title || selectedFile.title.replace('[TDN] ', ''),
        content: fullContent.content || '',
        space: fullContent.space || selectedFile.tags?.[1] || 'Wiki',
        link: fullContent.link || `https://${tdnSettings.baseUrl}/pages/viewpage.action?pageId=${pageId}`,
        labels: fullContent.labels || []
      });
      
      // Atualizar o estado local
      const cleanContent = parseConfluenceMacros(fullContent.content || '');
      const sourceInfo = `\n\n---\n*Documento importado do TDN (${fullContent.space || 'Wiki'})*\n*Link original: [${fullContent.link}](${fullContent.link})*`;

      const updated = {
        ...selectedFile,
        title: `[TDN] ${fullContent.title}`,
        content: cleanContent + sourceInfo,
        tags: ['TDN', fullContent.space || 'Wiki', ...(fullContent.labels || [])].filter(Boolean) as string[],
        updatedAt: new Date().toISOString()
      };
      setSelectedFile(updated as any);
      fetchDocuments();

      toast.success("Documento sincronizado e atualizado em tempo real!");
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao sincronizar documento: ${err.message || 'Falha na conexão'}`);
    } finally {
      setIsSyncingDoc(false);
    }
  };

  // Funções de Gestão em lote e individuais
  const handleSyncManuals = async () => {
    if (!session) return;
    setIsSyncing(true);
    
    const tdnDocs = documents?.filter(d => d.tdnId != null) || [];
    if (tdnDocs.length === 0) {
      toast.error("Nenhum manual do TDN importado para sincronizar.");
      setIsSyncing(false);
      return;
    }

    if (!tdnSettings || !tdnSettings.baseUrl || !tdnSettings.token) {
      toast.error("Configurações do TDN não encontradas. Configure o token de acesso primeiro.");
      setIsSyncing(false);
      return;
    }

    let tdnCount = 0;
    const failedDocsList: { title: string; reason: string }[] = [];

    for (const docItem of tdnDocs) {
      const pageId = docItem.tdnId!;
      try {
        const fullContent = await getTdnPageContent(tdnSettings.baseUrl, tdnSettings.token, pageId);
        await importTdnToKnowledgeBase(session.id, {
          id: pageId,
          title: fullContent.title || docItem.title.replace('[TDN] ', ''),
          content: fullContent.content || '',
          space: fullContent.space || docItem.tags?.[1] || 'Wiki',
          link: fullContent.link || `https://${tdnSettings.baseUrl}/pages/viewpage.action?pageId=${pageId}`,
          labels: fullContent.labels || []
        });
        tdnCount++;
      } catch (err: any) {
        failedDocsList.push({
          title: docItem.title,
          reason: err.message || "Erro desconhecido"
        });
      }
    }

    setFailedDocs(failedDocsList);

    toast.success(`${tdnCount} de ${tdnDocs.length} manuais sincronizados com sucesso.`);
    fetchDocuments();
    setIsSyncing(false);
  };

  const handleSyncMultiple = async () => {
    if (selectedIds.size === 0 || !session) return;

    if (!tdnSettings || !tdnSettings.baseUrl || !tdnSettings.token) {
      toast.error("Configurações do TDN não encontradas. Configure o token de acesso primeiro.");
      return;
    }

    setIsSyncing(true);
    let tdnCount = 0;
    const failedDocsList: { title: string; reason: string }[] = [];

    for (const id of Array.from(selectedIds)) {
      const docItem = documents?.find(d => d.id === id);
      if (!docItem || !docItem.tdnId) continue;
      const pageId = docItem.tdnId;
      try {
        const fullContent = await getTdnPageContent(tdnSettings.baseUrl, tdnSettings.token, pageId);
        await importTdnToKnowledgeBase(session.id, {
          id: pageId,
          title: fullContent.title || docItem.title.replace('[TDN] ', '') || 'Documento',
          content: fullContent.content || '',
          space: fullContent.space || docItem.tags?.[1] || 'Wiki',
          link: fullContent.link || `https://${tdnSettings.baseUrl}/pages/viewpage.action?pageId=${pageId}`,
          labels: fullContent.labels || []
        });
        tdnCount++;
      } catch (err: any) {
        failedDocsList.push({ 
          title: docItem.title || `Documento ${pageId}`, 
          reason: err.message || "Erro desconhecido" 
        });
      }
    }

    setFailedDocs(failedDocsList);

    toast.success(`${tdnCount} manuais sincronizados.`);
    setSelectedIds(new Set());
    fetchDocuments();
    setIsSyncing(false);
  };

  const handleDownloadMultiple = () => {
    if (selectedIds.size === 0) return;
    selectedIds.forEach(id => {
      const docItem = documents?.find(d => d.id === id);
      if (docItem) handleDownload(docItem);
    });
    setSelectedIds(new Set());
    toast.success(`${selectedIds.size} downloads iniciados.`);
  };

  // A exclusão pede confirmação num diálogo próprio (nada de window.confirm).
  const [trashTarget, setTrashTarget] = useState<TrashTarget | null>(null);
  const [isTrashing, setIsTrashing] = useState(false);

  const handleDeleteMultiple = () => {
    if (selectedIds.size === 0) return;
    setTrashTarget({ kind: 'batch', ids: Array.from(selectedIds) });
  };

  const handleDelete = (id: string) => {
    const docItem = documents.find(d => d.id === id);
    setTrashTarget({ kind: 'single', id, title: docItem?.title || 'Este artigo' });
  };

  const runTrashBatch = async (ids: string[]) => {
    // Um a um: se algum falhar (ex.: não é o autor) os outros continuam e o resumo diz o que aconteceu.
    let ok = 0;
    let firstError = '';
    for (const id of ids) {
      try {
        await knowledgeApi.deleteDocument(id);
        ok++;
      } catch (err: any) {
        if (!firstError) firstError = err?.message || 'Erro desconhecido';
      }
    }
    const failed = ids.length - ok;
    if (ok > 0) toast.success(`${ok} documento(s) movido(s) para a lixeira.`);
    if (failed > 0) toast.error(`${failed} documento(s) não puderam ser apagados: ${firstError}`);
    setSelectedIds(new Set());
  };

  const confirmTrash = async () => {
    if (!trashTarget || isTrashing) return;
    setIsTrashing(true);
    try {
      if (trashTarget.kind === 'batch') {
        await runTrashBatch(trashTarget.ids);
      } else {
        try {
          await knowledgeApi.deleteDocument(trashTarget.id);
          toast.success("Documento movido para a lixeira.");
        } catch (err: any) {
          toast.error(err?.message || "Erro ao excluir documento.");
        }
      }
      fetchDocuments();
    } finally {
      setIsTrashing(false);
      setTrashTarget(null);
    }
  };

  const handleDownload = (docItem: KnowledgeDocument) => {
    const clean = htmlToMarkdown(docItem.content || '');
    const blob = new Blob([clean], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${docItem.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenDoc = (docItem: KnowledgeDocument) => {
    setSelectedFile(docItem);
    router.push(`/knowledge/kb?id=${docItem.id}`);
  };

  const handleCloseReader = () => {
    setSelectedFile(null);
    router.push('/knowledge/kb');
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === finalDocs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(finalDocs.map(d => d.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Estado dos artigos listados: o servidor devolve "publicados" por padrão; "draft" são só os rascunhos de quem
  // está logado (admin vê todos) e "archived" os arquivados que a pessoa pode editar.
  const [statusView, setStatusView] = useState<KbStatusView>('published');
  const [isUnarchiving, setIsUnarchiving] = useState(false);

  const fetchDocuments = React.useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      const response = await knowledgeApi.listDocuments(undefined, undefined, 0, 200, statusFilterParam(statusView));
      setDocuments(response.content);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar documentos da base de conhecimento.");
    } finally {
      setIsLoading(false);
    }
  }, [session, statusView]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const changeStatusView = (next: KbStatusView) => {
    if (next === statusView) return;
    setSelectedIds(new Set());
    setStatusView(next);
  };

  // Artigo arquivado -> publicado (só quem edita; o servidor confere).
  const unarchive = async (target: KnowledgeDocument, fromReader: boolean) => {
    if (isUnarchiving) return;
    setIsUnarchiving(true);
    try {
      const updated = await knowledgeApi.setDocumentStatus(target, 'published');
      toast.success('Artigo restaurado e publicado.');
      if (fromReader) setSelectedFile(updated);
      fetchDocuments();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao restaurar o artigo.');
    } finally {
      setIsUnarchiving(false);
    }
  };

  const filteredDocs = useMemo(() => {
    if (!documents) return [];
    return documents.filter(doc => {
      const term = searchTerm.toLowerCase();
      return (
        doc.title.toLowerCase().includes(term) ||
        (doc.category || '').toLowerCase().includes(term) ||
        (doc.fullPath || '').toLowerCase().includes(term) ||
        (doc.content || '').toLowerCase().includes(term)
      );
    });
  }, [documents, searchTerm]);

  // Tags globais para o filtro superior de badges
  const availableTags = useMemo(() => {
    if (!documents) return [];
    const tagsSet = new Set<string>();
    documents.forEach(doc => {
      if (doc.tags) {
        doc.tags.forEach(tag => {
          if (tag) tagsSet.add(tag);
        });
      }
    });
    return Array.from(tagsSet).sort();
  }, [documents]);

  const getModuleName = (doc: KnowledgeDocument) => doc.fullPath?.split('/')[0]?.trim() || 'Raiz';

  // Módulos/pastas e categorias pro navegador lateral, com contagem.
  const moduleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    (documents || []).forEach(doc => {
      const mod = getModuleName(doc);
      counts.set(mod, (counts.get(mod) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [documents]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    (documents || []).forEach(doc => {
      if (doc.category) counts.set(doc.category, (counts.get(doc.category) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [documents]);

  // Filtro definitivo (Pesquisa + Módulo + Categoria + Rótulos selecionados)
  const finalDocs = useMemo(() => {
    return filteredDocs.filter(doc => {
      if (selectedModule && getModuleName(doc) !== selectedModule) return false;
      if (selectedCategory && doc.category !== selectedCategory) return false;
      if (selectedTags.length > 0 && !(doc.tags && selectedTags.every(tag => doc.tags?.includes(tag)))) return false;
      return true;
    });
  }, [filteredDocs, selectedModule, selectedCategory, selectedTags]);

  // Efeito de Inicialização quando clicado via URL
  useEffect(() => {
    if (initialDocId && documents.length > 0) {
      const doc = documents.find(d => d.id === initialDocId);
      if (doc) {
        setSelectedFile(doc);
      }
    }
  }, [initialDocId, documents]);

  // Link direto para um artigo que a lista atual não traz (rascunho depois de salvar, arquivado, ou aberto de outra
  // tela): busca pelo id. O servidor responde 404 para rascunho de outra pessoa.
  const idFetchedRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!initialDocId || isLoading || !session) return;
    if (documents.some(d => d.id === initialDocId) || selectedFile?.id === initialDocId) return;
    if (idFetchedRef.current === initialDocId) return;
    idFetchedRef.current = initialDocId;
    knowledgeApi.getDocumentById(initialDocId)
      .then(doc => setSelectedFile(doc))
      .catch(() => toast.error('Não encontramos esse artigo, ou você não tem acesso a ele.'));
  }, [initialDocId, isLoading, session, documents, selectedFile]);

  const formatDocDate = (updatedAt: any) => {
    if (!updatedAt) return '---';
    try {
      const date = updatedAt.toDate ? updatedAt.toDate() : new Date(updatedAt);
      return formatDistanceToNow(date, { locale: ptBR, addSuffix: true });
    } catch (e) { return '---'; }
  };

  return (
    <div className="flex flex-col h-full w-full bg-background/30 overflow-hidden relative">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 dark:bg-primary/20 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 dark:bg-primary/20 rounded-full blur-[120px] pointer-events-none -z-10" />

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <AgileSpinner size="md" variant="indigo" />
            </div>
          ) : selectedFile ? (
            <ArticleReader
              key={selectedFile.id}
              document={selectedFile}
              isFavorite={favorites.includes(selectedFile.id)}
              onToggleFavorite={() => toggleFavorite(selectedFile.id)}
              onBack={handleCloseReader}
              onSync={handleSyncActiveDocument}
              isSyncing={isSyncingDoc}
              onExport={() => setIsDownloadFormatOpen(true)}
              onEdit={() => router.push(`/knowledge/admin/new-asset?id=${selectedFile.id}`)}
              tdnBaseUrl={tdnSettings?.baseUrl}
              onRestored={(restored) => { setSelectedFile(restored); fetchDocuments(); }}
              onUnarchive={() => unarchive(selectedFile, true)}
              isUnarchiving={isUnarchiving}
            />
          ) : (
            /* ========================================================================= */
            /* 2. PAINEL DE GESTÃO DE DOCUMENTOS — mesmo padrão visual do Prompt Hub     */
            /* (sidebar widescreen + hero editorial + tokens semânticos shadcn)          */
            /* ========================================================================= */
            <div className="flex w-full flex-1 overflow-hidden">
              <div className="mx-auto flex w-full max-w-[1920px] flex-1 overflow-hidden px-4 sm:px-6 lg:px-8 xl:px-10">
                {/* Barra Lateral Widescreen: Módulo/Pasta, Categoria e Rótulos */}
                <aside className="hidden xl:flex xl:w-64 2xl:w-72 xl:shrink-0 flex-col gap-6 py-5 pr-6 border-r border-border/60 overflow-y-auto">
                  <div className="space-y-2">
                    <span className="text-xs font-mono font-semibold tracking-normal text-muted-foreground px-2">
                      Módulo / Pasta
                    </span>
                    <div className="space-y-1">
                      <button
                        onClick={() => setSelectedModule(null)}
                        className={cn(
                          'flex items-center justify-between w-full rounded-lg px-3 py-2 text-xs transition-colors',
                          !selectedModule
                            ? 'bg-accent text-foreground font-semibold shadow-xs'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <FolderTree className="h-4 w-4 shrink-0" />
                          <span>Todos os módulos</span>
                        </div>
                        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                          {documents?.length || 0}
                        </span>
                      </button>
                      {moduleCounts.map(([mod, count]) => {
                        const isActive = selectedModule === mod;
                        return (
                          <button
                            key={mod}
                            onClick={() => setSelectedModule(isActive ? null : mod)}
                            className={cn(
                              'flex items-center justify-between w-full rounded-lg px-3 py-2 text-xs transition-colors',
                              isActive
                                ? 'bg-accent text-foreground font-semibold shadow-xs'
                                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                            )}
                          >
                            <span className="truncate">{mod}</span>
                            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground shrink-0 ml-2">
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {categoryCounts.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border/40">
                      <span className="text-xs font-mono font-semibold tracking-normal text-muted-foreground px-2">
                        Categoria
                      </span>
                      <div className="space-y-1">
                        {categoryCounts.map(([cat, count]) => {
                          const isActive = selectedCategory === cat;
                          return (
                            <button
                              key={cat}
                              onClick={() => setSelectedCategory(isActive ? null : cat)}
                              className={cn(
                                'flex items-center justify-between w-full rounded-lg px-3 py-2 text-xs transition-colors',
                                isActive
                                  ? 'bg-accent text-foreground font-semibold'
                                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                              )}
                            >
                              <span className="truncate">{cat}</span>
                              {isActive && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 ml-2" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {availableTags.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border/40">
                      <div className="flex items-center justify-between px-2">
                        <span className="text-xs font-mono font-semibold tracking-normal text-muted-foreground">
                          Rótulos
                        </span>
                        {selectedTags.length > 0 && (
                          <button onClick={() => setSelectedTags([])} className="text-xs font-medium text-primary [.theme-totvs:not(.dark)_&]:text-foreground hover:underline">
                            Limpar
                          </button>
                        )}
                      </div>
                      <div className="relative px-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Buscar rótulo..."
                          value={tagSearchTerm}
                          onChange={(e) => setTagSearchTerm(e.target.value)}
                          className="pl-8 h-8 text-xs"
                        />
                      </div>
                      <ScrollArea className="h-40">
                        <div className="flex flex-wrap gap-1.5 px-1 pt-1">
                          {availableTags
                            .filter(tag => tag.toLowerCase().includes(tagSearchTerm.toLowerCase()))
                            .map(tag => {
                              const isSelected = selectedTags.includes(tag);
                              return (
                                <button
                                  key={tag}
                                  onClick={() => setSelectedTags(prev => isSelected ? prev.filter(t => t !== tag) : [...prev, tag])}
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                                    isSelected
                                      ? 'bg-primary text-primary-foreground font-semibold'
                                      : 'bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground'
                                  )}
                                >
                                  #{tag}
                                </button>
                              );
                            })}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </aside>

                {/* Área Principal: Ações, Hero, Busca e Tabela */}
                <main className="flex flex-1 min-w-0 flex-col overflow-hidden xl:pl-6">
                  <ScrollArea className="flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
                    <div className="pt-6 pb-32 space-y-6">

                      {/* Ações + Atalho de integração */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                              if (!tdnSettings?.baseUrl || !tdnSettings?.token) {
                                toast.error('Configure a URL e o Token do TDN primeiro em Configurações > Conexões.', {
                                  action: { label: 'Configurar', onClick: () => router.push('/workspace?aba=conta&sub=conectividade') },
                                });
                                return;
                              }
                              setIsTdnOpen(true);
                            }}
                          >
                            <Search className="h-4 w-4" /> Buscar e Importar TDN
                          </Button>
                          <Button variant="outline" size="sm" className="gap-2" onClick={handleSyncManuals} disabled={isSyncing}>
                            {isSyncing ? <AgileSpinner size="xs" /> : <RefreshCw className="h-4 w-4" />} Sincronizar Manuais
                          </Button>
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push('/knowledge/trash')}>
                            <Trash2 className="h-4 w-4" /> Lixeira
                          </Button>
                          <Button size="sm" className="gap-2" onClick={() => router.push('/knowledge/admin/new-asset')}>
                            <Plus className="h-4 w-4" /> Criar Artigo
                          </Button>
                        </div>
                        <ModuleIntegrationButton moduleId="knowledge" label="Consumir via API & MCP" />
                      </div>

                      {/* Falhas da última sincronização TDN — some ao fechar ou ao rodar de novo. */}
                      {failedDocs.length > 0 && (
                        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2 text-xs font-semibold text-destructive">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {failedDocs.length} {failedDocs.length === 1 ? 'documento falhou' : 'documentos falharam'} na sincronização
                            </span>
                            <button
                              onClick={() => setFailedDocs([])}
                              className="text-destructive/70 hover:text-destructive transition-colors"
                              title="Fechar"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <ul className="space-y-1">
                            {failedDocs.map((f, i) => (
                              <li key={`${f.title}-${i}`} className="text-xs text-destructive/90">
                                <span className="font-medium">{f.title}</span>
                                <span className="text-destructive/70"> — {f.reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Vitrine de Entrada: Hero Editorial, igual ao Prompt Hub */}
                      <section className="overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/20 p-6 sm:p-8">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                          <div className="max-w-2xl space-y-2.5">
                            <div className="inline-flex items-center gap-2 font-mono text-xs tracking-normal text-primary [.theme-totvs:not(.dark)_&]:text-foreground font-semibold">
                              <ModuleIcon module="knowledge" className="h-3.5 w-3.5" />
                              Wiki Space
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                              Base de Conhecimento
                            </h1>
                            <p className="text-sm leading-relaxed text-muted-foreground max-w-xl">
                              Centralização, gestão e sincronização dos manuais e artigos da squad. Busque, importe do TDN e mantenha tudo atualizado num lugar só.
                            </p>
                          </div>

                          <div className="grid w-full grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3 rounded-xl border border-border/80 bg-background/80 px-4 py-3 shadow-xs sm:w-auto sm:gap-4">
                            <div className="text-right">
                              <span className="block font-mono text-xl font-bold text-foreground leading-none">
                                {documents?.length || 0}
                              </span>
                              <span className="text-xs font-medium tracking-normal text-muted-foreground">
                                {STATUS_COUNT_LABEL[statusView]}
                              </span>
                            </div>
                            <div className="h-7 w-[1px] bg-border/80" />
                            <div className="text-right">
                              <span className="block font-mono text-xl font-bold text-primary [.theme-totvs:not(.dark)_&]:text-foreground leading-none">
                                {(documents?.reduce((acc, d) => acc + (d.byteSize || 0), 0) / 1024 / 1024).toFixed(1)}
                              </span>
                              <span className="text-xs font-medium tracking-normal text-muted-foreground">
                                MB usados
                              </span>
                            </div>
                            <div className="h-7 w-[1px] bg-border/80" />
                            <div className="text-right">
                              <span className="block font-mono text-xl font-bold text-foreground leading-none">
                                {documents?.filter(d => d.tdnId).length || 0}
                              </span>
                              <span className="text-xs font-medium tracking-normal text-muted-foreground">
                                Do TDN
                              </span>
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Busca + filtros ativos + ações em lote */}
                      <div className="space-y-3">
                        <div role="group" aria-label="Estado dos artigos" className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1">
                          {STATUS_VIEWS.map(view => {
                            const active = statusView === view.id;
                            return (
                              <button
                                key={view.id}
                                type="button"
                                aria-pressed={active}
                                onClick={() => changeStatusView(view.id)}
                                className={cn(
                                  'h-9 rounded-lg px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
                                  active ? 'bg-card font-semibold text-foreground shadow-xs' : 'font-medium text-muted-foreground hover:text-foreground',
                                )}
                              >
                                {view.label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="relative flex-1 sm:max-w-md">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              placeholder="Buscar por título, categoria ou pasta..."
                              className="h-10 pl-10 text-sm"
                            />
                          </div>

                          {selectedIds.size > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                              <Button size="sm" className="gap-2" onClick={handleSyncMultiple} disabled={isSyncing}>
                                {isSyncing ? <AgileSpinner size="xs" /> : <RefreshCw className="h-4 w-4" />} Sincronizar ({selectedIds.size})
                              </Button>
                              <Button size="sm" variant="outline" className="gap-2" onClick={handleDownloadMultiple}>
                                <Download className="h-4 w-4" /> Baixar ({selectedIds.size})
                              </Button>
                              <Button size="sm" variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={handleDeleteMultiple}
                                disabled={Array.from(selectedIds).some(id => !documents.find(d => d.id === id)?.canEdit)}
                                title={Array.from(selectedIds).some(id => !documents.find(d => d.id === id)?.canEdit) ? 'Você só pode excluir documentos que editaria (autor ou liderança)' : undefined}>
                                <Trash2 className="h-4 w-4" /> Excluir ({selectedIds.size})
                              </Button>
                            </div>
                          )}
                        </div>

                        {(selectedModule || selectedCategory || selectedTags.length > 0) && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-muted-foreground mr-1">Filtros ativos:</span>
                            {selectedModule && (
                              <span className="inline-flex items-center gap-1 bg-accent text-foreground px-2 py-0.5 rounded-md text-xs font-medium">
                                {selectedModule}
                                <button onClick={() => setSelectedModule(null)} className="text-muted-foreground hover:text-foreground ml-0.5">×</button>
                              </span>
                            )}
                            {selectedCategory && (
                              <span className="inline-flex items-center gap-1 bg-accent text-foreground px-2 py-0.5 rounded-md text-xs font-medium">
                                {selectedCategory}
                                <button onClick={() => setSelectedCategory(null)} className="text-muted-foreground hover:text-foreground ml-0.5">×</button>
                              </span>
                            )}
                            {selectedTags.map(tag => (
                              <span key={tag} className="inline-flex items-center gap-1 bg-accent text-foreground px-2 py-0.5 rounded-md text-xs font-medium">
                                #{tag}
                                <button onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))} className="text-muted-foreground hover:text-foreground ml-0.5">×</button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Tabela de Gestão */}
                      <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
                        {isLoading ? (
                          <div className="py-32 flex flex-col items-center justify-center gap-4">
                            <AgileSpinner size="md" variant="indigo" />
                            <span className="text-xs text-muted-foreground">Carregando base...</span>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full table-auto">
                              <thead>
                                <tr className="bg-muted/40 border-b border-border">
                                  <th className="px-4 py-3 text-left w-12">
                                    <Checkbox
                                      checked={selectedIds.size === finalDocs.length && finalDocs.length > 0}
                                      onCheckedChange={toggleSelectAll}
                                    />
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Título do documento</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Módulo / pasta</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Categoria</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Atualização</th>
                                  <th className="px-4 py-3 text-right pr-6 text-xs font-medium text-muted-foreground w-36">Ações</th>
                                </tr>
                              </thead>
                              <tbody>
                                {finalDocs.map((docItem) => {
                                  const moduleName = getModuleName(docItem);
                                  const subFolder = docItem.fullPath?.split('/')?.slice(1)?.join(' / ')?.trim();
                                  return (
                                    <tr key={docItem.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors group">
                                      <td className="px-4 py-3">
                                        <Checkbox
                                          checked={selectedIds.has(docItem.id)}
                                          onCheckedChange={() => toggleSelect(docItem.id)}
                                        />
                                      </td>
                                      <td className="px-4 py-3 cursor-pointer" onClick={() => handleOpenDoc(docItem)}>
                                        <div className="flex flex-col gap-1">
                                          <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                            {docItem.tdnId ? (
                                              <FileUp className="h-3.5 w-3.5 text-primary [.theme-totvs:not(.dark)_&]:text-foreground shrink-0" />
                                            ) : (
                                              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            )}
                                            {docItem.title}
                                            {docItem.status === 'draft' && (
                                              <span className="ml-1 inline-flex h-5 items-center rounded-full border border-border bg-accent px-2 text-xs font-semibold text-foreground">Rascunho</span>
                                            )}
                                            {docItem.status === 'archived' && (
                                              <span className="ml-1 inline-flex h-5 items-center rounded-full border border-border bg-accent px-2 text-xs font-semibold text-foreground">Arquivado</span>
                                            )}
                                          </span>
                                          {docItem.tags && docItem.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                              {docItem.tags.slice(0, 4).map(tag => (
                                                <span key={tag} className="px-1.5 py-0.5 bg-muted rounded text-xs font-medium text-muted-foreground">
                                                  {tag}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                          <span className="text-xs text-foreground flex items-center gap-1.5">
                                            <FolderTree className="h-3.5 w-3.5 text-muted-foreground" /> {moduleName}
                                          </span>
                                          {subFolder && (
                                            <span className="text-xs text-muted-foreground ml-5">
                                              {subFolder}
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className="text-xs bg-muted px-2 py-1 rounded-md text-muted-foreground">
                                          {docItem.category}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                          <Clock className="h-3.5 w-3.5" />
                                          {formatDocDate(docItem.updatedAt)}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-right pr-6">
                                        <div className="flex justify-end gap-1.5">
                                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(docItem)} title="Baixar documento">
                                            <Download className="h-4 w-4" />
                                          </Button>
                                          {docItem.canEdit ? (
                                            <>
                                              {docItem.status === 'archived' && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => unarchive(docItem, false)} disabled={isUnarchiving} title="Restaurar para publicado" aria-label={`Restaurar ${docItem.title}`}>
                                                  <ArchiveRestore className="h-4 w-4" />
                                                </Button>
                                              )}
                                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/knowledge/admin/new-asset?id=${docItem.id}`)} title="Editar" aria-label={`Editar ${docItem.title}`}>
                                                <Edit className="h-4 w-4" />
                                              </Button>
                                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(docItem.id)} title="Excluir" aria-label={`Excluir ${docItem.title}`}>
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </>
                                          ) : null}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                                {finalDocs.length === 0 && (
                                  <tr>
                                    <td colSpan={6} className="py-20 text-center">
                                      <div className="flex flex-col items-center justify-center gap-2">
                                        <ShieldAlert className="h-8 w-8 text-muted-foreground/50" />
                                        <span className="text-xs text-muted-foreground">{EMPTY_LABEL[statusView]}</span>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                </main>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal Importador TDN */}
      {tdnSettings && (
        <TdnImportDialog
          open={isTdnOpen}
          onClose={() => setIsTdnOpen(false)}
          onImportSuccess={() => {
            setIsTdnOpen(false);
            toast.success("Documento importado com sucesso para a base!");
          }}
        />
      )}

      {/* Confirmação de exclusão (mover para a lixeira) */}
      <ConfirmTrashDialog
        target={trashTarget}
        loading={isTrashing}
        onCancel={() => setTrashTarget(null)}
        onConfirm={confirmTrash}
      />

      {/* Modal Formato de Download */}
      <Modal
        open={isDownloadFormatOpen}
        onOpenChange={setIsDownloadFormatOpen}
        icon={Download}
        title="Exportar artigo"
        description="Escolha o formato do arquivo para guardar uma cópia."
        footer={
          <>
            <ModalButton onClick={() => setIsDownloadFormatOpen(false)}>Cancelar</ModalButton>
            <ModalButton variant="primary" onClick={executeDownload}>Baixar</ModalButton>
          </>
        }
      >
          <RadioGroup
            value={selectedFormat}
            onValueChange={(val: any) => setSelectedFormat(val)}
            className="gap-3"
          >
            {([
              ['md', 'Markdown (.md)', 'Para colar em outros documentos.'],
              ['html', 'HTML (.html)', 'Com a formatação do artigo.'],
              ['txt', 'Texto (.txt)', 'Só o texto, sem formatação.'],
            ] as const).map(([value, title, description]) => (
              <Label
                key={value}
                htmlFor={`format-${value}`}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                  selectedFormat === value ? 'border-primary bg-primary/10' : 'border-border bg-muted/30 hover:bg-muted/60'
                )}
              >
                <RadioGroupItem value={value} id={`format-${value}`} />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-foreground">{title}</span>
                  <span className="text-xs font-normal text-muted-foreground">{description}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
      </Modal>
    </div>
  );
}

export default function KBExplorerPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full w-full items-center justify-center bg-card">
        <AgileSpinner size="md" variant="indigo" />
      </div>
    }>
      <KBExplorerContent />
    </Suspense>
  );
}
