'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Sparkles,
  Send,
  BookOpen,
  X,
  Loader2,
  ChevronRight,
  Database,
  Globe,
  Download,
  FileText,
  Copy,
  Check
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FIELD, IconTile, StatusChip } from '@/components/room-kit';
import { plainSnippet } from '@/lib/poker-table';

import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTdnSettings } from '@/hooks/useTdnSettings';
import { searchTdn, TdnSearchResult, getTdnPageContent, importTdnToKnowledgeBase } from '@/services/tdnService';
import { knowledgeApi } from '@/app/knowledge/api';
import { analyzeDocument, TechnicalExtraction } from '@/lib/tech-extractor';
import { KnowledgeDocument } from '@/lib/knowledge-types';

interface ExtractedDoc extends KnowledgeDocument {
  tech?: TechnicalExtraction;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  docs?: ExtractedDoc[];
  tdnResults?: TdnSearchResult[];
  extractedEndpoints?: string[];
  extractedTables?: string[];
}

interface PokerChatProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
  activeTopic?: string;
  activeIssue?: any;
}

export function PokerChat({ isOpen, onClose, activeTopic, activeIssue }: PokerChatProps) {
  const { session } = useAuth();
  const { settings: tdnSettings } = useTdnSettings();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isImporting, setIsImporting] = useState<string | null>(null);
  const [useContext, setUseContext] = useState(true);
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: activeIssue
            ? `Olá! Estou analisando a documentação para a tarefa **${activeIssue.title}**. O que você deseja consultar (ex: API de pedido, tabela, serviço)?`
            : 'Olá! Sou o Assistente Técnico da Base de Conhecimento. Digite sua dúvida (ex: "api de pedido", "winthor-faturamento", "tabela PCPEDC") para buscar instantaneamente.',
          timestamp: Date.now()
        }
      ]);
    }
  }, [activeIssue]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isOpen]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(text);
    toast({
      title: 'Copiado!',
      description: `${label} copiado para a área de transferência.`,
    });
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    const userQuery = input.trim();
    setInput('');
    setIsLoading(true);

    // Extrai palavras-chave significativas removendo stopwords em português
    const STOP_WORDS = new Set([
      'qual', 'quais', 'como', 'onde', 'quando', 'porque', 'por', 'que', 'de', 'do', 'da', 'dos', 'das',
      'um', 'uma', 'uns', 'umas', 'em', 'no', 'na', 'nos', 'nas', 'para', 'pra', 'com', 'sem', 'este',
      'esta', 'esse', 'essa', 'aquele', 'aquela', 'tem', 'temos', 'e', 'ou', 'a', 'o', 'as', 'os'
    ]);
    const cleanKeywords = userQuery
      .toLowerCase()
      .split(/\s+/)
      .map(w => w.replace(/[^a-zA-Z0-9\-_]/g, ''))
      .filter(w => w.length > 1 && !STOP_WORDS.has(w))
      .join(' ');

    const searchQuery = cleanKeywords || userQuery;

    try {
      // 1. Busca semântica local (embedding via transformers.js, sem LLM) na Base de Conhecimento.
      // Usa userQuery bruto, não searchQuery sem stopwords — stopword-stripping ajuda
      // LIKE/CQL, atrapalha um modelo de embedding, que quer frase natural completa.
      const loadRecentDocsFallback = async (): Promise<ExtractedDoc[]> => {
        const allKbResponse = await knowledgeApi.listDocuments('', [], 0, 20);
        return (allKbResponse?.content || []).map(doc => ({
          ...doc,
          tech: analyzeDocument(doc.content, doc.title, userQuery)
        }));
      };

      let localResults: ExtractedDoc[] = [];
      try {
        const kbResponse = await knowledgeApi.semanticSearch(userQuery, 10);
        if (kbResponse?.content && kbResponse.content.length > 0) {
          localResults = kbResponse.content.map(doc => ({
            ...doc,
            tech: analyzeDocument(doc.content, doc.title, userQuery)
          }));
        } else {
          // Nada acima do threshold de similaridade: carrega a base recente para o RAG analisar
          localResults = await loadRecentDocsFallback();
        }
      } catch (e) {
        // Busca semântica fora do ar (rota fria, backend indisponível etc.) — cai pro
        // mesmo fallback de "docs recentes" do caminho vazio, não deixa localResults vazio à toa.
        console.error('Erro ao consultar Base de Conhecimento (busca semântica):', e);
        try {
          localResults = await loadRecentDocsFallback();
        } catch (fallbackError) {
          console.error('Erro ao consultar Base de Conhecimento (fallback):', fallbackError);
        }
      }

      // 2. Busca no TDN se configurado
      let tdnResults: TdnSearchResult[] = [];
      if (tdnSettings?.baseUrl && tdnSettings?.token) {
        try {
          tdnResults = await searchTdn(tdnSettings.baseUrl, tdnSettings.token, searchQuery, tdnSettings.space, tdnSettings.label);
        } catch (e) {
          console.error('Erro ao buscar no TDN:', e);
        }
      }

      // 3. Compilação de Resultados Técnicos Extrativos
      const allEndpoints = Array.from(new Set(localResults.flatMap(d => d.tech?.endpoints || [])));
      const allTables = Array.from(new Set(localResults.flatMap(d => d.tech?.tables || [])));

      // 4. Resposta determinística (sem IA) a partir dos resultados da Base de Conhecimento/TDN.
      let responseText = '';
      if (localResults.length > 0) {
        const topDoc = localResults[0];
        responseText = `Encontrei **${localResults.length} documento(s)** relevante(s) na Base de Conhecimento interna.`;
        if (topDoc.tech?.bestSnippet) {
          responseText += `\n\n📌 **Trecho em Destaque (${topDoc.title}):**\n> "${topDoc.tech.bestSnippet}"`;
        }
      } else if (tdnResults.length > 0) {
        responseText = `Encontrei **${tdnResults.length} página(s)** correspondente(s) no TDN (Confluence):`;
      } else {
        responseText = `Não encontrei nenhum documento exato para **"${userQuery}"** na base de conhecimento. Tente buscar por termos como nome da API, serviço ou tabela (ex: PCPEDC).`;
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
        docs: localResults,
        tdnResults: tdnResults,
        extractedEndpoints: allEndpoints,
        extractedTables: allTables,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Ocorreu um erro ao consultar a Base de Conhecimento. Verifique sua conexão e tente novamente.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async (tdnResult: TdnSearchResult) => {
    if (!tdnSettings || !session) return;

    setIsImporting(tdnResult.id);
    try {
      // Fetch full content
      const fullContent = await getTdnPageContent(tdnSettings.baseUrl, tdnSettings.token, tdnResult.id);

      // Import to KB
      await importTdnToKnowledgeBase(session.id, {
        id: fullContent.id,
        title: fullContent.title,
        content: fullContent.content,
        space: fullContent.space,
        link: fullContent.link,
        labels: fullContent.labels || tdnResult.labels || []
      });

      toast({
        title: "Documento Importado!",
        description: "A documentação do TDN agora faz parte da sua base local.",
      });
    } catch (err) {
      toast({
        title: "Erro na Importação",
        description: "Não foi possível sincronizar este documento.",
        variant: "destructive"
      });
    } finally {
      setIsImporting(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          aria-label="Base de conhecimento"
          initial={{ x: reduceMotion ? 0 : 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: reduceMotion ? 0 : 400, opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.001 : 0.32, ease: [0.2, 0, 0, 1] }}
          className="fixed bottom-4 left-4 right-4 top-24 z-[100] flex w-auto flex-col overflow-x-hidden sm:left-auto sm:w-[420px] sm:max-w-[calc(100vw-2rem)]"
        >
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_30px_80px_rgba(15,23,42,0.18)] dark:shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
            <div aria-hidden="true" className="h-0.5 shrink-0 bg-gradient-to-r from-primary to-primary/40 [.theme-totvs_&]:bg-none [.theme-totvs_&]:bg-primary [.theme-leitura_&]:bg-none [.theme-leitura_&]:bg-primary" />

            <header className="flex items-center gap-3 border-b border-border px-4 py-3.5">
              <IconTile icon={Sparkles} />
              <div className="flex min-w-0 flex-1 flex-col">
                <h2 className="m-0 text-[15px] font-semibold">Base de conhecimento</h2>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  Assistente local
                  {tdnSettings?.token && <StatusChip tone="success">Motor ativo</StatusChip>}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg text-muted-foreground" aria-label="Fechar base de conhecimento">
                <X className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </header>

            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-4 overflow-x-hidden p-4">
                {activeIssue && (
                  <div className="room-rise rounded-xl border border-border bg-muted/40 p-3">
                    <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <FileText className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Contexto da tarefa
                    </span>
                    <h3 className="m-0 truncate text-[13px] font-semibold">{activeIssue.title}</h3>
                    {activeIssue.description && (
                      <p className="m-0 mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{plainSnippet(activeIssue.description, 180)}</p>
                    )}
                  </div>
                )}

                {messages.map((msg) => (
                  <div key={msg.id} className={cn('flex w-full', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn('flex min-w-0 flex-col gap-2', msg.role === 'user' ? 'max-w-[85%] items-end' : 'max-w-[95%] items-start')}>
                      <div
                        className={cn(
                          'min-w-0 max-w-full whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-[13px] leading-[1.5]',
                          msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'border border-border bg-muted/50 text-foreground'
                        )}
                      >
                        {msg.content}
                      </div>

                      {((msg.extractedEndpoints && msg.extractedEndpoints.length > 0) || (msg.extractedTables && msg.extractedTables.length > 0)) && (
                        <div className="flex w-full flex-col gap-2 rounded-xl border border-border bg-muted/40 p-2.5">
                          {msg.extractedEndpoints && msg.extractedEndpoints.length > 0 && (
                            <div>
                              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Endpoints identificados</span>
                              <div className="flex flex-wrap gap-1">
                                {msg.extractedEndpoints.map((ep, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => copyToClipboard(ep, 'Endpoint')}
                                    className="group flex max-w-full items-center gap-1.5 break-all rounded-md border border-border bg-card px-2 py-1 font-code text-xs font-semibold transition-colors duration-fast hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    title="Clique para copiar"
                                  >
                                    <span>{ep}</span>
                                    {copiedEndpoint === ep ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} /> : <Copy className="h-3 w-3 opacity-60 group-hover:opacity-100" strokeWidth={1.5} />}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {msg.extractedTables && msg.extractedTables.length > 0 && (
                            <div>
                              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Tabelas relacionadas</span>
                              <div className="flex flex-wrap gap-1">
                                {msg.extractedTables.map((tbl, idx) => (
                                  <span key={idx} className="rounded-md bg-muted px-1.5 py-0.5 font-code text-xs font-semibold">{tbl}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {msg.docs && msg.docs.length > 0 && (
                        <ul className="m-0 flex w-full min-w-0 list-none flex-col gap-2 p-0">
                          {msg.docs.map((doc) => (
                            <li key={doc.id}>
                              <button
                                type="button"
                                onClick={() => window.open(`/knowledge/kb?id=${doc.id}`, '_blank')}
                                className="group w-full min-w-0 overflow-hidden rounded-xl border border-border bg-card p-2.5 text-left transition-colors duration-fast hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <span className="mb-0.5 flex items-center justify-between text-xs font-semibold text-primary [.theme-totvs:not(.dark)_&]:text-foreground">
                                  <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Wiki local · {doc.category || 'Geral'}</span>
                                  <ChevronRight className="h-3 w-3 transition-transform duration-fast group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />
                                </span>
                                <span className="block max-w-full truncate text-[13px] font-semibold" title={doc.title}>{doc.title}</span>
                                <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-muted-foreground">
                                  {doc.tech?.bestSnippet || doc.content.replace(/<[^>]*>?/gm, '')}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      {msg.tdnResults && msg.tdnResults.length > 0 && (
                        <div className="flex w-full flex-col gap-2">
                          <span className="flex items-center gap-1.5 px-1 text-xs font-semibold text-muted-foreground">
                            <Globe className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> TDN (Confluence)
                          </span>
                          {msg.tdnResults.map((tdn) => (
                            <div key={tdn.id} className="flex w-full items-center gap-2 overflow-hidden rounded-xl border border-border bg-card p-2.5">
                              <button type="button" className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => window.open(tdn.link, '_blank')}>
                                <span className="block max-w-full truncate text-[13px] font-semibold" title={tdn.title}>{tdn.title}</span>
                                <span className="block truncate text-xs text-muted-foreground">{tdn.space || 'Wiki'}</span>
                              </button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 shrink-0 rounded-lg"
                                aria-label="Importar para a base local"
                                title="Importar para a base local"
                                onClick={(e) => { e.stopPropagation(); handleImport(tdn); }}
                                disabled={isImporting === tdn.id}
                              >
                                {isImporting === tdn.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" strokeWidth={1.5} />}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {messages.length === 1 && (
                  <div className="room-rise flex flex-wrap gap-2">
                    {['Quais os critérios de aceite?', 'Como testar essa funcionalidade?', 'Existe algum débito técnico?'].map((q, i) => (
                      <button
                        key={i}
                        onClick={() => { setInput(q); }}
                        className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs transition-colors duration-fast hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                {isLoading && (
                  <div role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Consultando…
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.docs?.length === 0 && (
              <div className="px-4 pb-2">
                <Button variant="outline" className="h-10 w-full gap-2 rounded-[10px] border-dashed text-[13px]" onClick={() => window.open('/knowledge', '_blank')}>
                  <Database className="h-3.5 w-3.5" strokeWidth={1.5} /> Abrir a wiki completa
                </Button>
              </div>
            )}

            <div className="border-t border-border p-3">
              {activeIssue && (
                <div className="mb-3 flex items-center justify-between px-1">
                  <Label htmlFor="use-context" className="flex cursor-pointer items-center gap-2 text-[13px] font-medium">
                    <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', useContext ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                    Analisar a tarefa em votação
                  </Label>
                  <Switch id="use-context" checked={useContext} onCheckedChange={setUseContext} />
                </div>
              )}
              <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
                <label htmlFor="kb-input" className="sr-only">Pergunta</label>
                <input
                  id="kb-input"
                  placeholder="Pergunte algo sobre o projeto…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className={cn(FIELD, 'h-10 min-w-0 flex-1 text-sm')}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  aria-label="Enviar pergunta"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground room-glow transition-[opacity,background-color] duration-fast hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:shadow-none"
                >
                  <Send className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </form>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
