'use client';

import React, { useState, useEffect } from 'react';
import {
  CloudDownload, ShieldCheck, Loader2, Search, FileText, Settings, Download,
  RefreshCw, CheckCircle2, AlertCircle, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTdnSettings } from '@/hooks/useTdnSettings';
import { searchTdn, TdnSearchResult, getTdnPageContent, importTdnToKnowledgeBase, parseConfluenceMacros } from '@/services/tdnService';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface TdnImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
  importedIds?: string[];
}

export function TdnImportDialog({ open, onClose, onImportSuccess, importedIds = [] }: TdnImportDialogProps) {
  const { session } = useAuth();
  const { settings, loading: loadingSettings, saveSettings } = useTdnSettings();

  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TdnSearchResult[]>([]);

  // Config State
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [space, setSpace] = useState('');
  const [label, setLabel] = useState('');
  const [saveDefault, setSaveDefault] = useState(true);

  // Load saved settings
  useEffect(() => {
    if (settings && open) {
      setBaseUrl(settings.baseUrl || '');
      setToken(settings.token || '');
      setSpace(settings.space || '');
      setLabel(settings.label || '');
      // If there are no settings, show config by default
      if (!settings.token) {
        setShowConfig(true);
      }
    } else if (!settings && !loadingSettings && open) {
      setShowConfig(true);
    }
  }, [settings, open, loadingSettings]);

  const handleSaveConfig = async () => {
    if (!baseUrl || !token) {
      toast.error('Preencha pelo menos a URL e o Token/Token de Acesso.');
      return;
    }

    try {
      await saveSettings({ baseUrl, token, space, label });
      toast.success('Configurações do TDN salvas!');
      setShowConfig(false);
    } catch (error) {
      toast.error('Erro ao salvar configurações.');
    }
  };

  const handleSearch = async () => {
    if (!baseUrl || !token) {
      toast.error('Por favor, configure o TDN primeiro.');
      setShowConfig(true);
      return;
    }
    if (!query.trim() && !space && !label) {
      toast.error('Digite um termo de pesquisa ou configure um espaço/marcador nas configurações.');
      return;
    }

    setLoading(true);
    try {
      const data = await searchTdn(baseUrl, token, query, space || undefined, label || undefined);
      setResults(data);
      if (data.length === 0) {
        toast.info('Nenhum documento encontrado no TDN.');
      } else {
        toast.success(`${data.length} resultados encontrados.`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao buscar no TDN.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (item: TdnSearchResult) => {
    if (!session) {
      toast.error('Usuário não autenticado.');
      return;
    }
    setImportingId(item.id);
    try {
      const fullContent = await getTdnPageContent(baseUrl, token, item.id);
      await importTdnToKnowledgeBase(session.id, {
        id: item.id,
        title: item.title,
        content: fullContent.content || '',
        space: item.space || space || 'Wiki',
        link: item.link || `https://${baseUrl}/pages/viewpage.action?pageId=${item.id}`,
        labels: fullContent.labels || item.labels || []
      });
      toast.success(`"${item.title}" importado com sucesso!`);
      if (onImportSuccess) onImportSuccess();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao importar documento.');
    } finally {
      setImportingId(null);
    }
  };

  const handleDownloadDirect = async (item: TdnSearchResult) => {
    setDownloadingId(item.id);
    try {
      const fullContent = await getTdnPageContent(baseUrl, token, item.id);
      const content = fullContent.content || '';
      
      // Clean and structure Confluence macro contents
      let cleanContent = parseConfluenceMacros(content);

      const blob = new Blob([cleanContent], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `${item.title.replace(/[^\p{L}\p{N}\s\-_]/gu, '') || 'document'}.md`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Download iniciado!");
    } catch (error) {
      console.error(error);
      toast.error('Erro ao baixar documento.');
    } finally {
      setDownloadingId(null);
    }
  };

  const reset = () => {
    setResults([]);
    setQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] rounded-[2rem] p-0 border-none shadow-3xl overflow-hidden bg-white dark:bg-slate-900 flex flex-col">
        <DialogHeader className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12">
            <CloudDownload className="h-16 w-16 text-cyan-500" />
          </div>
          <div className="relative z-10 flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-600/20 shrink-0">
                <CloudDownload className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100 leading-none">
                  Buscar na Base de Conhecimento TDN
                </DialogTitle>
                <DialogDescription className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed max-w-sm">
                  Importe ou atualize manuais e documentações técnicas do Confluence TDN.
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowConfig(!showConfig)}
              className={`h-8 w-8 rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all ${showConfig ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600' : ''}`}
              title="Configurações do TDN"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col p-6 min-h-0">
          <AnimatePresence mode="wait">
            {showConfig ? (
              <motion.div
                key="config"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-4 flex flex-col justify-between h-full"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Credenciais de Acesso</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Base URL do TDN</Label>
                      <Input
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder="wiki.suaempresa.com.br"
                        className="h-10 rounded-xl text-[11px] font-bold bg-slate-50 dark:bg-slate-950 border-transparent dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-cyan-200 dark:focus:border-cyan-950 text-slate-700 dark:text-slate-200 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Token de Acesso (Bearer)</Label>
                      <Input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Insira o Token do Confluence..."
                        className="h-10 rounded-xl text-[11px] font-mono bg-slate-50 dark:bg-slate-950 border-transparent dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-cyan-200 dark:focus:border-cyan-950 text-slate-700 dark:text-slate-200 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Espaço (Space Key - Opcional)</Label>
                      <Input
                        value={space}
                        onChange={(e) => setSpace(e.target.value)}
                        placeholder="Ex: Framework, Protheus..."
                        className="h-10 rounded-xl text-[11px] font-bold bg-slate-50 dark:bg-slate-950 border-transparent dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-cyan-200 dark:focus:border-cyan-950 text-slate-700 dark:text-slate-200 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Marcador (Label - Opcional)</Label>
                      <Input
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="Ex: manual, api..."
                        className="h-10 rounded-xl text-[11px] font-bold bg-slate-50 dark:bg-slate-950 border-transparent dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-cyan-200 dark:focus:border-cyan-950 text-slate-700 dark:text-slate-200 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="outline"
                    onClick={() => setShowConfig(false)}
                    className="h-10 px-5 rounded-xl font-black uppercase text-[9px] tracking-widest text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900 transition-all border-slate-200 dark:border-slate-800"
                  >
                    Voltar para Busca
                  </Button>
                  <Button
                    onClick={handleSaveConfig}
                    className="h-10 px-6 bg-cyan-600 hover:bg-cyan-700 text-white font-black uppercase tracking-[0.1em] text-[10px] rounded-xl shadow-xl shadow-cyan-600/10 transition-all active:scale-95"
                  >
                    Salvar Configurações
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="search"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex flex-col flex-1 min-h-0 space-y-4"
              >
                {/* Search Bar */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Pesquisar documentações no TDN..."
                      className="h-10 pl-10 rounded-xl text-[11px] font-bold bg-slate-50 dark:bg-slate-950 border-transparent dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-cyan-200 dark:focus:border-cyan-950 text-slate-700 dark:text-slate-200 transition-all"
                    />
                  </div>
                  <Button
                    onClick={handleSearch}
                    disabled={loading}
                    className="h-10 px-6 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-black dark:hover:bg-slate-200 font-black uppercase tracking-[0.1em] text-[10px] rounded-xl transition-all"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                  </Button>
                </div>

                {/* Results list */}
                <div className="flex-1 min-h-0 flex flex-col">
                  {results.length > 0 ? (
                    <div className="flex-1 overflow-y-auto pr-3 -mr-3 custom-scrollbar">
                      <div className="space-y-2.5 pb-4">
                        {results.map((item) => {
                          const isAlreadyImported = importedIds.includes(`tdn_${item.id}`);
                          return (
                            <div
                              key={item.id}
                              className="p-3 border-2 border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/30 flex items-center justify-between group hover:border-slate-200 dark:hover:border-slate-700 transition-all"
                            >
                              <div className="min-w-0 flex-1 pr-4">
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  <span className="text-[8px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">
                                    ID: {item.id}
                                  </span>
                                  {item.space && (
                                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                      {item.space}
                                    </span>
                                  )}
                                  {isAlreadyImported && (
                                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30 uppercase tracking-widest">
                                      Importado
                                    </span>
                                  )}
                                  {item.lastModified && (
                                    <span className="text-[8px] font-medium text-slate-400 dark:text-slate-500">
                                      Alt: {new Date(item.lastModified).toLocaleDateString('pt-BR')}
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight line-clamp-1 italic">
                                  {item.title}
                                </h4>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                                  title="Abrir link original"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleDownloadDirect(item)}
                                  disabled={downloadingId === item.id || importingId === item.id}
                                  className="h-8 w-8 rounded-lg border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-cyan-600 hover:border-cyan-200 transition-all"
                                  title="Baixar Markdown (.md)"
                                >
                                  {downloadingId === item.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-600" />
                                  ) : (
                                    <Download className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                                <Button
                                  onClick={() => handleImport(item)}
                                  disabled={importingId === item.id || downloadingId === item.id}
                                  className={`h-8 px-3.5 rounded-lg text-[9px] font-black uppercase tracking-widest gap-1 shadow-sm transition-all ${
                                    isAlreadyImported
                                      ? "bg-indigo-650 hover:bg-indigo-700 text-white"
                                      : "bg-cyan-600 hover:bg-cyan-700 text-white"
                                  }`}
                                  title={isAlreadyImported ? "Atualizar documento na base" : "Importar para a Base Local"}
                                >
                                  {importingId === item.id ? (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      <span>Lendo...</span>
                                    </>
                                  ) : (
                                    <>
                                      {isAlreadyImported ? <RefreshCw className="h-3 w-3" /> : <CloudDownload className="h-3 w-3" />}
                                      <span>{isAlreadyImported ? "Atualizar" : "Importar"}</span>
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 text-center bg-slate-50/20 dark:bg-slate-900/10">
                      <FileText className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                      <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Aguardando termo de pesquisa</p>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 max-w-xs mt-1">Busque páginas por palavra-chave e importe-as diretamente como documentos locais indexados.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="p-4 px-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end shrink-0">
          <Button
            variant="outline"
            onClick={() => { reset(); onClose(); }}
            className="h-10 px-5 rounded-xl font-black uppercase text-[9px] tracking-widest text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900 transition-all border-slate-200 dark:border-slate-800"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
