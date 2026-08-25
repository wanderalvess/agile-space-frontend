"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
  Sparkles, 
  FolderTree,
  ChevronRight, 
  Database,
  CheckCircle2,
  FileUp,
  Users,
  History,
  LayoutGrid,
  RefreshCw,
  Download,
  BookOpen,
  Star,
  Hash
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import { knowledgeApi } from '../api';
import type { KnowledgeDocument } from '@/lib/knowledge-types';
import { EliteSpinner } from '@/components/ui/EliteSpinner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTdnSettings } from '@/hooks/useTdnSettings';
import { getTdnPageContent, importTdnToKnowledgeBase, parseConfluenceMacros } from '@/services/tdnService';
import { TdnImportDialog } from '@/components/knowledge/TdnImportDialog';

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  if (typeof window === 'undefined') return str;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = str;
  return textarea.value;
}

function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let markdown = html;

  // Headers
  markdown = markdown.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n');
  markdown = markdown.replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n');
  markdown = markdown.replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n');
  markdown = markdown.replace(/<h4>(.*?)<\/h4>/gi, '#### $1\n\n');
  
  // Paragraphs
  markdown = markdown.replace(/<p>(.*?)<\/p>/gi, '$1\n\n');
  
  // Bold/Italic
  markdown = markdown.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b>(.*?)<\/b>/gi, '**$1**');
  markdown = markdown.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i>(.*?)<\/i>/gi, '*$1*');
  
  // Code blocks & inline code
  markdown = markdown.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, '```\n$1\n```\n\n');
  markdown = markdown.replace(/<code>(.*?)<\/code>/gi, '`$1`');
  
  // Lists
  markdown = markdown.replace(/<li>(.*?)<\/li>/gi, '- $1\n');
  markdown = markdown.replace(/<\/ul>/gi, '\n');
  markdown = markdown.replace(/<\/ol>/gi, '\n');
  markdown = markdown.replace(/<ul[^>]*>/gi, '');
  markdown = markdown.replace(/<ol[^>]*>/gi, '');
  
  // Line breaks & entities
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
  markdown = markdown.replace(/<[^>]+>/g, '');
  
  // Decode entities using textarea helper
  markdown = decodeHtmlEntities(markdown);

  return markdown.replace(/\n{3,}/g, '\n\n').trim();
}

