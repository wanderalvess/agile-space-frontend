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

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  docs?: KnowledgeDocument[];
  tdnResults?: TdnSearchResult[];
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
  const [userApiKey, setUserApiKey] = useState<string | null>(null);
  const { toast } = useToast();

  // Carregar chave do motor
  useEffect(() => {
    async function loadKey() {
      if (!firestore || !user) return;
      try {
        const configDoc = await getDoc(doc(firestore, 'knowledge_user_configs', user.uid, 'ai', 'settings'));
        if (configDoc.exists()) {
          const data = configDoc.data();
          setUserApiKey(data.geminiKey || data.apiKey || null);
        }
      } catch (e) {
        console.warn("Failed to load Key in PokerChat:", e);
      }
    }
    loadKey();
  }, [firestore, user]);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: activeIssue
            ? `Olá! Estou lendo os detalhes da tarefa **${activeIssue.title}**. Como posso ajudar na estimativa técnica deste item?`
            : 'Olá! Sou a Base de Conhecimento. Posso buscar informações na sua documentação técnica para ajudar na estimativa. O que você gostaria de saber?',
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

  // Fetch some available docs for suggestions or fallback
  useEffect(() => {
    const fetchDocs = async () => {
      if (!firestore) return;
      try {
        const q = query(
          collection(firestore, 'knowledge_kb'),
          where('status', '==', 'published'),
          orderBy('updatedAt', 'desc'),
          limit(5)
        );
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as KnowledgeDocument));
        setAvailableDocs(docs);
      } catch (e) {
        console.error('Error fetching available docs:', e);
      }
    };
    fetchDocs();
  }, [firestore]);

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
    setInput('');
    setIsLoading(true);

    // Com "Analisar Issue em Votação" ligado, soma título/descrição da issue
    // à pergunta digitada — sem isso, a busca (local e TDN) só via o texto
    // literal do chat e ignorava de qual tarefa o usuário estava falando.
    const searchQuery = (useContext && activeIssue)
      ? [input, activeIssue.title, activeIssue.description].filter(Boolean).join(' ')
      : input;

    try {
      // 1. Search Local Knowledge Base
      const localResults = await searchKnowledgeBase(firestore!, searchQuery);

      // 2. Search TDN (External)
      let tdnResults: TdnSearchResult[] = [];
      if (tdnSettings?.baseUrl && tdnSettings?.token) {
        try {
          tdnResults = await searchTdn(tdnSettings.baseUrl, tdnSettings.token, searchQuery, tdnSettings.space, tdnSettings.label);
        } catch (e) {
          console.error('Error searching TDN:', e);
        }
      }

      // 3. AI Generation (if API Key is available)
      let assistantContent = '';
      if (userApiKey) {
        // Build System Prompt with Context
        let systemPrompt = "Você é um assistente técnico do Espaço Ágil, ajudando na estimativa de tarefas.";
        if (useContext && activeIssue) {
          systemPrompt += `\n\nCONTEXTO DA TAREFA ATUAL:\nTítulo: ${activeIssue.title}\nDescrição: ${activeIssue.description || 'Sem descrição'}\n\nPor favor, considere estas informações ao responder.`;
        }

        if (localResults.length > 0) {
          systemPrompt += `\n\nDOCUMENTAÇÃO ENCONTRADA NA WIKI:\n${localResults.map(d => `- ${d.title}: ${d.content}`).join('\n')}`;
        }

        try {
          const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
                { role: 'assistant', content: systemPrompt },
                ...newMessages.map(m => ({ role: m.role, content: m.content }))
              ],
              apiKey: userApiKey,
              userId: user?.uid
            })
          });

          if (response.ok) {
            const data = await response.json();
            assistantContent = String(data.content || data.text || '');
          }
        } catch (aiErr) {
          console.error('AI Chat error in Poker:', aiErr);
        }
      }

      // Fallback or Addition if AI failed or not available
      if (!assistantContent) {
        if (localResults.length > 0 || tdnResults.length > 0) {
          assistantContent = `Encontrei resultados para sua dúvida na Base local e no TDN:`;
        } else {
          assistantContent = 'Não encontrei nenhum documento específico. Aqui estão alguns tópicos da Base de Conhecimento que podem ajudar:';
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
        timestamp: Date.now(),
        docs: localResults.length > 0 ? localResults : (localResults.length === 0 && tdnResults.length === 0 ? availableDocs.slice(0, 3) : []),
        tdnResults: tdnResults
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Ocorreu um erro ao consultar as bases. Por favor, tente novamente.',
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
                    {userApiKey && (
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

                      {msg.docs && msg.docs.length > 0 && (
                        <div className="flex flex-col gap-2 w-full mt-1 min-w-0">
                          {msg.docs.map((doc) => (
                            <div
                              key={doc.id}
                              onClick={() => window.open(`/knowledge/kb?id=${doc.id}`, '_blank')}
                              className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/60 dark:border-white/5 p-2.5 rounded-xl hover:bg-white/60 transition-all cursor-pointer group overflow-hidden w-full min-w-0"
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                                  <BookOpen className="h-2 w-2" /> Wiki Local
                                </span>
                                <ChevronRight className="h-2.5 w-2.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                              </div>
                              <h4 className="text-[10px] font-bold text-slate-900 dark:text-white block truncate max-w-full" title={doc.title}>{doc.title}</h4>
                              <p className="text-[8px] text-slate-500 truncate mt-0.5">{doc.content.replace(/<[^>]*>?/gm, '')}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.tdnResults && msg.tdnResults.length > 0 && (
                        <div className="flex flex-col gap-2 w-full mt-1">
                          <div className="flex items-center gap-2 px-1">
                            <Globe className="h-2 w-2 text-cyan-600" />
                            <span className="text-[8px] font-black uppercase text-cyan-600 tracking-[0.2em]">TDN</span>
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