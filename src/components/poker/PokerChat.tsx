'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Sparkles,
  Send,
  BrainCircuit,
  BookOpen,
  AlertCircle,
  X,
  Search,
  Loader2,
  ChevronRight,
  Database,
  Target,
  Globe,
  Download,
  CheckCircle,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { collection, query, limit, getDocs, orderBy, where, doc, getDoc } from 'firebase/firestore';
import { useTdnSettings } from '@/hooks/useTdnSettings';
import { searchTdn, TdnSearchResult, getTdnPageContent, importTdnToKnowledgeBase } from '@/services/tdnService';
import { useToast } from '@/hooks/use-toast';
import { searchKnowledgeBase } from '@/services/oracleService';
import { KnowledgeDocument } from '@/lib/knowledge-types';
import { useFirebase } from '@/firebase';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

import { knowledgeApi } from '@/app/knowledge/api';
import { analyzeDocument, TechnicalExtraction } from '@/lib/tech-extractor';
import { authFetch } from '@/lib/auth-client';
import { Copy, Check } from 'lucide-react';

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
  copiedItem?: string;
}

interface PokerChatProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
  activeTopic?: string;
  activeIssue?: any;
}

export function PokerChat({ roomId, isOpen, onClose, activeTopic, activeIssue }: PokerChatProps) {
  const { firestore, user } = useFirebase();
  const { settings: tdnSettings } = useTdnSettings();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isImporting, setIsImporting] = useState<string | null>(null);
  const [useContext, setUseContext] = useState(true);
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  const { toast } = useToast();

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
  const [availableDocs, setAvailableDocs] = useState<KnowledgeDocument[]>([]);

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

  // Carrega documentos populares da KB via Spring Boot PostgreSQL
  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await knowledgeApi.listDocuments('', [], 0, 5);
        if (res?.content) setAvailableDocs(res.content);
      } catch (e) {
        console.error('Erro ao buscar documentos da Base de Conhecimento:', e);
      }
    };
    fetchDocs();
  }, []);

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
      // 1. Busca documentos no PostgreSQL via Spring Boot REST API (/api/knowledge)
      let localResults: ExtractedDoc[] = [];
      try {
        const kbResponse = await knowledgeApi.listDocuments(searchQuery, [], 0, 10);
        if (kbResponse?.content && kbResponse.content.length > 0) {
          localResults = kbResponse.content.map(doc => ({
            ...doc,
            tech: analyzeDocument(doc.content, doc.title, userQuery)
          }));
        } else {
          // Se não encontrou por palavra-chave restrita, carrega a base recente para o RAG analisar
          const allKbResponse = await knowledgeApi.listDocuments('', [], 0, 20);
          if (allKbResponse?.content) {
            localResults = allKbResponse.content.map(doc => ({
              ...doc,
              tech: analyzeDocument(doc.content, doc.title, userQuery)
            }));
          }
        }
      } catch (e) {
        console.error('Erro ao consultar Base de Conhecimento PostgreSQL:', e);
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

      // 4. Geração RAG via IA (Gemini API / /api/ai/chat)
      let responseText = '';
      const storedApiKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;

      try {
        const aiRes = await authFetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
            apiKey: storedApiKey || undefined,
            contextDocuments: localResults
          })
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          if (aiData.content) {
            responseText = aiData.content;
          }
        }
      } catch (aiErr) {
        console.warn('[PokerChat] Chamada para API de IA RAG falhou, utilizando fallback local:', aiErr);
      }

      // Fallback determinístico caso a IA não retorne texto
      if (!responseText) {
        if (localResults.length > 0) {
          const topDoc = localResults[0];
          responseText = `Encontrei **${localResults.length} documento(s)** relevante(s) na Base de Conhecimento.`;
          if (topDoc.tech?.bestSnippet) {
            responseText += `\n\n📌 **Trecho em Destaque (${topDoc.title}):**\n> "${topDoc.tech.bestSnippet}"`;
          }
        } else if (tdnResults.length > 0) {
          responseText = `Encontrei **${tdnResults.length} página(s)** correspondente(s) no TDN (Confluence):`;
        } else {
          responseText = `Não encontrei nenhum documento exato para **"${userQuery}"**. Tente buscar por termos como nome da API, serviço ou tabela (ex: PCPEDC).`;
        }
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
    if (!tdnSettings || !user || !firestore) return;

    setIsImporting(tdnResult.id);
    try {
      // Fetch full content
      const fullContent = await getTdnPageContent(tdnSettings.baseUrl, tdnSettings.token, tdnResult.id);

      // Import to KB
      await importTdnToKnowledgeBase(firestore, user.uid, {
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
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          className="fixed right-4 left-4 sm:left-auto top-24 bottom-4 w-auto sm:w-[420px] z-[100] flex flex-col"
        >
          <div className="flex-1 bg-white/90 backdrop-blur-2xl border border-slate-200 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden relative">

            {/* BACKGROUND GLOWS */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/5 blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm">
                  <BrainCircuit className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 opacity-60">Base de Conhecimento</span>
                    {tdnSettings?.token && (
                      <Badge variant="secondary" className="text-[8px] bg-emerald-50 text-emerald-600 border-emerald-100 uppercase font-black tracking-tighter h-4 px-1.5">
                        Motor Ativo
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 italic">Base de Conhecimento</h3>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl hover:bg-slate-100 text-slate-400">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-6 overflow-x-hidden">
                {/* Issue Context (Opcional) */}
                {activeIssue && (
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-white rounded-lg border border-slate-200">
                        <FileText className="h-3 w-3 text-indigo-600" />
                      </div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Contexto da Tarefa</span>
                    </div>
                    <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase mb-1 truncate">{activeIssue.title}</h4>
                    {activeIssue.description && (
                      <p className="text-[9px] text-slate-500 line-clamp-2 leading-relaxed">
                        {activeIssue.description}
                      </p>
                    )}
                  </div>
                )}

                {messages.map((msg) => (
                  <div key={msg.id} className={cn(
                    "flex w-full mb-6",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}>
                    <div className={cn(
                      "flex flex-col gap-2 min-w-0",
                      msg.role === 'user' ? "max-w-[80%] items-end" : "max-w-[95%] items-start"
                    )}>
                      <div className={cn(
                        "p-3 rounded-[1.25rem] text-[12px] font-medium leading-relaxed shadow-sm whitespace-pre-wrap break-words max-w-full min-w-0",
                        msg.role === 'user'
                          ? "bg-indigo-600 text-white rounded-tr-none"
                          : "bg-slate-100 text-slate-900 border border-slate-200 rounded-tl-none"
                      )}>
                        {msg.content}
                      </div>

                      {/* Badges de Endpoints e Tabelas extraídos */}
                      {((msg.extractedEndpoints && msg.extractedEndpoints.length > 0) || (msg.extractedTables && msg.extractedTables.length > 0)) && (
                        <div className="flex flex-col gap-1.5 w-full mt-1 bg-indigo-50/70 border border-indigo-100 p-2.5 rounded-xl">
                          {msg.extractedEndpoints && msg.extractedEndpoints.length > 0 && (
                            <div>
                              <span className="text-[8px] font-black uppercase text-indigo-600 tracking-wider block mb-1">Endpoints Identificados:</span>
                              <div className="flex flex-wrap gap-1">
                                {msg.extractedEndpoints.map((ep, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => copyToClipboard(ep, 'Endpoint')}
                                    className="flex items-center gap-1.5 bg-white border border-indigo-200 text-indigo-700 px-2 py-1 rounded-lg text-[9px] font-mono font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-xs group"
                                    title="Clique para copiar"
                                  >
                                    <span>{ep}</span>
                                    {copiedEndpoint === ep ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100" />}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {msg.extractedTables && msg.extractedTables.length > 0 && (
                            <div className="mt-1">
                              <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider block mb-1">Tabelas Relacionadas:</span>
                              <div className="flex flex-wrap gap-1">
                                {msg.extractedTables.map((tbl, idx) => (
                                  <span key={idx} className="bg-slate-200/80 text-slate-700 font-mono text-[8.5px] font-bold px-1.5 py-0.5 rounded-md">
                                    {tbl}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {msg.docs && msg.docs.length > 0 && (
                        <div className="flex flex-col gap-2 w-full mt-1 min-w-0">
                          {msg.docs.map((doc) => (
                            <div
                              key={doc.id}
                              onClick={() => window.open(`/knowledge/kb?id=${doc.id}`, '_blank')}
                              className="bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl hover:bg-white transition-all cursor-pointer group overflow-hidden w-full min-w-0 shadow-xs"
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                                  <BookOpen className="h-2 w-2" /> Wiki Local • {doc.category || 'Geral'}
                                </span>
                                <ChevronRight className="h-2.5 w-2.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                              </div>
                              <h4 className="text-[10px] font-bold text-slate-900 dark:text-white block truncate max-w-full" title={doc.title}>{doc.title}</h4>
                              <p className="text-[8.5px] text-slate-500 line-clamp-2 mt-0.5 font-sans leading-tight">
                                {doc.tech?.bestSnippet || doc.content.replace(/<[^>]*>?/gm, '')}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.tdnResults && msg.tdnResults.length > 0 && (
                        <div className="flex flex-col gap-2 w-full mt-1">
                          <div className="flex items-center gap-2 px-1">
                            <Globe className="h-2 w-2 text-cyan-600" />
                            <span className="text-[8px] font-black uppercase text-cyan-600 tracking-[0.2em]">TDN (Confluence)</span>
                          </div>
                          {msg.tdnResults.map((tdn) => (
                            <div
                              key={tdn.id}
                              className="bg-cyan-50/50 border border-cyan-100 p-2.5 rounded-xl hover:bg-cyan-50 transition-all group overflow-hidden w-full"
                            >
                              <div className="flex items-center justify-between">
                                <div
                                  className="flex-1 cursor-pointer min-w-0"
                                  onClick={() => window.open(tdn.link, '_blank')}
                                >
                                  <h4 className="text-[10px] font-bold text-slate-900 block truncate max-w-full group-hover:text-cyan-600 transition-colors" title={tdn.title}>{tdn.title}</h4>
                                  <div className="flex items-center gap-2 mt-0.5 overflow-hidden">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter truncate">{tdn.space || 'TOTVS'}</span>
                                  </div>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 rounded-lg hover:bg-cyan-100/50 text-cyan-600 shrink-0 ml-2"
                                  onClick={(e) => { e.stopPropagation(); handleImport(tdn); }}
                                  disabled={isImporting === tdn.id}
                                >
                                  {isImporting === tdn.id ? (
                                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                  ) : (
                                    <Download className="h-2.5 w-2.5" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {messages.length === 1 && (
                  <div className="flex flex-wrap gap-2 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
                    {['Quais os critérios de aceite?', 'Como testar essa funcionalidade?', 'Existe algum débito técnico?'].map((q, i) => (
                      <button
                        key={i}
                        onClick={() => { setInput(q); }}
                        className="px-3 py-1.5 rounded-full bg-white/50 border border-indigo-100 text-[9px] font-bold text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                {isLoading && (
                  <div className="flex items-center gap-2 text-indigo-600 animate-pulse mt-4">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Consultando...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Knowledge Base Link when empty results */}
            {messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.docs?.length === 0 && (
              <div className="px-6 pb-2">
                <Button
                  variant="outline"
                  className="w-full h-10 rounded-xl border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-[10px] font-black uppercase tracking-widest gap-2"
                  onClick={() => window.open('/knowledge', '_blank')}
                >
                  <Database className="h-3.5 w-3.5" /> Acessar Wiki Completa do Projeto
                </Button>
              </div>
            )}

            {/* Input Area */}
            <div className="p-6 bg-slate-50 border-t border-slate-100">
              {activeIssue && (
                <div className="flex items-center justify-between mb-4 px-1">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      useContext ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                    )} />
                    <Label htmlFor="use-context" className="text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer">
                      Analisar Issue em Votação
                    </Label>
                  </div>
                  <Switch
                    id="use-context"
                    checked={useContext}
                    onCheckedChange={setUseContext}
                    className="data-[state=checked]:bg-emerald-500 scale-75 origin-right"
                  />
                </div>
              )}

              <div className="relative group">
                <Input
                  placeholder="Pergunte algo sobre o projeto..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="pr-12 h-14 rounded-2xl border-slate-200 bg-white shadow-inner focus-visible:ring-indigo-500/20 text-sm font-medium text-slate-900 placeholder:text-slate-400"
                />
                <Button
                  size="icon"
                  disabled={!input.trim() || isLoading}
                  onClick={handleSend}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all active:scale-90"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[9px] text-center text-slate-400 mt-4 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                <Sparkles className="h-3 w-3 text-indigo-400" /> Suportado pela Base de Conhecimento
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}