function htmlToPlainText(html: string): string {
  if (!html) return '';
  let text = html;
  text = text.replace(/<br\s*\/?>/gi, '\n')
             .replace(/<\/p>/gi, '\n\n')
             .replace(/<\/h[1-6]>/gi, '\n\n')
             .replace(/<\/li>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode entities using textarea helper
  text = decodeHtmlEntities(text);
  
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

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
      const saved = localStorage.getItem('kb_favorites');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  // Estados de Gestão (vindos do admin)
  const [searchTerm, setSearchTerm] = useState('');
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

    if (failedDocsList.length > 0) {
      setFailedDocs(failedDocsList);
    }

    toast.success(`${tdnCount} de ${tdnDocs.length} manuais sincronizados com sucesso.`);
    fetchDocuments();
    setIsSyncing(false);
  };

  const handleSyncMultiple = async () => {
    if (selectedIds.size === 0 || !session || !tdnSettings) return;
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

    if (failedDocsList.length > 0) {
      setFailedDocs(failedDocsList);
    }

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

  // Filtro definitivo (Pesquisa + Rótulos selecionados)
  const finalDocs = useMemo(() => {
    if (selectedTags.length === 0) return filteredDocs;
    return filteredDocs.filter(doc => 
      doc.tags && selectedTags.every(tag => doc.tags?.includes(tag))
    );
  }, [filteredDocs, selectedTags]);

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

  return (
    <div className="flex flex-col h-full w-full bg-slate-50/30 dark:bg-slate-950/20 overflow-hidden relative">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-150 dark:bg-cyan-950/20 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-150 dark:bg-indigo-950/20 rounded-full blur-[120px] pointer-events-none -z-10" />

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <EliteSpinner size="md" variant="indigo" />
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
                      className="text-[9px] font-black uppercase text-slate-450 dark:text-slate-555 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors tracking-widest leading-none"
                    >
                      Base de Conhecimento
                    </button>
                    <ChevronRight className="h-3 w-3 text-slate-355 dark:text-slate-700" />
                    <span className="text-[10px] font-black uppercase text-slate-900 dark:text-slate-150 leading-none truncate max-w-[250px] md:max-w-md">{selectedFile.title}</span>
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
                      className="h-9 px-4 rounded-xl border-slate-300 dark:border-slate-800 text-[9px] font-black uppercase tracking-widest gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-150 hover:bg-slate-50 dark:hover:bg-slate-900 shadow-xs"
                    >
                      {isSyncingDoc ? <EliteSpinner size="xs" /> : <RefreshCw className="h-3.5 w-3.5" />} 
                      {isSyncingDoc ? 'Sincronizando...' : 'Sincronizar'}
                    </Button>
                  )}

                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsDownloadFormatOpen(true)} 
                    className="h-9 px-4 rounded-xl border-slate-300 dark:border-slate-800 text-[9px] font-black uppercase tracking-widest gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-150 hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    Exportar <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => router.push(`/knowledge/admin/new-asset?id=${selectedFile.id}`)} className="h-9 px-4 rounded-xl border-slate-300 dark:border-slate-800 text-[9px] font-black uppercase tracking-widest gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-150 hover:bg-slate-50 dark:hover:bg-slate-900">
                    Editar <FileText className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </header>

              <ScrollArea className="flex-1">
                <article className="max-w-[1300px] mx-auto px-6 md:px-12 pt-6 pb-32 min-h-screen">
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
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedFile.content) || "Carregando conteúdo..." }}
                      />
                    </div>
                  </div>
                </article>
              </ScrollArea>
            </div>
          ) : (
            /* ========================================================================= */
            /* 2. PAINEL DE GESTÃO DE DOCUMENTOS UNIFICADO (ANTIGO ADMIN)                */
            /* ========================================================================= */
            <ScrollArea className="flex-1">
              <div className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-12 pt-8 pb-32 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                
                {/* Título e Ação Rápida */}
                <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-100 dark:border-slate-800 pb-6 gap-4">
                  <div className="space-y-2">
                    <h1 className="text-3xl font-black font-headline uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 leading-none">
                      Base de <span className="text-cyan-600 not-italic">Conhecimento</span>
                    </h1>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-555">
                      Centralização, Gestão e Sincronização da Wiki Space • {documents?.length || 0} Artigos
                    </p>
                  </div>
                </div>

                {/* Bento Grid para Stats e Ações Rápidas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Card 3: Painel de Ações Bento Widget (Expandido para md:col-span-2) */}
                  <Card className="p-6 bg-white/60 dark:bg-slate-900/60 border border-slate-300/80 dark:border-slate-800/80 rounded-[2rem] shadow-xs flex flex-col justify-between min-h-[212px] md:col-span-2 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-700" />
                    <div className="space-y-2 relative z-10">
                      <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <LayoutGrid className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Painel de Ações Administrativas</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <Button onClick={() => setIsTdnOpen(true)} className="h-11 px-4 bg-cyan-50/80 dark:bg-cyan-950/40 border border-cyan-300/60 dark:border-cyan-900/30 text-cyan-700 dark:text-cyan-400 font-black uppercase text-[9px] tracking-wider rounded-xl hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-all gap-2 justify-start shadow-none">
                          <Search className="h-4.5 w-4.5" /> Buscar e Importar TDN
                        </Button>
                        <Button onClick={handleSyncManuals} disabled={isSyncing} className="h-11 px-4 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-300/60 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-black uppercase text-[9px] tracking-wider rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all gap-2 justify-start shadow-none">
                          {isSyncing ? <EliteSpinner size="xs" /> : <RefreshCw className="h-4.5 w-4.5" />} Sincronizar Manuais
                        </Button>
                        <Button onClick={() => router.push('/knowledge/trash')} className="h-11 px-4 bg-slate-100/85 dark:bg-slate-800/60 border border-slate-300/60 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-black uppercase text-[9px] tracking-wider rounded-xl hover:bg-slate-200/80 dark:hover:bg-slate-700 transition-all gap-2 justify-start shadow-none">
                          <Trash2 className="h-4.5 w-4.5" /> Acessar Lixeira
                        </Button>
                        <Button onClick={() => router.push('/knowledge/admin/new-asset')} className="h-11 px-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-black uppercase text-[9px] tracking-wider shadow-md hover:bg-black dark:hover:bg-slate-200 gap-2 justify-start">
                          <Plus className="h-4.5 w-4.5 text-cyan-500 dark:text-cyan-400" /> Criar Novo Artigo
                        </Button>
                      </div>
                    </div>
                  </Card>

                  {/* Coluna de Stats (Empilhados Verticalmente, totalizando h ~212px) */}
                  <div className="flex flex-col gap-4 md:col-span-1">
                    
                    {/* Card 1: Total de Documentos (Compacto) */}
                    <Card className="p-4 bg-slate-950 dark:bg-slate-900/60 border border-slate-800 dark:border-slate-800/60 text-white rounded-2xl shadow-lg relative overflow-hidden group flex flex-col justify-between h-[98px]">
                      <div className="absolute top-0 right-0 p-4 opacity-[0.02] scale-100 pointer-events-none group-hover:scale-125 transition-transform duration-750">
                        <FileText className="h-16 w-16" />
                      </div>
                      <div className="flex items-center justify-between relative z-10">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-600/20 border border-cyan-500/30 rounded-lg text-cyan-400 scale-90 origin-left">
                          <Database className="h-2.5 w-2.5" />
                          <span className="text-[7px] font-black uppercase tracking-widest">Biblioteca</span>
                        </div>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ativos</span>
                      </div>
                      <div className="flex items-baseline justify-between relative z-10">
                        <p className="text-2xl font-black text-white leading-none">{documents?.length || 0}</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tight">Artigos ativos</p>
                      </div>
                      <div className="text-[7px] font-black text-slate-500 uppercase flex justify-between items-center border-t border-white/5 pt-1.5 mt-1">
                        <span>Espaço</span>
                        <span className="text-cyan-400 font-black">{(documents?.reduce((acc, d) => acc + (d.byteSize || 0), 0) / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </Card>

                    {/* Card 2: Visualizações Totais (Compacto) */}
                    <Card className="p-4 bg-gradient-to-br from-violet-600 to-indigo-700 dark:from-violet-950/70 dark:to-indigo-950/70 border-none text-white rounded-2xl shadow-lg relative overflow-hidden group flex flex-col justify-between h-[98px]">
                      <div className="absolute top-0 right-0 p-4 opacity-[0.03] scale-100 pointer-events-none group-hover:scale-125 transition-transform duration-750">
                        <Sparkles className="h-16 w-16" />
                      </div>
                      <div className="flex items-center justify-between relative z-10">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 border border-white/20 rounded-lg text-violet-100 scale-90 origin-left">
                          <Users className="h-2.5 w-2.5" />
                          <span className="text-[7px] font-black uppercase tracking-widest">Leituras</span>
                        </div>
                        <span className="text-[8px] font-black text-violet-200/80 uppercase tracking-widest">Cliques</span>
                      </div>
                      <div className="flex items-baseline justify-between relative z-10">
                        <p className="text-2xl font-black text-white leading-none">{documents?.reduce((acc, d) => acc + ((d as { views?: number }).views || 0), 0) || 0}</p>
                        <p className="text-[8px] text-violet-200/80 font-bold uppercase tracking-tight">Visualizações</p>
                      </div>
                      <div className="text-[7px] font-black text-violet-200/60 uppercase flex justify-between items-center border-t border-white/5 pt-1.5 mt-1">
                        <span>Indexador</span>
                        <span className="text-emerald-400 font-black flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> ON
                        </span>
                      </div>
                    </Card>

                  </div>

                </div>

                {/* Seção Principal: Busca e Tabela de Gestão */}
                <div className="space-y-4 pt-2">
                  
                  {/* Barra de Busca e Filtro */}
                  <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white/60 dark:bg-slate-900/60 border border-slate-300/80 dark:border-slate-800/80 rounded-2xl p-4 backdrop-blur-md shadow-sm">
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:max-w-xl">
                      <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <Input
                          type="text"
                          placeholder="Pesquisar por título, categoria ou pasta..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 pr-4 h-10 w-full bg-slate-50/50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-800 focus-visible:ring-cyan-500 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>

                      {/* Select List de Rótulos (Dropdown) */}
                      {availableTags.length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="h-10 px-4 bg-white/80 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 gap-2 shrink-0"
                            >
                              <Hash className="h-4 w-4 text-cyan-500" />
                              <span>Rótulos</span>
                              {selectedTags.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 text-[9px] font-black bg-cyan-600 dark:bg-cyan-500 text-white rounded-md tabular-nums">
                                  {selectedTags.length}
                                </span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl" align="start">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Filtrar por Rótulo</span>
                                {selectedTags.length > 0 && (
                                  <button onClick={() => setSelectedTags([])} className="text-[9px] font-black uppercase text-rose-600 hover:underline">
                                    Limpar
                                  </button>
                                )}
                              </div>
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <Input 
                                  type="text" 
                                  placeholder="Buscar rótulo..." 
                                  value={tagSearchTerm}
                                  onChange={(e) => setTagSearchTerm(e.target.value)}
                                  className="pl-8 pr-2 h-8 w-full bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 focus-visible:ring-cyan-500 rounded-lg text-[11px] placeholder:text-slate-400"
                                />
                              </div>
                              <ScrollArea className="h-48 pr-2">
                                <div className="space-y-1">
                                  {availableTags
                                    .filter(tag => tag.toLowerCase().includes(tagSearchTerm.toLowerCase()))
                                    .map(tag => {
                                      const isChecked = selectedTags.includes(tag);
                                      return (
                                        <div 
                                          key={tag} 
                                          onClick={() => {
                                            setSelectedTags(prev => 
                                              isChecked ? prev.filter(t => t !== tag) : [...prev, tag]
                                            );
                                          }}
                                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                                        >
                                          <Checkbox checked={isChecked} onCheckedChange={() => {}} className="pointer-events-none" />
                                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">{tag}</span>
                                        </div>
                                      );
                                    })}
                                </div>
                              </ScrollArea>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>

                    {/* Filtros Ativos Renderizados Compactamente */}
                    {selectedTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 items-center px-2 py-1 bg-white/40 dark:bg-slate-900/40 border border-slate-300/50 dark:border-slate-800/50 rounded-xl max-w-max animate-in fade-in slide-in-from-top-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mr-1 pl-1">Filtros ativos:</span>
                        {selectedTags.map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 bg-cyan-50/80 dark:bg-cyan-950/40 border border-cyan-300/60 dark:border-cyan-900/30 text-cyan-700 dark:text-cyan-400 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider">
                            <Hash className="h-2 w-2 opacity-60" />
                            {tag}
                            <button onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))} className="hover:text-rose-600 transition-colors ml-0.5 font-bold text-[10px]">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                      {selectedIds.size > 0 && (
                        <div className="flex flex-wrap items-center gap-2 animate-in fade-in zoom-in duration-300">
                          <Button 
                            onClick={handleSyncMultiple} 
                            disabled={isSyncing}
                            className="h-10 px-4 bg-indigo-600 dark:bg-indigo-600 hover:bg-indigo-700 dark:hover:bg-indigo-500 text-white rounded-xl font-black uppercase text-[9px] tracking-widest gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
                          >
                            {isSyncing ? <EliteSpinner size="xs" /> : <RefreshCw className="h-4 w-4" />} Sincronizar ({selectedIds.size})
                          </Button>
                          
                          <Button 
                            onClick={handleDownloadMultiple} 
                            className="h-10 px-4 bg-emerald-600 dark:bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-500 text-white rounded-xl font-black uppercase text-[9px] tracking-widest gap-2 shadow-md transition-all active:scale-95"
                          >
                            <Download className="h-4 w-4" /> Baixar ({selectedIds.size})
                          </Button>
         
                          <Button 
                            onClick={handleDeleteMultiple} 
                            className="h-10 px-4 bg-rose-600 dark:bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white rounded-xl font-black uppercase text-[9px] tracking-widest gap-2 shadow-md transition-all active:scale-95"
                          >
                            <Trash2 className="h-4 w-4" /> Excluir ({selectedIds.size})
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
 
                  {/* Tabela de Alta Densidade com layout Bento */}
                  <div className="bg-white/60 dark:bg-slate-900/60 border border-slate-300/80 dark:border-slate-800/80 rounded-[2.5rem] shadow-xl backdrop-blur-md overflow-hidden">
                    {isLoading ? (
                      <div className="py-40 flex flex-col items-center justify-center gap-4">
                        <EliteSpinner size="md" variant="indigo" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 animate-pulse">Carregando Base...</span>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full table-auto">
                          <thead>
                            <tr className="bg-slate-50/80 dark:bg-slate-950/80 border-b border-slate-300 dark:border-slate-800">
                              <th className="px-4 py-4 text-left w-12">
                                <Checkbox 
                                  checked={selectedIds.size === finalDocs.length && finalDocs.length > 0} 
                                  onCheckedChange={toggleSelectAll}
                                />
                              </th>
                              <th className="px-4 py-4 text-left text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-555">Título do Documento</th>
                              <th className="px-4 py-4 text-left text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-555">Módulo / Pasta</th>
                              <th className="px-4 py-4 text-left text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-555">Categoria</th>
                              <th className="px-4 py-4 text-left text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-555">Atualização</th>
                              <th className="px-4 py-4 text-right pr-6 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-555 w-36">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {finalDocs.map((docItem) => {
                              const moduleName = docItem.fullPath?.split('/')[0]?.trim() || "Raiz";
                              const subFolder = docItem.fullPath?.split('/')?.slice(1)?.join(' / ')?.trim();
                              return (
                                <tr key={docItem.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/40 dark:hover:bg-slate-900/10 transition-colors group">
                                  <td className="px-4 py-3">
                                    <Checkbox 
                                      checked={selectedIds.has(docItem.id)} 
                                      onCheckedChange={() => toggleSelect(docItem.id)}
                                    />
                                  </td>
                                  <td className="px-4 py-3 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50" onClick={() => handleOpenDoc(docItem)}>
                                    <div className="flex flex-col">
                                      <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight italic flex items-center gap-1.5">
                                        {docItem.tdnId ? (
                                          <FileUp className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
                                        ) : (
                                          <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                        )}
                                        {docItem.title}
                                      </span>
                                      {docItem.tags && docItem.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5 max-h-5 overflow-hidden">
                                          {docItem.tags.slice(0, 4).map(tag => (
                                            <span key={tag} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded text-[7px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none">
                                              {tag}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                      <span className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                        <FolderTree className="h-3.5 w-3.5 text-slate-400" /> {moduleName}
                                      </span>
                                      {subFolder && (
                                        <span className="text-[8px] font-black uppercase text-slate-400 dark:text-slate-505 ml-4">
                                          {subFolder}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-[9px] font-black uppercase bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-400 shadow-3xs">
                                      {docItem.category}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                                      <span className="text-[10px] font-black uppercase text-slate-900 dark:text-slate-100 tabular-nums">
                                        {formatDocDate(docItem.updatedAt)}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right pr-6">
                                    <div className="flex justify-end gap-1.5 transition-all">
                                      <Button size="icon" className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-300/80 dark:border-slate-700/40 text-slate-600 dark:text-slate-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 hover:text-cyan-600 dark:hover:text-cyan-400 shadow-none" onClick={() => handleDownload(docItem)} title="Baixar Documento">
                                        <Download className="h-4 w-4" />
                                      </Button>
                                      <Button size="icon" className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-300/80 dark:border-slate-700/40 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-none" onClick={() => router.push(`/knowledge/admin/new-asset?id=${docItem.id}`)}>
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button size="icon" className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-300/80 dark:border-slate-700/40 text-slate-555 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 shadow-none" onClick={() => handleDelete(docItem.id)}>
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
                                    <ShieldAlert className="h-8 w-8 text-slate-300 dark:text-slate-700 animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-555">Nenhum documento encontrado nesta busca</span>
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

              </div>
            </ScrollArea>
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
        <DialogContent className="sm:max-w-[440px] rounded-[3rem] border-none shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-slate-100">
              Escolher Formato
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest mt-1">
              Selecione o tipo de arquivo para a leitura local
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <RadioGroup 
              value={selectedFormat} 
              onValueChange={(val: any) => setSelectedFormat(val)}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 p-3.5 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-all cursor-pointer">
                <RadioGroupItem value="md" id="format-md" />
                <Label htmlFor="format-md" className="flex-1 cursor-pointer font-sans">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Markdown (.md)</div>
                  <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">Formatado e limpo, ideal para ler e editar localmente.</div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-3.5 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-all cursor-pointer">
                <RadioGroupItem value="html" id="format-html" />
                <Label htmlFor="format-html" className="flex-1 cursor-pointer font-sans">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">HTML (.html)</div>
                  <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">Preserva a estrutura original do editor para leitura no navegador.</div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-3.5 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-all cursor-pointer">
                <RadioGroupItem value="txt" id="format-txt" />
                <Label htmlFor="format-txt" className="flex-1 cursor-pointer font-sans">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Texto Puro (.txt)</div>
                  <div className="text-[10px] font-medium text-slate-400 dark:text-slate-555 mt-0.5">Remove todas as formatações e mantém apenas o texto legível.</div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter className="border-t border-slate-150 dark:border-slate-800 pt-5 gap-2">
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
        <EliteSpinner size="md" variant="indigo" />
      </div>
    }>
      <KBExplorerContent />
    </Suspense>
  );
}
