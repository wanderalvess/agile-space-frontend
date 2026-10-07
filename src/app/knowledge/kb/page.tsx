"use client";

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
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
  ChevronRight,
  Database,
  FileUp,
  RefreshCw,
  Download,
  BookOpen,
  Star,
  Hash,
  AlertTriangle,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ModuleIntegrationButton } from '@/components/shared/ModuleIntegrationDialog';
import { htmlToMarkdown, htmlToPlainText } from '@/lib/knowledge-export';

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
  const [readingProgress, setReadingProgress] = useState(0);
  const readerRootRef = useRef<HTMLDivElement | null>(null);
  const readerViewportRef = useRef<HTMLDivElement | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kb_favorites');
      return saved ? JSON.parse(saved) : [];
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
    localStorage.setItem('kb_favorites', JSON.stringify(favorites));
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
      let cleanContent = parseConfluenceMacros(fullContent.content || '');
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

  const handleDeleteMultiple = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Tem certeza que deseja mover ${selectedIds.size} itens para a lixeira?`)) return;

    try {
      for (const id of Array.from(selectedIds)) {
        await knowledgeApi.deleteDocument(id, session?.id || 'user');
      }
      toast.success(`${selectedIds.size} documentos movidos para a lixeira.`);
      setSelectedIds(new Set());
      fetchDocuments();
    } catch (err) {
      toast.error("Erro ao excluir documentos.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja mover este documento para a lixeira?")) return;
    try {
      await knowledgeApi.deleteDocument(id, session?.id || 'user');
      toast.success("Documento movido para a lixeira.");
      fetchDocuments();
    } catch (err) {
      toast.error("Erro ao excluir documento.");
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

  const fetchDocuments = React.useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      const response = await knowledgeApi.listDocuments(undefined, undefined, 0, 200);
      setDocuments(response.content);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar documentos da base de conhecimento.");
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

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

  const formatDocDate = (updatedAt: any) => {
    if (!updatedAt) return '---';
    try {
      const date = updatedAt.toDate ? updatedAt.toDate() : new Date(updatedAt);
      return formatDistanceToNow(date, { locale: ptBR, addSuffix: true });
    } catch (e) { return '---'; }
  };

  // Extrai um sumário (H1/H2/H3) do conteúdo do artigo e injeta ids nos
  // headings pra âncora do sumário funcionar dentro do HTML sanitizado.
  const { tocItems, contentWithAnchors } = useMemo(() => {
    if (typeof window === 'undefined' || !selectedFile?.content) {
      return { tocItems: [] as { id: string; text: string; level: number }[], contentWithAnchors: selectedFile?.content || '' };
    }
    try {
      const doc = new DOMParser().parseFromString(selectedFile.content, 'text/html');
      const headings = Array.from(doc.querySelectorAll('h1, h2, h3'));
      const seen = new Map<string, number>();
      const items = headings.map((el) => {
        const text = el.textContent?.trim() || '';
        let slug = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'secao';
        const count = seen.get(slug) || 0;
        seen.set(slug, count + 1);
        if (count > 0) slug = `${slug}-${count}`;
        el.id = slug;
        return { id: slug, text, level: Number(el.tagName[1]) };
      });
      return { tocItems: items, contentWithAnchors: doc.body.innerHTML };
    } catch {
      return { tocItems: [], contentWithAnchors: selectedFile.content };
    }
  }, [selectedFile?.content]);

  useEffect(() => {
    setReadingProgress(0);
    const viewport = readerRootRef.current?.querySelector<HTMLDivElement>('[data-radix-scroll-area-viewport]');
    readerViewportRef.current = viewport || null;
    if (!viewport) return;
    const onScroll = () => {
      const max = viewport.scrollHeight - viewport.clientHeight;
      setReadingProgress(max > 0 ? Math.min(100, (viewport.scrollTop / max) * 100) : 0);
    };
    viewport.addEventListener('scroll', onScroll);
    onScroll();
    return () => viewport.removeEventListener('scroll', onScroll);
  }, [selectedFile?.id]);

  const scrollToHeading = (id: string) => {
    readerViewportRef.current?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50/30 dark:bg-slate-950/20 overflow-hidden relative">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-150 dark:bg-cyan-950/20 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-150 dark:bg-indigo-950/20 rounded-full blur-[120px] pointer-events-none -z-10" />

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <AgileSpinner size="md" variant="indigo" />
            </div>
          ) : selectedFile ? (
            /* ========================================================================= */
            /* 1. VISUALIZADOR DE ARTIGO EM TELA CHEIA                                  */
            /* ========================================================================= */
            <div className="h-full flex flex-col animate-in fade-in duration-300 bg-white/40 dark:bg-slate-950/20">
              <header className="h-14 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-300 dark:border-slate-800 px-6 lg:px-8 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleCloseReader}
                      className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors tracking-widest leading-none"
                    >
                      Base de Conhecimento
                    </button>
                    <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-700" />
                    <span className="text-[10px] font-black uppercase text-slate-900 dark:text-slate-100 leading-none truncate max-w-[250px] md:max-w-md">{selectedFile.title}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => toggleFavorite(selectedFile.id)}
                    className="h-9 w-9 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all rounded-xl border border-slate-300 dark:border-slate-800"
                  >
                    <Star className={cn("h-4 w-4 transition-all", favorites.includes(selectedFile.id) ? "text-amber-500 fill-amber-500" : "text-slate-400 dark:text-slate-500")} />
                  </Button>

                  {selectedFile.tdnId && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleSyncActiveDocument}
                      disabled={isSyncingDoc}
                      className="h-9 px-4 rounded-xl border-slate-300 dark:border-slate-800 text-[9px] font-black uppercase tracking-widest gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900 shadow-xs"
                    >
                      {isSyncingDoc ? <AgileSpinner size="xs" /> : <RefreshCw className="h-3.5 w-3.5" />} 
                      {isSyncingDoc ? 'Sincronizando...' : 'Sincronizar'}
                    </Button>
                  )}

                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsDownloadFormatOpen(true)} 
                    className="h-9 px-4 rounded-xl border-slate-300 dark:border-slate-800 text-[9px] font-black uppercase tracking-widest gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    Exportar <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => router.push(`/knowledge/admin/new-asset?id=${selectedFile.id}`)} className="h-9 px-4 rounded-xl border-slate-300 dark:border-slate-800 text-[9px] font-black uppercase tracking-widest gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900">
                    Editar <FileText className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </header>
              <div className="h-[3px] bg-slate-100 dark:bg-slate-900 shrink-0">
                <div className="h-full bg-cyan-600 transition-[width] duration-150" style={{ width: `${readingProgress}%` }} />
              </div>

              <ScrollArea className="flex-1" ref={readerRootRef}>
                <div className={cn("max-w-[1300px] mx-auto px-6 md:px-12 pt-6 pb-32 min-h-screen", tocItems.length > 0 && "grid grid-cols-[180px_minmax(0,1fr)] gap-12 max-w-[1300px]")}>
                {tocItems.length > 0 && (
                  <nav className="hidden lg:block pt-2 sticky top-0 self-start">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Nesta página</span>
                    <ul className="mt-3 space-y-0.5 border-l border-slate-200 dark:border-slate-800">
                      {tocItems.map(item => (
                        <li key={item.id}>
                          <button
                            onClick={() => scrollToHeading(item.id)}
                            className={cn(
                              "block w-full text-left text-[10.5px] font-bold text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 -ml-px pl-3 py-1.5 border-l-2 border-transparent hover:border-cyan-600 transition-colors",
                              item.level >= 3 && "pl-6"
                            )}
                          >
                            {item.text}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </nav>
                )}
                <article>
                  <div className="mb-8 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-400 shadow-xs">
                          <Hash className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
                          <span className="text-[8px] font-black uppercase tracking-widest">{selectedFile.category}</span>
                        </div>
                        {selectedFile.tags && selectedFile.tags.map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-50/50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900/30 rounded-lg text-[8px] font-black uppercase tracking-widest text-cyan-700 dark:text-cyan-400 shadow-xs">
                            <Hash className="h-2.5 w-2.5 opacity-60" /> {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black font-headline uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 leading-tight">{selectedFile.title}</h1>
                    <div className="flex items-center gap-6 text-slate-400 dark:text-slate-500 pt-2 border-b border-slate-100 dark:border-slate-800 pb-6">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-[8px] font-black uppercase tracking-widest leading-none">Sync:</span>
                        <span className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase">{formatDocDate(selectedFile.updatedAt)}</span>
                      </div>
                      <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800" />
                      <div className="flex items-center gap-2">
                        <Database className="h-3.5 w-3.5" />
                        <span className="text-[8px] font-black uppercase tracking-widest leading-none">Tamanho:</span>
                        <span className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase">{(selectedFile.byteSize / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 pb-32">
                    <div className="prose prose-slate dark:prose-invert max-w-none">
                      <div
                        className="text-[14px] leading-relaxed text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(contentWithAnchors) || "Carregando conteúdo..." }}
                      />
                    </div>
                  </div>
                </article>
                </div>
              </ScrollArea>
            </div>
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
                    <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground px-2">
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
                        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
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
                            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground shrink-0 ml-2">
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {categoryCounts.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border/40">
                      <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground px-2">
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
                        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                          Rótulos
                        </span>
                        {selectedTags.length > 0 && (
                          <button onClick={() => setSelectedTags([])} className="text-[10px] font-medium text-primary hover:underline">
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
                                    'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
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
                  <ScrollArea className="flex-1">
                    <div className="pt-6 pb-32 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

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
                                  action: { label: 'Configurar', onClick: () => router.push('/workspace') },
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
                        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-2.5 animate-in fade-in slide-in-from-top-2">
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
                            <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-primary font-semibold">
                              <BookOpen className="h-3.5 w-3.5" />
                              Wiki Space
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                              Base de Conhecimento
                            </h1>
                            <p className="text-sm leading-relaxed text-muted-foreground max-w-xl">
                              Centralização, gestão e sincronização dos manuais e artigos da squad. Busque, importe do TDN e mantenha tudo atualizado num lugar só.
                            </p>
                          </div>

                          <div className="flex items-center gap-4 rounded-xl border border-border/80 bg-background/80 px-4 py-3 shadow-xs backdrop-blur-sm">
                            <div className="text-right">
                              <span className="block font-mono text-xl font-bold text-foreground leading-none">
                                {documents?.length || 0}
                              </span>
                              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                Artigos ativos
                              </span>
                            </div>
                            <div className="h-7 w-[1px] bg-border/80" />
                            <div className="text-right">
                              <span className="block font-mono text-xl font-bold text-primary leading-none">
                                {(documents?.reduce((acc, d) => acc + (d.byteSize || 0), 0) / 1024 / 1024).toFixed(1)}
                              </span>
                              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                MB usados
                              </span>
                            </div>
                            <div className="h-7 w-[1px] bg-border/80" />
                            <div className="text-right">
                              <span className="block font-mono text-xl font-bold text-foreground leading-none">
                                {documents?.filter(d => d.tdnId).length || 0}
                              </span>
                              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                Do TDN
                              </span>
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Busca + filtros ativos + ações em lote */}
                      <div className="space-y-3">
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
                            <div className="flex flex-wrap items-center gap-2 animate-in fade-in zoom-in duration-300">
                              <Button size="sm" className="gap-2" onClick={handleSyncMultiple} disabled={isSyncing}>
                                {isSyncing ? <AgileSpinner size="xs" /> : <RefreshCw className="h-4 w-4" />} Sincronizar ({selectedIds.size})
                              </Button>
                              <Button size="sm" variant="outline" className="gap-2" onClick={handleDownloadMultiple}>
                                <Download className="h-4 w-4" /> Baixar ({selectedIds.size})
                              </Button>
                              <Button size="sm" variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={handleDeleteMultiple}>
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
                                              <FileUp className="h-3.5 w-3.5 text-primary shrink-0" />
                                            ) : (
                                              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            )}
                                            {docItem.title}
                                          </span>
                                          {docItem.tags && docItem.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                              {docItem.tags.slice(0, 4).map(tag => (
                                                <span key={tag} className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium text-muted-foreground">
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
                                            <span className="text-[10px] text-muted-foreground ml-5">
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
                                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/knowledge/admin/new-asset?id=${docItem.id}`)} title="Editar">
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(docItem.id)} title="Excluir">
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
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
                                        <span className="text-xs text-muted-foreground">Nenhum documento encontrado nesta busca</span>
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

      {/* Modal Formato de Download */}
      <Dialog open={isDownloadFormatOpen} onOpenChange={setIsDownloadFormatOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-[3rem] border-none shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-slate-100">
              Escolher Formato
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
              Selecione o tipo de arquivo para a leitura local
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <RadioGroup 
              value={selectedFormat} 
              onValueChange={(val: any) => setSelectedFormat(val)}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-all cursor-pointer">
                <RadioGroupItem value="md" id="format-md" />
                <Label htmlFor="format-md" className="flex-1 cursor-pointer">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Markdown (.md)</div>
                  <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">Formatado e limpo, ideal para ler e editar localmente.</div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-all cursor-pointer">
                <RadioGroupItem value="html" id="format-html" />
                <Label htmlFor="format-html" className="flex-1 cursor-pointer">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">HTML (.html)</div>
                  <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">Preserva a estrutura original do editor para leitura no navegador.</div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-all cursor-pointer">
                <RadioGroupItem value="txt" id="format-txt" />
                <Label htmlFor="format-txt" className="flex-1 cursor-pointer">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Texto Puro (.txt)</div>
                  <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">Remove todas as formatações e mantém apenas o texto legível.</div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter className="border-t border-slate-100 dark:border-slate-800 pt-5 gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDownloadFormatOpen(false)}
              className="rounded-xl font-bold uppercase tracking-wider text-[10px] h-11 border-slate-200 dark:border-slate-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={executeDownload}
              className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-black uppercase tracking-wider text-[10px] h-11 shadow-lg shadow-cyan-500/10 px-5"
            >
              Confirmar Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function KBExplorerPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full w-full items-center justify-center bg-white dark:bg-slate-950">
        <AgileSpinner size="md" variant="indigo" />
      </div>
    }>
      <KBExplorerContent />
    </Suspense>
  );
}
