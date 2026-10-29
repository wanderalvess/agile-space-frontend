'use client';

import React, { useState, useEffect } from 'react';
import {
  CloudDownload, ShieldCheck, Loader2, Search, FileText, Settings, Download,
  RefreshCw, CheckCircle2, AlertCircle, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal, ModalButton } from '@/components/room-kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
      const cleanContent = parseConfluenceMacros(content);

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

  const footerStart = (
    <ModalButton variant="ghost" onClick={() => setShowConfig(!showConfig)}>
      <Settings className="mr-1.5 h-4 w-4" aria-hidden="true" />
      {showConfig ? 'Voltar para a busca' : 'Configurar acesso ao TDN'}
    </ModalButton>
  );

  return (
    <Modal
      open={open}
      onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}
      size="xl"
      className="sm:max-w-5xl"
      icon={CloudDownload}
      title="Buscar na Base de Conhecimento TDN"
      description="Importe ou atualize manuais e documentações técnicas do Confluence TDN."
      footerStart={footerStart}
      footer={
        <>
          <ModalButton onClick={() => { reset(); onClose(); }}>Fechar</ModalButton>
          {showConfig && <ModalButton variant="primary" onClick={handleSaveConfig}>Salvar configurações</ModalButton>}
        </>
      }
      headerExtra={
        !showConfig && (
          <div className="flex gap-2 px-6 pb-4">
            <div className="relative flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Pesquisar documentações no TDN"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Pesquisar no TDN..."
                className="h-10 pl-10 text-sm"
              />
            </div>
            <ModalButton variant="primary" onClick={handleSearch} disabled={loading} className="min-w-24">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Buscando" /> : 'Buscar'}
            </ModalButton>
          </div>
        )
      }
      bodyClassName="min-h-[16rem]"
    >
      <AnimatePresence mode="wait">
        {showConfig ? (
          <motion.div
            key="config"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 text-primary [.theme-totvs:not(.dark)_&]:text-foreground">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm font-semibold">Credenciais de acesso</span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tdn-base-url" className="text-xs font-semibold text-muted-foreground">Endereço do TDN</Label>
                <Input id="tdn-base-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="wiki.suaempresa.com.br" className="h-10 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tdn-token" className="text-xs font-semibold text-muted-foreground">Token de acesso (Bearer)</Label>
                <Input id="tdn-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Cole o token do Confluence" className="h-10 font-code text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tdn-space" className="text-xs font-semibold text-muted-foreground">Espaço (opcional)</Label>
                <Input id="tdn-space" value={space} onChange={(e) => setSpace(e.target.value)} placeholder="Ex.: Framework, Protheus" className="h-10 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tdn-label" className="text-xs font-semibold text-muted-foreground">Marcador (opcional)</Label>
                <Input id="tdn-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: manual, api" className="h-10 text-sm" />
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="search"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
          >
            {results.length > 0 ? (
              <div className="space-y-2.5">
              {results.map((item) => {
                const isAlreadyImported = importedIds.includes(`tdn_${item.id}`);
                return (
                  <div
                    key={item.id}
                    className="p-3 border-2 border-border rounded-2xl bg-card dark:bg-card/30 flex items-center justify-between group hover:border-border transition-all"
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-bold text-primary [.theme-totvs:not(.dark)_&]:text-foreground tracking-normal">
                          ID: {item.id}
                        </span>
                        {item.space && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-muted/60 dark:bg-muted text-muted-foreground tracking-normal">
                            {item.space}
                          </span>
                        )}
                        {isAlreadyImported && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30 tracking-normal">
                            Importado
                          </span>
                        )}
                        {item.lastModified && (
                          <span className="text-xs font-medium text-muted-foreground">
                            Alt: {new Date(item.lastModified).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                      <h4 className="truncate text-sm font-semibold text-foreground" title={item.title}>
                        {item.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-muted-foreground dark:hover:text-foreground flex items-center justify-center hover:bg-muted/40 dark:hover:bg-muted transition-all"
                        title="Abrir link original"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDownloadDirect(item)}
                        disabled={downloadingId === item.id || importingId === item.id}
                        className="h-8 w-8 rounded-lg border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
                        title="Baixar Markdown (.md)"
                      >
                        {downloadingId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary [.theme-totvs:not(.dark)_&]:text-foreground" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        onClick={() => handleImport(item)}
                        disabled={importingId === item.id || downloadingId === item.id}
                        className={`h-8 px-3.5 rounded-lg text-xs font-bold  tracking-normal gap-1 shadow-sm transition-all ${
                          isAlreadyImported
                            ? "bg-primary hover:bg-primary text-foreground"
                            : "bg-primary hover:bg-primary text-foreground"
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
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20 p-8 text-center">
                <FileText className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-semibold text-foreground">Aguardando termo de pesquisa</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">Busque páginas por palavra-chave e importe-as diretamente como documentos locais indexados.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
